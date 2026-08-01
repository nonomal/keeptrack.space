/* eslint-disable no-sync, no-console */
/**
 * Rotating-mesh media: a full-revolution loop of one mesh, plus an optional
 * wide static PNG hero (og:image and card grids want a PNG, not an animation).
 *
 * Legacy mode (KTOC notice pipeline - behavior unchanged):
 *   npx tsx scripts/mesh-viewer/capture-rotation.ts dsp --gif out/dsp-mesh.gif --png out/dsp-mesh.png
 *
 * Package mode (satellite-page media, look presets in media-packages.ts):
 *   npx tsx scripts/mesh-viewer/capture-rotation.ts milstar --package b
 *   npx tsx scripts/mesh-viewer/capture-rotation.ts milstar --package c --out-dir media-drop/proto
 *
 * Flags: --frames N, --fps N, --size N (canvas px), --port N override the
 * legacy defaults or the package preset. --gif/--png force output paths in
 * either mode; package mode otherwise writes
 * <out-dir>/<mesh>-<package>.<fmt> (+ -hero.png) for every format the
 * package specifies (out-dir defaults to scripts/mesh-viewer/media-drop).
 *
 * The mesh-viewer server is started in-process (same PORT env contract as
 * server.ts) and dies with this script. Legacy GIF assembly shells out to
 * ffmpeg with a two-pass palette; package mode runs the media-post.ts look
 * pipeline (lean, stars, earthshine, tonemap, bloom, grain, badge) instead.
 * Chromium runs with --disable-gpu (swiftshader) or the first composited WebGL
 * context is lost and every frame is black - same trap as capture-angles.ts.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { stampGif, stampPng } from '../watermark/stamp';
import { captureMarginFactor, MEDIA_PACKAGES, needsTransparentCapture } from './media-packages';
import { encodeGif, encodeMp4, encodeWebm, processFrames } from './media-post';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const meshName = args.find((a) => !a.startsWith('--'));

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const packageKey = flagValue('--package');
const spec = packageKey ? MEDIA_PACKAGES[packageKey] : undefined;

if (packageKey && !spec) {
  throw new Error(`unknown --package "${packageKey}" (have: ${Object.keys(MEDIA_PACKAGES).join(', ')})`);
}

const gifOut = flagValue('--gif');
const pngOut = flagValue('--png');
const outDir = flagValue('--out-dir') ?? path.join(scriptDir, 'media-drop');
const frames = Number(flagValue('--frames') ?? spec?.frames ?? 60);
const fps = Number(flagValue('--fps') ?? spec?.fps ?? 20);
const size = Number(flagValue('--size') ?? 640);
const port = Number(flagValue('--port') ?? process.env.PORT ?? 5599);

if (!meshName || (!spec && !gifOut)) {
  throw new Error('usage: capture-rotation.ts <meshName> (--gif <out.gif> [--png <out.png>] | --package a|b|c [--out-dir d]) [--frames N] [--fps N] [--size N] [--port N]');
}

interface ViewerDebug {
  state: {
    currentName: string | null;
    model: { bboxMin: number[]; bboxMax: number[] } | null;
    cam: Record<string, number>;
    sunAz: number;
    sunEl: number;
  };
  renderFrame: () => void;
}

/** Frame the model like capture-angles.ts: pan onto the bbox centre, widen the
 *  extent by the Z offset so nothing is silently cropped. Distance fits the
 *  bbox to the canvas: vertical extent against height, worst-case-across-yaw
 *  horizontal extent (hypot of X and Z) against width/aspect, whichever binds.
 *  A single max-axis extent leaves wide winged spacecraft tiny on a 16:9 hero.
 *  Runs inside the page (page.evaluate serializes it): one args object. */
