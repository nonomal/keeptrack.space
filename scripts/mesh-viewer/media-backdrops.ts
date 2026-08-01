/* eslint-disable no-sync */
/**
 * Backdrop rasters for the mesh-media post pipeline: procedural starfields and
 * vertical light gradients, written as PNGs with nothing beyond node:zlib (the
 * repo deliberately has no raster library; ffmpeg consumes these as inputs).
 *
 * Starfields are deterministic per seed string (the mesh name), so re-renders
 * of the same object keep the same sky and diffs stay reviewable.
 */
import * as fs from 'node:fs';
import * as zlib from 'node:zlib';

/** CRC32 (PNG chunk checksums). */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let n = 0; n < 256; n++) {
    let c = n;

    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }

  return table;
})();

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of buf) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const chunk = Buffer.alloc(12 + data.length);

  chunk.writeUInt32BE(data.length, 0);
  chunk.write(type, 4, 'ascii');
  Buffer.from(data).copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);

  return chunk;
}

/** Encode an RGBA buffer (width*height*4) as a PNG file. */
export function writeRgbaPng(file: string, rgba: Uint8Array, width: number, height: number): void {
  const ihdr = Buffer.alloc(13);

  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // compression 0, filter 0, interlace 0

  // Raw scanlines, filter byte 0 per row.
  const raw = Buffer.alloc(height * (1 + width * 4));

  for (let y = 0; y < height; y++) {
    const rowStart = y * (1 + width * 4);

    raw[rowStart] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, rowStart + 1);
  }

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]);

  fs.writeFileSync(file, png);
}

/** mulberry32 PRNG seeded from a string, for stable per-mesh skies. */
function seededRandom(seed: string): () => number {
  let h = 1779033703;

  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }

  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967296;
  };
}

export interface StarfieldOptions {
  /** Dim point stars. */
  starCount: number;
  /** Stars bright enough to earn a soft cross spike. */
  brightCount: number;
  /**
   * Cylindrical sky: stars wrap modulo (width - wrapAppendPx) and the leading
   * wrapAppendPx columns are duplicated at the right edge, so a crop window
   * panning the full core width lands on pixels identical to x=0 - a 360-degree
   * pan loops with no seam.
   */
  wrapAppendPx?: number;
  /**
   * Horizontal motion-streak length in px, for panning skies. Streaks are
   * drawn into the stars (elongated gaussian, PEAK brightness preserved);
   * post-blurring instead would divide each star's peak by the streak length
   * and erase it.
   */
  streakPx?: number;
}

/**
 * Opaque near-black sky with gaussian-falloff stars. Slight per-star warm/cool
 * tint variance keeps it from reading as white noise; bright stars get faint
 * horizontal/vertical spikes.
 */
export function writeStarfieldPng(file: string, width: number, height: number, seed: string, opts: StarfieldOptions): void {
  const rand = seededRandom(seed);
  const rgba = new Uint8Array(width * height * 4);
  const wrapAppendPx = opts.wrapAppendPx ?? 0;
  const coreW = width - wrapAppendPx;

  // Sky base: not pure black, a hair of blue lift so the model's blacks sit
  // in front of it rather than merging with it.
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = 2;
    rgba[i * 4 + 1] = 3;
    rgba[i * 4 + 2] = 6;
    rgba[i * 4 + 3] = 255;
  }

  const plot = (rawX: number, py: number, add: [number, number, number]) => {
    const px = wrapAppendPx > 0 ? ((rawX % coreW) + coreW) % coreW : rawX;

    if (px < 0 || py < 0 || px >= width || py >= height) {
      return;
    }
    const idx = (py * width + px) * 4;

    rgba[idx] = Math.min(255, rgba[idx] + add[0]);
    rgba[idx + 1] = Math.min(255, rgba[idx + 1] + add[1]);
    rgba[idx + 2] = Math.min(255, rgba[idx + 2] + add[2]);
  };

  const streakSigma = (opts.streakPx ?? 0) / 3;
  // Streaked stars light ~20x the pixels of a point star, so pull the peak
  // down or a panning sky overwhelms the model.
  const intensityScale = streakSigma > 0 ? 0.65 : 1;

  const drawStar = (cx: number, cy: number, radius: number, rawIntensity: number, tint: [number, number, number], spikes: boolean) => {
    const intensity = rawIntensity * intensityScale;
    const sx = Math.max(radius, streakSigma);
    const reachX = Math.ceil(sx * 3);
    const reachY = Math.ceil(radius * 3);

    for (let dy = -reachY; dy <= reachY; dy++) {
      for (let dx = -reachX; dx <= reachX; dx++) {
        const falloff = Math.exp(-((dx * dx) / (2 * sx * sx) + (dy * dy) / (2 * radius * radius)));
        const v = intensity * falloff;

        if (v > 1) {
          plot(Math.round(cx) + dx, Math.round(cy) + dy, [v * tint[0], v * tint[1], v * tint[2]]);
        }
      }
    }
    if (spikes) {
      const len = Math.round(radius * 7);

      for (let d = -len; d <= len; d++) {
        const v = intensity * 0.22 * (1 - Math.abs(d) / len);

        plot(Math.round(cx) + d, Math.round(cy), [v * tint[0], v * tint[1], v * tint[2]]);
        // A vertical spike on a motion-streaked star reads as an artifact.
        if (streakSigma === 0) {
          plot(Math.round(cx), Math.round(cy) + d, [v * tint[0], v * tint[1], v * tint[2]]);
        }
      }
    }
  };

  const tintFor = (r: number): [number, number, number] => {
    // Mostly white, a few cool blue and warm orange outliers.
    if (r < 0.15) {
      return [0.75, 0.85, 1];
    }
    if (r < 0.25) {
      return [1, 0.88, 0.72];
    }

    return [1, 1, 1];
  };

  const spawnW = wrapAppendPx > 0 ? coreW : width;

  for (let i = 0; i < opts.starCount; i++) {
    drawStar(rand() * spawnW, rand() * height, 0.45 + rand() * 0.75, 35 + rand() * 120, tintFor(rand()), false);
  }
  for (let i = 0; i < opts.brightCount; i++) {
    drawStar(rand() * spawnW, rand() * height, 1.1 + rand() * 0.9, 160 + rand() * 95, tintFor(rand()), true);
  }

  // Duplicate the leading columns past the core so a full-core pan wraps clean.
  if (wrapAppendPx > 0) {
    for (let y = 0; y < height; y++) {
      const row = y * width * 4;

      rgba.copyWithin(row + coreW * 4, row, row + wrapAppendPx * 4);
    }
  }

  writeRgbaPng(file, rgba, width, height);
}

/**
 * Vertical gradient, `bottom` color at the bottom row fading to black at
 * `stopFraction` of the height. Used as the earthshine tint source: the post
 * pipeline masks it by the model's alpha and screen-blends it, so only the
 * spacecraft's lower surfaces pick up the bounce light.
 */
export function writeVerticalGradientPng(file: string, width: number, height: number, bottom: [number, number, number], stopFraction: number): void {
  const rgba = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const fromBottom = (height - 1 - y) / (height * stopFraction);
    const strength = Math.max(0, 1 - fromBottom) ** 1.6;

    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      rgba[idx] = Math.round(bottom[0] * strength);
      rgba[idx + 1] = Math.round(bottom[1] * strength);
      rgba[idx + 2] = Math.round(bottom[2] * strength);
      rgba[idx + 3] = 255;
    }
  }

  writeRgbaPng(file, rgba, width, height);
}
