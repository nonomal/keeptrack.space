/* eslint-disable no-console */
/**
 * Extract a first-frame poster JPEG from every <mesh>.mp4 in media-drop/ so the
 * keeptrack-home satellite page <video> has a matching poster (the -hero.png is
 * a different camera angle and aspect, so it jumps when playback starts).
 *
 *   node scripts/mesh-viewer/extract-posters.mjs [--force]
 *
 * Writes <mesh>-poster.jpg next to the mp4; skips existing posters unless
 * --force. Upload with `npm run mesh:upload` (uploader skips unchanged media).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const dropDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'media-drop');
const isForce = process.argv.includes('--force');

const mp4s = fs.readdirSync(dropDir).filter((f) => f.endsWith('.mp4') && !f.startsWith('batch-'));
let written = 0;
let skipped = 0;

for (const file of mp4s) {
  const poster = path.join(dropDir, `${file.slice(0, -'.mp4'.length)}-poster.jpg`);

  if (!isForce && fs.existsSync(poster)) {
    skipped += 1;
    continue;
  }

  execFileSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-i', path.join(dropDir, file),
    '-frames:v', '1',
    '-q:v', '4',
    poster,
  ]);
  written += 1;
}

console.log(`Posters: ${written} written, ${skipped} already present (${mp4s.length} mp4s in ${dropDir}).`);
