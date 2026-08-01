/**
 * Look-development presets for mesh media (satellite-page GIFs/videos).
 * Selected in capture-rotation.ts via --package a|b|c; every field can be
 * overridden by a CLI flag there, so changing course later is a flag, not a
 * code change.
 *
 *   a  clean-catalog: tilted-axis turntable on black, tonemap + bloom. GIF.
 *   b  in-flight:     slow tilted spin, raking sun, static starfield,
 *                     earthshine + vignette. WebM primary, MP4 fallback.
 *   c  cinematic:     camera ORBIT - the starfield pans a full 360 degrees per
 *                     loop in sync with the yaw sweep (streaked for motion) and
 *                     bobs with the camera nod, fixed sun terminator sweep,
 *                     grain. WebM/MP4 only - the moving background is hostile
 *                     to GIF palettes.
 *
 * The "lean" is applied in post (ffmpeg rotate on an oversized capture, then
 * center-crop): the viewer camera has no roll, and a leaning frame is what
 * makes the spin axis read as tilted rather than turntable-vertical.
 * Ted 2026-08-01 on the first C cut: it read as the SATELLITE spinning, not
 * the camera orbiting. Root cause: capture-time camera motion only moves the
 * model in frame; a static backdrop contradicts it. Hence 'orbit' stars (pan
 * synced to yaw, bob synced to the pitch nod) and no animated lean in C - an
 * oscillating rotate applied to the model alone reads as object wobble.
 * Round 2: stars and model still read as COUNTER-rotating. Measured the
 * frames: both actually sweep the same screen direction - the false percept
 * comes from the lean + pitch nod making the panel long-axis rotate in the
 * IMAGE PLANE, which the eye pairs against the stars' linear pan as counter
 * motion. A real camera orbit puts zero image-plane rotation on the target,
 * so C now runs lean 0, nod 0, lower pitch, and a slower 10 s loop.
 *
 * TODO(tumble): rocket bodies and debris should get an end-over-end tumble
 * when the batch run happens. That needs model-space rotation in the viewer
 * (camera pitch through the poles flips the up-vector), so it is deliberately
 * not a package here yet.
 */

export type StarsMode = 'none' | 'static' | 'orbit';
export type SunMode = 'locked' | 'fixed';
export type MediaFormat = 'gif' | 'webm' | 'mp4';

export interface MediaPackageSpec {
  key: string;
  label: string;
  /** Frames in one seamless loop and the playback rate. */
  frames: number;
  fps: number;
  /** Camera pitch (rad) and one-cycle pitch oscillation amplitude (deg). */
  pitchBaseRad: number;
  pitchOscDeg: number;
  /** Frame lean (deg) and one-cycle lean oscillation amplitude (deg). */
  leanDeg: number;
  leanOscDeg: number;
  /**
   * locked: sun orbits with the camera, azDeg is the offset (baseline look,
   * lighting constant through the loop). fixed: azDeg is absolute, so the
   * lit face stays put and the orbiting view sweeps through the terminator.
   */
  sun: { mode: SunMode; azDeg: number; elDeg: number };
  stars: StarsMode;
  starCount: number;
  brightStarCount: number;
  tonemap: boolean;
  bloom: boolean;
  earthshine: boolean;
  vignette: boolean;
  grain: boolean;
  formats: readonly MediaFormat[];
}

export const MEDIA_PACKAGES: Record<string, MediaPackageSpec> = {
  a: {
    key: 'a',
    label: 'clean-catalog',
    frames: 72,
    fps: 20,
    pitchBaseRad: 0.35,
    pitchOscDeg: 0,
    leanDeg: 10,
    leanOscDeg: 0,
    sun: { mode: 'locked', azDeg: 40, elDeg: 35 },
    stars: 'none',
    starCount: 0,
    brightStarCount: 0,
    tonemap: true,
    bloom: true,
    earthshine: false,
    vignette: false,
    grain: false,
    formats: ['gif'],
  },
  b: {
    key: 'b',
    label: 'in-flight',
    frames: 128,
    fps: 16,
    pitchBaseRad: 0.32,
    pitchOscDeg: 0,
    leanDeg: 12,
    leanOscDeg: 0,
    sun: { mode: 'locked', azDeg: 70, elDeg: 25 },
    stars: 'static',
    starCount: 240,
    brightStarCount: 6,
    tonemap: true,
    bloom: true,
    earthshine: true,
    vignette: true,
    grain: false,
    // Measured 2026-08-01 on milstar: this package as GIF = 12.65 MB (the
    // starfield defeats GIF inter-frame compression) vs 86 KB as WebM and
    // 178 KB as MP4. GIF stays available via an explicit --gif flag only.
    formats: ['webm', 'mp4'],
  },
  c: {
    key: 'c',
    label: 'cinematic',
    frames: 240,
    fps: 24,
    pitchBaseRad: 0.24,
    pitchOscDeg: 0,
    leanDeg: 0,
    leanOscDeg: 0,
    // Elevation 40: with the sun fixed in world azimuth, half the orbit views
    // the backlit side - a higher sun keeps the top surfaces lit through the
    // dark half instead of dropping the model to a silhouette.
    sun: { mode: 'fixed', azDeg: 25, elDeg: 40 },
    // Streaked stars carry far more visual weight per star than points, so
    // the orbit sky runs much sparser than B's static field.
    stars: 'orbit',
    starCount: 110,
    brightStarCount: 8,
    tonemap: true,
    bloom: true,
    earthshine: true,
    vignette: true,
    grain: true,
    formats: ['webm', 'mp4'],
  },
};

/**
 * The production preset (Ted's hybrid pick, 2026-08-01): C's orbit motion for
 * the animations, a GIF option sharing C's motion but on clean black (any
 * starfield makes a GIF enormous - measured 12.65 MB vs 86 KB WebM), and the
 * hero PNG shot with B's camera and look ("b's png files look better because
 * of the angle"). Selected with --package site; emits <mesh>.webm/.mp4/.gif
 * and <mesh>-hero.png with no package suffix.
 */
export const SITE_COMPOSITE = {
  /** Animation capture + WebM/MP4 look. */
  anim: MEDIA_PACKAGES.c,
  /** GIF look: same frames as anim, backdrop-free so the palette survives. */
  gif: {
    ...MEDIA_PACKAGES.c,
    key: 'site-gif',
    label: 'site-gif',
    stars: 'none',
    grain: false,
    vignette: false,
    formats: ['gif'],
  } as MediaPackageSpec,
  /** Hero still: B's angle and grade. */
  hero: MEDIA_PACKAGES.b,
  /** Halve the GIF frame rate: 240 frames at 24 fps is palette poison. */
  gifFramestep: 2,
} as const;

/** True when the capture needs RGBA frames (a backdrop goes underneath). */
export function needsTransparentCapture(spec: MediaPackageSpec): boolean {
  return spec.stars !== 'none' || spec.earthshine;
}

/** Extra capture margin so the post-pass lean rotation never crops geometry. */
export function captureMarginFactor(spec: MediaPackageSpec): number {
  return Math.abs(spec.leanDeg) + Math.abs(spec.leanOscDeg) > 0.01 ? 1.28 : 1;
}
