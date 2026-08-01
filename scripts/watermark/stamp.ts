/* eslint-disable no-sync, no-console */
/**
 * Stamp the KeepTrack badge onto published PNGs and GIFs via ffmpeg. Published
 * charts, 3D captures and mesh turntables get copied around the moment an event
 * is interesting, so every outbound raster carries the mark.
 *
 * Library use (capture-notice-shot.ts, capture-rotation.ts):
 *   stampPng(file); stampGif(file);
 *
 * CLI (stamps files in place):
 *   npx tsx scripts/watermark/stamp.ts [--inset px] <files...>
 *
 * The badge goes in the bottom-left corner OF THE IMAGE ITSELF — no added band,
 * no margin of its own. That placement is the point: on a chart the corner sits
 * in the same rows as the x-axis title and the same columns as the y-axis title,
 * so a crop tight enough to remove the badge also removes the axis labels and
 * takes the chart's meaning with it. A mark in added whitespace is one crop away
 * from gone. No URL text either — searching the name finds the site.
 *
 * `insetX` shifts the badge right, for frames whose left edge is UI chrome (the
 * app's icon rail in the notice 3D captures).
 *
 * Newly generated charts get the same badge drawn in vector form by
 * keeptrack-catalog-db's scripts/lib/watermark.ts; keep the two size formulas in
 * step. This path is for stamping rasters that already exist.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface StampOptions {
  /**
   * Extra horizontal pixels past the margin, to clear UI chrome such as the
   * app's left icon rail.
   */
  insetX?: number;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LOGO = path.join(HERE, 'assets', 'kts-text-logo.png');

/** Badge asset path, for pipelines that overlay the badge inside their own
 *  ffmpeg filtergraph (mesh-media post pipeline) instead of stamping a
 *  finished file. */
export const BADGE_LOGO_PATH = LOGO;

/** Badge edge relative to image width, clamped so it stays legible on a 640-px
 *  GIF without dominating a 2400-px capture. Mirrors the constants in
 *  keeptrack-catalog-db's scripts/lib/watermark.ts: an 81-px badge on a
 *  1400-px chart raster. */
const LOGO_FRACTION = 0.058;
const LOGO_MIN = 44;
const LOGO_MAX = 108;
const MARGIN_FRACTION = 0.012;
const OPACITY = 0.85;

/** Badge geometry for a given output width, shared with external filtergraphs. */
export function badgeLayout(width: number, opts: StampOptions = {}): { logo: number; margin: number; x: number; opacity: number } {
  const logo = Math.round(Math.min(LOGO_MAX, Math.max(LOGO_MIN, width * LOGO_FRACTION)));
  const margin = Math.max(10, Math.round(width * MARGIN_FRACTION));

  return { logo, margin, x: margin + (opts.insetX ?? 0), opacity: OPACITY };
}

/** Image dimensions straight from the file header — saves an ffprobe spawn. */
export function imageSize(file: string): { width: number; height: number } {
  const buf = fs.readFileSync(file);

  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 10 && buf.toString('ascii', 0, 3) === 'GIF') {
    return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
  }
  throw new Error(`unrecognised image format: ${file}`);
}

/** Filter chain producing [marked] from [0:v] and the badge input [1:v]. */
function buildFilter(width: number, opts: StampOptions): string {
  const { logo, margin, x, opacity } = badgeLayout(width, opts);

  return (
    `[1:v]scale=${logo}:${logo},format=rgba,colorchannelmixer=aa=${opacity}[logo];` +
    `[0:v][logo]overlay=${x}:H-h-${margin}[marked]`
  );
}

function runFfmpeg(args: string[]): void {
  execFileSync('ffmpeg', ['-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
}

/** Stamp a PNG in place. */
export function stampPng(file: string, opts: StampOptions = {}): void {
  const tmp = `${file}.stamp.png`;

  runFfmpeg([
    '-i', file, '-i', LOGO,
    '-filter_complex', buildFilter(imageSize(file).width, opts),
    '-map', '[marked]', '-frames:v', '1', tmp,
  ]);
  fs.renameSync(tmp, file);
}

/** Stamp an animated GIF in place (overlay on every frame, then the same
 *  two-pass palette capture-rotation.ts uses, so quality and size hold). */
export function stampGif(file: string, opts: StampOptions = {}): void {
  const tmp = `${file}.stamp.gif`;

  runFfmpeg([
    '-i', file, '-i', LOGO,
    '-filter_complex',
    `${buildFilter(imageSize(file).width, opts)};[marked]split[s0][s1];` +
    `[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3[out]`,
    '-map', '[out]', '-loop', '0', tmp,
  ]);
  fs.renameSync(tmp, file);
}

/** Stamp one file in place, dispatching on extension. */
export function stampFile(file: string, opts: StampOptions = {}): void {
  if (/\.gif$/iu.test(file)) {
    stampGif(file, opts);
  } else {
    stampPng(file, opts);
  }
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const args = process.argv.slice(2);
  const insetIdx = args.indexOf('--inset');
  const insetX = Number(insetIdx >= 0 ? args[insetIdx + 1] : 0);
  // Guard the -1 case: without --inset, `insetIdx + 1` is 0 and would silently
  // swallow the first file argument.
  const valueIdx = insetIdx >= 0 ? insetIdx + 1 : -1;
  const files = args.filter((a, i) => !a.startsWith('--') && i !== valueIdx);

  if (!files.length) {
    throw new Error('usage: stamp.ts [--inset px] <files...>');
  }
  for (const file of files) {
    stampFile(file, { insetX });
    console.log(`stamped: ${file}`);
  }
}
