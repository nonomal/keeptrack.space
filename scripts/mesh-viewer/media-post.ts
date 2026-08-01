/* eslint-disable no-sync */
/**
 * Post pipeline for mesh media: takes the raw frames capture-rotation.ts
 * screenshots (RGBA when a backdrop goes underneath, opaque otherwise) and
 * produces the final look entirely inside ffmpeg - no raster deps:
 *
 *   lean rotate -> center crop -> starfield underlay -> earthshine (gradient
 *   masked by the model's alpha, screen-blended) -> filmic tonemap (curves) ->
 *   bloom (highlight extract + gblur + screen) -> vignette -> grain -> badge.
 *
 * The graph runs once, writing processed PNG frames; GIF/WebM/MP4 are then
 * encoded from those, so every format shares identical pixels and the badge
 * is baked in (stampGif/stampPng are not needed on these outputs).
 *
 * Loop seams: every animated term completes an integer number of cycles per
 * loop. The star drift is a half-cosine sway (out and back) rather than a
 * linear pan - a linear pan cannot loop over a non-tiling starfield without a
 * visible jump.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { badgeLayout, BADGE_LOGO_PATH } from '../watermark/stamp';
import { writeStarfieldPng, writeVerticalGradientPng } from './media-backdrops';
import { MediaPackageSpec, needsTransparentCapture } from './media-packages';

/** Viewer horizontal FOV for square captures (mat4.perspective 45deg, aspect
 *  1 in viewer.js) - maps camera angles to backdrop pixels for orbit sync. */
const VIEWER_HFOV_DEG = 45;

/** Earthshine: cool bounce light from below, as if off a sunlit Earth. */
const EARTHSHINE_RGB: [number, number, number] = [58, 88, 148];
const EARTHSHINE_STOP = 0.6;
const EARTHSHINE_OPACITY = 0.5;
const BLOOM_THRESHOLD = 0.62;
const BLOOM_OPACITY = 0.6;
/** Lifting filmic curve: these swiftshader renders sit dark (single sun +
 *  near-black ambient), so raise the mids while pinning black - the sky base
 *  (2-6/255) must stay night. */
const TONEMAP_CURVE = '0/0 0.2/0.27 0.65/0.76 1/1';
const SATURATION = 1.07;

/**
 * Saturation as an RGB colorchannelmixer matrix. The eq filter would do this
 * in one arg, but eq is YUV-domain and dropping it mid-graph forced a pixel
 * format negotiation that mislabeled planes downstream (frames came out
 * purple). Everything in this graph stays RGB-planar instead.
 */
function saturationMixer(s: number): string {
  const [lr, lg, lb] = [0.2126, 0.7152, 0.0722];
  const f = (v: number): string => v.toFixed(4);
  const inv = 1 - s;

  return (
    `colorchannelmixer=rr=${f(inv * lr + s)}:rg=${f(inv * lg)}:rb=${f(inv * lb)}` +
    `:gr=${f(inv * lr)}:gg=${f(inv * lg + s)}:gb=${f(inv * lb)}` +
    `:br=${f(inv * lr)}:bg=${f(inv * lg)}:bb=${f(inv * lb + s)}`
  );
}

export interface ProcessJob {
  /** Directory of raw frames named frame-%03d.png (ignored when stillPath set). */
  frameDir: string;
  /** Single input image instead of a sequence (hero renders). */
  stillPath?: string;
  frames: number;
  fps: number;
  /** Raw capture dimensions (includes the lean margin). */
  captureWidth: number;
  captureHeight: number;
  /** Final output dimensions after the lean crop. */
  outWidth: number;
  outHeight: number;
  spec: MediaPackageSpec;
  /** Starfield seed - the mesh name, so each object keeps a stable sky. */
  seed: string;
  /** Scratch directory for backdrops + processed frames. */
  workDir: string;
}