const frameModel = ({ yaw, pitch, distMul, aspect, sunAzDeg, sunElDeg }: { yaw: number; pitch: number; distMul: number; aspect: number; sunAzDeg: number; sunElDeg: number }): void => {
  const dbg = (globalThis as { __viewerDebug?: ViewerDebug }).__viewerDebug;

  if (!dbg?.state.model) {
    throw new Error('viewer has no model loaded');
  }
  const bb = dbg.state.model;
  const cx = (bb.bboxMin[0] + bb.bboxMax[0]) / 2;
  const cy = (bb.bboxMin[1] + bb.bboxMax[1]) / 2;
  const cz = (bb.bboxMin[2] + bb.bboxMax[2]) / 2;
  const vertical = bb.bboxMax[1] - bb.bboxMin[1];
  const horizontal = Math.hypot(bb.bboxMax[0] - bb.bboxMin[0], bb.bboxMax[2] - bb.bboxMin[2]);
  const extent = Math.max(vertical, horizontal / aspect) + 2 * Math.abs(cz);

  dbg.state.cam.panX = cx * 0.001;
  dbg.state.cam.panY = cy * 0.001;
  dbg.state.cam.yaw = yaw;
  dbg.state.cam.pitch = pitch;
  dbg.state.cam.dist = extent * 0.001 * distMul;
  dbg.state.sunAz = sunAzDeg;
  dbg.state.sunEl = sunElDeg;
  dbg.renderFrame();
};

