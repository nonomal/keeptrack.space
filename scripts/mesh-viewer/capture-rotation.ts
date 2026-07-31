/* eslint-disable no-sync, no-console */
/**
 * Rotating-mesh media for KTOC notice articles: a full-revolution GIF of one
 * mesh on the viewer's black background, plus an optional wide static PNG for
 * the article hero (og:image and card grids want a PNG, not an animation).
 *
 *   npx tsx scripts/mesh-viewer/capture-rotation.ts dsp --gif out/dsp-mesh.gif --png out/dsp-mesh.png
 *
 * Flags: --frames 60, --fps 20, --size 640 (GIF canvas), --port 5599.
 *
 * The mesh-viewer server is started in-process (same PORT env contract as
 * server.ts) and dies with this script. GIF assembly shells out to ffmpeg with
 * a two-pass palette, which keeps a mesh-on-black loop in the low megabytes.
 * Chromium runs with --disable-gpu (swiftshader) or the first composited WebGL
 * context is lost and every frame is black - same trap as capture-angles.ts.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { chromium } from 'playwright';
import { stampGif, stampPng } from '../watermark/stamp';

const args = process.argv.slice(2);
const meshName = args.find((a) => !a.startsWith('--'));

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const gifOut = flagValue('--gif');
const pngOut = flagValue('--png');
const frames = Number(flagValue('--frames') ?? 60);
const fps = Number(flagValue('--fps') ?? 20);
const size = Number(flagValue('--size') ?? 640);
const port = Number(flagValue('--port') ?? process.env.PORT ?? 5599);

if (!meshName || !gifOut) {
  throw new Error('usage: capture-rotation.ts <meshName> --gif <out.gif> [--png <out.png>] [--frames N] [--fps N] [--size N] [--port N]');
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
const frameModel = ({ yaw, pitch, distMul, aspect }: { yaw: number; pitch: number; distMul: number; aspect: number }): void => {
  const RAD2DEG = 180 / Math.PI;
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
  // Turntable lighting: the sun orbits WITH the camera (fixed 40 deg offset),
  // otherwise half the revolution shows only the near-black ambient floor.
  dbg.state.sunAz = yaw * RAD2DEG + 40;
  dbg.state.sunEl = 35;
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

const main = async (): Promise<void> => {
  process.env.PORT = String(port);
  process.argv.push('--no-open');
  await import('./server');
  await waitForServer();

  const browser = await chromium.launch({ args: ['--disable-gpu', '--use-gl=swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: size, height: size } });

  await page.goto(`http://localhost:${port}/#${encodeURIComponent(meshName)}`, { waitUntil: 'load' });
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

  for (let i = 0; i < frames; i++) {
    const yaw = 0.7 + (2 * Math.PI * i) / frames;

    await page.evaluate(frameModel, { yaw, pitch: 0.35, distMul: 1.45, aspect: 1 });
    await canvas.screenshot({ path: path.join(frameDir, `frame-${String(i).padStart(3, '0')}.png`) });
  }

  if (pngOut) {
    // Wide hero frame: same oblique view the verification shots use, on a
    // canvas shaped for social cards rather than the square GIF.
    // Slightly looser than the GIF: a cropped hero reads as missing geometry.
    await page.setViewportSize({ width: 1200, height: 675 });
    await page.evaluate(frameModel, { yaw: 0.7, pitch: 0.35, distMul: 1.6, aspect: 1200 / 675 });
    await page.waitForTimeout(120);
    fs.mkdirSync(path.dirname(pngOut), { recursive: true });
    await canvas.screenshot({ path: pngOut });
    stampPng(pngOut);
  }

  await browser.close();

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