function ffmpeg(args: string[]): void {
  execFileSync('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
}

/**
 * Run the look pipeline once. Returns the processed sequence pattern (or the
 * processed still path), ready for the encoders below.
 */
export function processFrames(job: ProcessJob): string {
  const { spec } = job;
  const isStill = Boolean(job.stillPath);
  const transparent = needsTransparentCapture(spec);
  const duration = job.frames / job.fps;
  const inputs: string[] = [];
  const chains: string[] = [];
  let starsIdx = -1;
  let gradIdx = -1;

  // Backdrops are written into workDir before ffmpeg runs, so create it first.
  fs.mkdirSync(job.workDir, { recursive: true });

  if (job.stillPath) {
    inputs.push('-i', job.stillPath);
  } else {
    inputs.push('-framerate', String(job.fps), '-i', path.join(job.frameDir, 'frame-%03d.png'));
  }

  let inputCount = 1;

  // 'orbit' geometry: one loop = one full 360-degree camera orbit, so the sky
  // must pan 360/hfov view-widths for the background to corroborate the
  // camera motion (a static backdrop reads as the SATELLITE spinning). The
  // sky is cylindrical (wrap columns appended) so the pan loops seamlessly,
  // and it bobs vertically in sync with the pitch nod.
  const isOrbit = spec.stars === 'orbit' && !isStill;
  const panW = isOrbit ? Math.round(job.outWidth * (360 / VIEWER_HFOV_DEG)) : 0;
  const bobPx = isOrbit ? Math.round(job.outHeight * (spec.pitchOscDeg / VIEWER_HFOV_DEG)) : 0;

  if (spec.stars !== 'none') {
    const starsW = job.outWidth + panW;
    const starsH = job.outHeight + 2 * bobPx;
    const starsFile = path.join(job.workDir, `stars-${starsW}x${starsH}.png`);

    // starCount is per 640x640 of VISIBLE window; scale to the sky's area so
    // on-screen density stays constant whether the sky is one frame (static)
    // or a full pan cylinder (orbit). Bright anchor stars scale at a quarter
    // rate - they are meant to be rare (~2 visible at a time).
    const areaScale = (starsW * starsH) / (640 * 640);

    writeStarfieldPng(starsFile, starsW, starsH, job.seed, {
      starCount: Math.round(spec.starCount * areaScale),
      brightCount: Math.max(spec.brightStarCount, Math.round(spec.brightStarCount * areaScale / 4)),
      wrapAppendPx: isOrbit ? job.outWidth : 0,
      // Streak length tracks the per-frame pan step so motion reads smooth.
      streakPx: isOrbit ? Math.round((panW / job.frames) * 0.7) : 0,
    });
    inputs.push('-loop', '1', '-i', starsFile);
    starsIdx = inputCount++;
  }

  if (spec.earthshine) {
    const gradFile = path.join(job.workDir, `grad-${job.outWidth}x${job.outHeight}.png`);

    writeVerticalGradientPng(gradFile, job.outWidth, job.outHeight, EARTHSHINE_RGB, EARTHSHINE_STOP);
    inputs.push('-loop', '1', '-i', gradFile);
    gradIdx = inputCount++;
  }

  inputs.push('-i', BADGE_LOGO_PATH);
  const badgeIdx = inputCount++;

  // ── Lean rotate + center crop ──
  const leanExpr = isStill
    ? `(${spec.leanDeg})*PI/180`
    : `(${spec.leanDeg}+(${spec.leanOscDeg})*sin(2*PI*t/${duration}))*PI/180`;
  const fill = transparent ? 'none' : 'black';
  const needsLean = Math.abs(spec.leanDeg) + Math.abs(spec.leanOscDeg) > 0.01;
  const rotateStep = needsLean ? `,rotate=a='${leanExpr}':c=${fill}:ow=iw:oh=ih` : '';
  const cropX = `(iw-${job.outWidth})/2`;
  const cropY = `(ih-${job.outHeight})/2`;

  chains.push(`[0:v]format=rgba${rotateStep},crop=${job.outWidth}:${job.outHeight}:${cropX}:${cropY}[fr]`);

  // ── Scene composition ──
  let scene = '[fr]';

  if (transparent) {
    chains.push('[fr]split[frMain][frForMask]');
    chains.push('[frForMask]alphaextract,format=gray[mask]');
    scene = '[frMain]';
  }

  if (starsIdx >= 0) {
    if (isOrbit) {
      // Pan the full cylinder once per loop (the wrap strip makes x=panW
      // identical to x=0) and bob in sync with the pitch nod: pitch up means
      // the view tilts down, stars shift up in frame, window moves down.
      const skyCropX = `'${panW}*t/${duration}'`;
      const skyCropY = `'${bobPx}+${bobPx}*sin(2*PI*t/${duration})'`;

      chains.push(`[${starsIdx}:v]crop=${job.outWidth}:${job.outHeight}:${skyCropX}:${skyCropY},format=gbrp[skyp]`);
    } else {
      chains.push(`[${starsIdx}:v]crop=${job.outWidth}:${job.outHeight}:0:${bobPx},format=gbrp[skyp]`);
    }
    chains.push(`${scene}format=rgba[frp]`);
    chains.push('[skyp][frp]overlay=0:0:shortest=1[scene]');
    scene = '[scene]';
  } else if (transparent) {
    // No stars but alpha frames: flatten onto black.
    chains.push(`color=black:s=${job.outWidth}x${job.outHeight},format=gbrp[bgp]`);
    chains.push(`${scene}format=rgba[frp]`);
    chains.push('[bgp][frp]overlay=0:0:shortest=1[scene]');
    scene = '[scene]';
  }

  if (gradIdx >= 0) {
    chains.push('[mask]format=gbrp[maskp]');
    chains.push(`[${gradIdx}:v]format=gbrp[gradp]`);
    chains.push('[gradp][maskp]blend=all_mode=multiply:shortest=1[tint]');
    chains.push(`${scene}format=gbrp[sceneP]`);
    chains.push(`[sceneP][tint]blend=all_mode=screen:all_opacity=${EARTHSHINE_OPACITY}[lit]`);
    scene = '[lit]';
  }

  // ── Grade ──
  let current = scene;
  const step = (filter: string, label: string): void => {
    chains.push(`${current}${filter}[${label}]`);
    current = `[${label}]`;
  };

  step('format=gbrp', 'flat');
  if (spec.tonemap) {
    step(`curves=master='${TONEMAP_CURVE}',${saturationMixer(SATURATION)},format=gbrp`, 'tm');
  }
  if (spec.bloom) {
    const sigma = Math.max(6, Math.round(job.outWidth * 0.016));

    chains.push(`${current}split[gBase][gHi]`);
    chains.push(`[gHi]colorlevels=rimin=${BLOOM_THRESHOLD}:gimin=${BLOOM_THRESHOLD}:bimin=${BLOOM_THRESHOLD},gblur=sigma=${sigma}[glow]`);
    chains.push(`[gBase][glow]blend=all_mode=screen:all_opacity=${BLOOM_OPACITY}[bl]`);
    current = '[bl]';
  }
  if (spec.vignette) {
    // vignette is YUV-domain: pin the stream back to RGB planar immediately so
    // later filters never inherit an ambiguous negotiation.
    step('vignette=a=0.42,format=gbrp', 'vg');
  }
  if (spec.grain && !isStill) {
    step('noise=alls=6:allf=t', 'gr');
  }

  // ── Badge (same geometry as scripts/watermark/stamp.ts) ──
  const { logo, margin, x, opacity } = badgeLayout(job.outWidth);

  chains.push(`[${badgeIdx}:v]scale=${logo}:${logo},format=rgba,colorchannelmixer=aa=${opacity}[badge]`);
  chains.push(`${current}format=rgb24[preBadge]`);
  chains.push(`[preBadge][badge]overlay=${x}:H-h-${margin}[out]`);

  const outPath = isStill
    ? path.join(job.workDir, 'processed-still.png')
    : path.join(job.workDir, 'proc-%03d.png');

  fs.mkdirSync(job.workDir, { recursive: true });
  ffmpeg([
    ...inputs,
    '-filter_complex', chains.join(';'),
    '-map', '[out]',
    '-frames:v', String(isStill ? 1 : job.frames),
    outPath,
  ]);

  return outPath;
}

/** Two-pass palette GIF, identical settings to the legacy path. A framestep
 *  above 1 drops frames (and playback rate with them, so wall-clock duration
 *  holds) - long loops at full fps make heavy GIFs. */
export function encodeGif(procPattern: string, fps: number, outFile: string, framestep = 1): void {
  const stepFilter = framestep > 1 ? `framestep=${framestep},` : '';

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  ffmpeg([
    '-framerate', String(fps), '-i', procPattern,
    '-vf', `${stepFilter}split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3`,
    '-loop', '0',
    outFile,
  ]);
}

export function encodeWebm(procPattern: string, fps: number, outFile: string): void {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  ffmpeg([
    '-framerate', String(fps), '-i', procPattern,
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '33', '-row-mt', '1',
    '-deadline', 'good', '-cpu-used', '2', '-pix_fmt', 'yuv420p',
    outFile,
  ]);
}

export function encodeMp4(procPattern: string, fps: number, outFile: string): void {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  ffmpeg([
    '-framerate', String(fps), '-i', procPattern,
    '-c:v', 'libx264', '-crf', '19', '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    outFile,
  ]);
}