const waitForServer = async (): Promise<void> => {
  const deadline = Date.now() + 15_000;

  for (;;) {
    try {
      const res = await fetch(`http://localhost:${port}/api/meshes`);

      if (res.ok) {
        return;
      }
    } catch {
      // Not up yet.
    }
    if (Date.now() > deadline) {
      throw new Error(`mesh-viewer server did not come up on :${port}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
};

/** Sun placement per frame: locked follows the camera yaw at a fixed offset
 *  (lighting constant through the loop), fixed stays put in world azimuth so
 *  the orbiting view sweeps through the terminator. Legacy = locked 40/35. */
const sunFor = (yawRad: number): { azDeg: number; elDeg: number } => {
  const RAD2DEG = 180 / Math.PI;

  if (!spec || spec.sun.mode === 'locked') {
    return { azDeg: yawRad * RAD2DEG + (spec?.sun.azDeg ?? 40), elDeg: spec?.sun.elDeg ?? 35 };
  }

  return { azDeg: spec.sun.azDeg, elDeg: spec.sun.elDeg };
};

const even = (n: number): number => 2 * Math.round(n / 2);

const main = async (): Promise<void> => {
  process.env.PORT = String(port);
  process.argv.push('--no-open');
  await import('./server');
  await waitForServer();

  const transparent = spec ? needsTransparentCapture(spec) : false;
  const margin = spec ? captureMarginFactor(spec) : 1;
  const captureSize = even(size * margin);

  const browser = await chromium.launch({ args: ['--disable-gpu', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: captureSize, height: captureSize } });
  const query = transparent ? '?transparent=1' : '';

  await page.goto(`http://localhost:${port}/${query}#${encodeURIComponent(meshName)}`, { waitUntil: 'load' });
  await page.waitForFunction(
    (n) => {
      const dbg = (globalThis as { __viewerDebug?: ViewerDebug }).__viewerDebug;

      return dbg?.state.currentName === n && Boolean(dbg.state.model);
    },
    meshName,
    { timeout: 20_000 },
  );

  await page.addStyleTag({ content: '#sidebar, .panel, #info, #materials, #controls, #cam, #hint, #error { display: none !important; }' });
  await page.evaluate(() => {
    const toggle = document.querySelector('#axes-toggle') as HTMLInputElement | null;

    if (toggle?.checked) {
      toggle.click();
    }
  });

  const frameDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-rotation-'));
  const canvas = page.locator('#canvas');
  const pitchBase = spec?.pitchBaseRad ?? 0.35;
  const pitchOscRad = ((spec?.pitchOscDeg ?? 0) * Math.PI) / 180;
  const distMul = 1.45 * margin;

  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    const yaw = 0.7 + 2 * Math.PI * t;
    const pitch = pitchBase + pitchOscRad * Math.sin(2 * Math.PI * t);
    const sun = sunFor(yaw);

    await page.evaluate(frameModel, { yaw, pitch, distMul, aspect: 1, sunAzDeg: sun.azDeg, sunElDeg: sun.elDeg });
    await canvas.screenshot({ path: path.join(frameDir, `frame-${String(i).padStart(3, '0')}.png`), omitBackground: transparent });
  }

  // Wide hero frame: same oblique view the verification shots use, on a
  // canvas shaped for social cards rather than the square loop.
  // Slightly looser than the loop: a cropped hero reads as missing geometry.
  const heroW = 1200;
  const heroH = 675;
  const wantHero = Boolean(pngOut) || Boolean(spec);
  let heroCapture: string | null = null;

  if (wantHero) {
    await page.setViewportSize({ width: even(heroW * margin), height: even(heroH * margin) });
    const sun = sunFor(0.7);

    await page.evaluate(frameModel, { yaw: 0.7, pitch: pitchBase, distMul: 1.6 * margin, aspect: heroW / heroH, sunAzDeg: sun.azDeg, sunElDeg: sun.elDeg });
    await page.waitForTimeout(120);
    heroCapture = path.join(frameDir, 'hero-capture.png');
    await canvas.screenshot({ path: heroCapture, omitBackground: transparent });
  }

  await browser.close();

  if (spec) {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mesh-post-'));
    const outBase = path.join(outDir, `${meshName}-${spec.key}`);
    const written: string[] = [];

    const procPattern = processFrames({
      frameDir,
      frames,
      fps,
      captureWidth: captureSize,
      captureHeight: captureSize,
      outWidth: size,
      outHeight: size,
      spec,
      seed: meshName,
      workDir,
    });

    // An explicit --gif forces a GIF even when the package omits it (packages
    // with starfields default to video formats: stars make GIFs enormous).
    const formats = gifOut && !spec.formats.includes('gif') ? [...spec.formats, 'gif' as const] : spec.formats;

    for (const format of formats) {
      const outFile = format === 'gif' && gifOut ? gifOut : `${outBase}.${format}`;

      if (format === 'gif') {
        encodeGif(procPattern, fps, outFile);
      } else if (format === 'webm') {
        encodeWebm(procPattern, fps, outFile);
      } else {
        encodeMp4(procPattern, fps, outFile);
      }
      written.push(outFile);
    }

    if (heroCapture) {
      const heroFile = pngOut ?? `${outBase}-hero.png`;
      const processedHero = processFrames({
        frameDir,
        stillPath: heroCapture,
        frames: 1,
        fps: 1,
        captureWidth: even(heroW * margin),
        captureHeight: even(heroH * margin),
        outWidth: heroW,
        outHeight: heroH,
        spec,
        seed: meshName,
        workDir,
      });

      fs.mkdirSync(path.dirname(heroFile), { recursive: true });
      fs.copyFileSync(processedHero, heroFile);
      written.push(heroFile);
    }

    fs.rmSync(workDir, { recursive: true, force: true });
    fs.rmSync(frameDir, { recursive: true, force: true });
    console.log(`captured ${meshName} [package ${spec.key}/${spec.label}]: ${frames} frames -> ${written.join(', ')}`);
    process.exit(0);
  }

  // ── Legacy path: plain turntable GIF (+ stamped hero PNG) ──
  if (!gifOut) {
    throw new Error('unreachable: legacy mode requires --gif');
  }
  if (pngOut && heroCapture) {
    fs.mkdirSync(path.dirname(pngOut), { recursive: true });
    fs.copyFileSync(heroCapture, pngOut);
    stampPng(pngOut);
  }

  fs.mkdirSync(path.dirname(gifOut), { recursive: true });
  execFileSync('ffmpeg', [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(frameDir, 'frame-%03d.png'),
    '-vf', 'split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
    '-loop', '0',
    gifOut,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  stampGif(gifOut);

  fs.rmSync(frameDir, { recursive: true, force: true });
  const pngNote = pngOut ? ` + ${pngOut}` : '';

  console.log(`captured ${meshName}: ${frames} frames -> ${gifOut}${pngNote}`);
  // The in-process viewer server (fs.watch, listening socket) holds the event
  // loop open; the outputs are written, so end the process explicitly.
  process.exit(0);
};

await main();
