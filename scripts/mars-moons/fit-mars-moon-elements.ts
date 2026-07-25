/**
 * Fit the analytic Mars-moon orbit model used by `MarsMoon` to JPL Horizons vectors.
 *
 * JPL's published mean-element table (https://ssd.jpl.nasa.gov/sats/elem/) rounds the
 * angles to 0.1 deg and the period to 4 decimals. For Phobos that is ~16 km of immediate
 * along-track error and roughly a full revolution of drift after five years, so the
 * published numbers are unusable as-is. Instead this pulls real Horizons state vectors
 * (Mars body center, ICRF) and least-squares fits the same 8-parameter secular model the
 * app propagates at runtime:
 *
 *   node(t)  = node0 + nodeDot * t
 *   argPe(t) = argPe0 + argPeDot * t
 *   M(t)     = M0 + n * t
 *
 * ...expressed in each moon's Laplace plane, then rotated to ICRF/J2000. The fit runs
 * Gauss-Newton on the position residual itself (km), so the reported RMS is the number
 * that actually matters. A second pass scores the fitted constants against held-out arcs
 * decades away from the fit span to show how the secular model ages.
 *
 * Output is a ready-to-paste `MarsMoonElements` literal. The constants in
 * `src/engine/rendering/draw-manager/celestial-bodies/mars-moon-elements.ts` came from
 * this script; re-run it to refresh them.
 *
 *   npm run mars-moons:fit
 *   npm run mars-moons:fit -- --refresh    (bypass the local Horizons cache)
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE_DIR = path.join(REPO_ROOT, 'node_modules', '.cache', 'mars-moons');
const HORIZONS_API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

/** Mars GM, km^3/s^2 (JPL MAR099). Only used to seed the fit from osculating elements. */
const GM_MARS = 42828.375214;
const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;
const TAU = Math.PI * 2;
/** Julian date of the J2000.0 epoch, the time origin for every fitted rate. */
const JD_J2000 = 2451545.0;
const SEC_PER_DAY = 86400;

interface MoonSpec {
  name: string;
  /** Horizons body id. */
  command: string;
  /** Laplace plane pole, ICRF right ascension / declination (deg), from JPL's table. */
  poleRaDeg: number;
  poleDecDeg: number;
}

const MOONS: MoonSpec[] = [
  { name: 'Phobos', command: '401', poleRaDeg: 317.7, poleDecDeg: 52.9 },
  { name: 'Deimos', command: '402', poleRaDeg: 316.6, poleDecDeg: 53.5 },
];

/**
 * Dense present-day arc. Its continuous coverage is what makes the seed's angle
 * unwrapping unambiguous, which in turn keeps the wide-span refinement out of a
 * phase-wrapped local minimum.
 */
const SEED_ARC = { start: '2026-01-01', stop: '2026-04-01', step: '15m' };
/**
 * Wide sparse arc the model is actually fitted against. Least squares does not care that
 * a 12 h step aliases a 7.6 h orbit - every sample is an independent (t, r) pair - and
 * spanning five decades stops the secular rates from being tuned to today at the cost of
 * kilometre-scale drift decades out.
 */
const FIT_ARC = { start: '2000-01-01', stop: '2050-01-01', step: '12h' };
/** Arcs used only to score the fit, including one past the end of the fit span. */
const CHECK_ARCS = [
  { start: '2000-01-01', stop: '2000-01-08', step: '30m' },
  { start: '2015-06-01', stop: '2015-06-08', step: '30m' },
  { start: '2026-02-01', stop: '2026-02-08', step: '30m' },
  { start: '2035-01-01', stop: '2035-01-08', step: '30m' },
  { start: '2045-01-01', stop: '2045-01-08', step: '30m' },
  { start: '2060-01-01', stop: '2060-01-08', step: '30m' },
];

interface Sample {
  /** Seconds past J2000.0 in Horizons' TDB time scale. */
  t: number;
  r: [number, number, number];
  v: [number, number, number];
}

type Vec3 = [number, number, number];
/** Row-major 3x3. */
type Mat3 = [Vec3, Vec3, Vec3];

async function fetchHorizons(spec: MoonSpec, arc: { start: string; stop: string; step: string }, refresh: boolean): Promise<Sample[]> {
  const params = new URLSearchParams({
    format: 'text',
    COMMAND: `'${spec.command}'`,
    OBJ_DATA: "'NO'",
    MAKE_EPHEM: "'YES'",
    EPHEM_TYPE: "'VECTORS'",
    // 500@499 is the Mars body center, so the vectors are the Mars-centric offset we model.
    CENTER: "'500@499'",
    START_TIME: `'${arc.start}'`,
    STOP_TIME: `'${arc.stop}'`,
    STEP_SIZE: `'${arc.step}'`,
    VEC_TABLE: "'2'",
    REF_PLANE: "'FRAME'",
    REF_SYSTEM: "'ICRF'",
    OUT_UNITS: "'KM-S'",
    VEC_LABELS: "'NO'",
    CSV_FORMAT: "'YES'",
  });
  const url = `${HORIZONS_API_URL}?${params.toString()}`;
  const cacheFile = path.join(CACHE_DIR, `${spec.command}-${createHash('sha1').update(url).digest('hex').slice(0, 12)}.txt`);

  let text: string;

  if (!refresh && fs.existsSync(cacheFile)) {
    text = fs.readFileSync(cacheFile, 'utf8');
  } else {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Horizons request failed for ${spec.name} (${response.status})`);
    }
    text = await response.text();
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    fs.writeFileSync(cacheFile, text);
  }

  return parseVectors(text, `${spec.name} ${arc.start}`);
}

function parseVectors(text: string, label: string): Sample[] {
  const lines = text.split('\n');
  const soe = lines.findIndex((l) => l.trim() === '$$SOE');
  const eoe = lines.findIndex((l) => l.trim() === '$$EOE');

  if (soe === -1 || eoe === -1) {
    throw new Error(`Horizons returned no ephemeris for ${label}:\n${lines.slice(0, 25).join('\n')}`);
  }

  const samples: Sample[] = [];

  for (const line of lines.slice(soe + 1, eoe)) {
    const cols = line.split(',').map((c) => c.trim());

    if (cols.length < 8) {
      continue;
    }

    const jd = Number(cols[0]);

    samples.push({
      t: (jd - JD_J2000) * SEC_PER_DAY,
      r: [Number(cols[2]), Number(cols[3]), Number(cols[4])],
      v: [Number(cols[5]), Number(cols[6]), Number(cols[7])],
    });
  }

  if (samples.length === 0) {
    throw new Error(`Parsed zero samples for ${label}`);
  }

  return samples;
}

/**
 * Rotation whose rows are the Laplace-plane basis expressed in ICRF: +Z is the Laplace
 * pole and +X is that plane's ascending node on the ICRF equator, matching the frame
 * JPL's Laplace-plane elements are referred to.
 */
function laplaceRotation(poleRaDeg: number, poleDecDeg: number): Mat3 {
  const ra = poleRaDeg * DEG2RAD;
  const dec = poleDecDeg * DEG2RAD;
  const z: Vec3 = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const x: Vec3 = [-Math.sin(ra), Math.cos(ra), 0];
  const y: Vec3 = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];

  return [x, y, z];
}

function rotateToFrame(m: Mat3, v: Vec3): Vec3 {
  return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
}

function rotateToIcrf(m: Mat3, v: Vec3): Vec3 {
  return [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
}

interface Elements {
  a: number;
  e: number;
  i: number;
  node: number;
  argPe: number;
  m: number;
}

/** Osculating classical elements from a Laplace-frame state vector. */
function stateToElements(r: Vec3, v: Vec3): Elements {
  const rMag = Math.hypot(r[0], r[1], r[2]);
  const vMag2 = v[0] ** 2 + v[1] ** 2 + v[2] ** 2;
  const h: Vec3 = [r[1] * v[2] - r[2] * v[1], r[2] * v[0] - r[0] * v[2], r[0] * v[1] - r[1] * v[0]];
  const hMag = Math.hypot(h[0], h[1], h[2]);
  const rDotV = r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  const eVec: Vec3 = [
    (vMag2 - GM_MARS / rMag) * (r[0] / GM_MARS) - (rDotV / GM_MARS) * v[0],
    (vMag2 - GM_MARS / rMag) * (r[1] / GM_MARS) - (rDotV / GM_MARS) * v[1],
    (vMag2 - GM_MARS / rMag) * (r[2] / GM_MARS) - (rDotV / GM_MARS) * v[2],
  ];
  const e = Math.hypot(eVec[0], eVec[1], eVec[2]);
  const a = 1 / (2 / rMag - vMag2 / GM_MARS);
  const i = Math.acos(Math.max(-1, Math.min(1, h[2] / hMag)));
  const node = Math.atan2(h[0], -h[1]);
  // Argument of latitude, then back out the true anomaly - stable at tiny eccentricity.
  const u = Math.atan2(r[2] / Math.sin(i || 1e-12), r[0] * Math.cos(node) + r[1] * Math.sin(node));
  const trueAnomaly = Math.atan2(rDotV / (hMag / GM_MARS) / GM_MARS, 1 - rMag / a);
  const eccAnomaly = Math.atan2(Math.sqrt(1 - e ** 2) * Math.sin(trueAnomaly), e + Math.cos(trueAnomaly));

  return {
    a,
    e,
    i,
    node,
    argPe: u - trueAnomaly,
    m: eccAnomaly - e * Math.sin(eccAnomaly),
  };
}

/** Fitted secular model: 8 parameters, angles in radians, rates in radians/second. */
interface FitParams {
  a: number;
  e: number;
  i: number;
  node0: number;
  nodeDot: number;
  argPe0: number;
  argPeDot: number;
  m0: number;
  n: number;
}

const PARAM_KEYS: (keyof FitParams)[] = ['a', 'e', 'i', 'node0', 'nodeDot', 'argPe0', 'argPeDot', 'm0', 'n'];

function solveKepler(m: number, e: number): number {
  let eccAnomaly = m;

  for (let iter = 0; iter < 12; iter++) {
    const delta = (eccAnomaly - e * Math.sin(eccAnomaly) - m) / (1 - e * Math.cos(eccAnomaly));

    eccAnomaly -= delta;
    if (Math.abs(delta) < 1e-14) {
      break;
    }
  }

  return eccAnomaly;
}

/** Propagate the secular model to time `t` (seconds past J2000 TDB), Laplace frame. */
function propagate(p: FitParams, t: number): Vec3 {
  const node = p.node0 + p.nodeDot * t;
  const argPe = p.argPe0 + p.argPeDot * t;
  const eccAnomaly = solveKepler(p.m0 + p.n * t, p.e);
  const xOrb = p.a * (Math.cos(eccAnomaly) - p.e);
  const yOrb = p.a * Math.sqrt(1 - p.e ** 2) * Math.sin(eccAnomaly);
  const cosW = Math.cos(argPe);
  const sinW = Math.sin(argPe);
  const xPeri = xOrb * cosW - yOrb * sinW;
  const yPeri = xOrb * sinW + yOrb * cosW;
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosI = Math.cos(p.i);
  const sinI = Math.sin(p.i);

  return [xPeri * cosNode - yPeri * cosI * sinNode, xPeri * sinNode + yPeri * cosI * cosNode, yPeri * sinI];
}

function residualRms(p: FitParams, samples: Sample[], m: Mat3): { rms: number; max: number } {
  let sumSq = 0;
  let max = 0;

  for (const s of samples) {
    const model = rotateToIcrf(m, propagate(p, s.t));
    const d = Math.hypot(model[0] - s.r[0], model[1] - s.r[1], model[2] - s.r[2]);

    sumSq += d * d;
    max = Math.max(max, d);
  }

  return { rms: Math.sqrt(sumSq / samples.length), max };
}

/** Seed the fit by averaging osculating elements and regressing the angles linearly. */
function initialGuess(samples: Sample[], m: Mat3): FitParams {
  const els = samples.map((s) => ({ t: s.t, el: stateToElements(rotateToFrame(m, s.r), rotateToFrame(m, s.v)) }));
  const mean = (pick: (e: Elements) => number) => els.reduce((acc, cur) => acc + pick(cur.el), 0) / els.length;
  // Unwrap so the regression sees a monotone angle instead of 2pi sawteeth.
  const unwrap = (pick: (e: Elements) => number): number[] => {
    const out: number[] = [];
    let offset = 0;

    els.forEach((cur, idx) => {
      const raw = pick(cur.el);

      if (idx > 0) {
        const prev = pick(els[idx - 1].el);

        if (raw - prev > Math.PI) {
          offset -= TAU;
        } else if (prev - raw > Math.PI) {
          offset += TAU;
        }
      }
      out.push(raw + offset);
    });

    return out;
  };
  const regress = (values: number[]): { intercept: number; slope: number } => {
    const n = values.length;
    let sumT = 0;
    let sumY = 0;
    let sumTT = 0;
    let sumTY = 0;

    els.forEach((cur, idx) => {
      sumT += cur.t;
      sumY += values[idx];
      sumTT += cur.t * cur.t;
      sumTY += cur.t * values[idx];
    });

    const slope = (n * sumTY - sumT * sumY) / (n * sumTT - sumT * sumT);

    return { slope, intercept: (sumY - slope * sumT) / n };
  };

  const node = regress(unwrap((e) => e.node));
  // Mean longitude is the only well-conditioned angle at small eccentricity.
  const meanLon = regress(unwrap((e) => e.node + e.argPe + e.m));
  const periLon = regress(unwrap((e) => e.node + e.argPe));

  return {
    a: mean((e) => e.a),
    e: mean((e) => e.e),
    i: mean((e) => e.i),
    node0: node.intercept,
    nodeDot: node.slope,
    argPe0: periLon.intercept - node.intercept,
    argPeDot: periLon.slope - node.slope,
    m0: meanLon.intercept - periLon.intercept,
    n: meanLon.slope - periLon.slope,
  };
}

/** Damped Gauss-Newton with a numerical Jacobian, minimizing position error in km. */
function refine(seed: FitParams, samples: Sample[], m: Mat3): FitParams {
  // Per-parameter finite-difference steps: distances in km, angles in rad, rates in rad/s.
  const steps: Record<keyof FitParams, number> = {
    a: 1e-3,
    e: 1e-9,
    i: 1e-9,
    node0: 1e-9,
    nodeDot: 1e-16,
    argPe0: 1e-9,
    argPeDot: 1e-16,
    m0: 1e-9,
    n: 1e-16,
  };
  let current = { ...seed };
  let best = residualRms(current, samples, m).rms;

  for (let iter = 0; iter < 40; iter++) {
    const nParams = PARAM_KEYS.length;
    const ata = Array.from({ length: nParams }, () => new Float64Array(nParams));
    const atb = new Float64Array(nParams);

    for (const s of samples) {
      const base = rotateToIcrf(m, propagate(current, s.t));
      const jac: number[][] = [];

      for (const key of PARAM_KEYS) {
        const bumped = { ...current, [key]: current[key] + steps[key] };
        const shifted = rotateToIcrf(m, propagate(bumped, s.t));

        jac.push([(shifted[0] - base[0]) / steps[key], (shifted[1] - base[1]) / steps[key], (shifted[2] - base[2]) / steps[key]]);
      }

      const resid: Vec3 = [s.r[0] - base[0], s.r[1] - base[1], s.r[2] - base[2]];

      for (let row = 0; row < nParams; row++) {
        for (let axis = 0; axis < 3; axis++) {
          atb[row] += jac[row][axis] * resid[axis];
          for (let col = 0; col < nParams; col++) {
            ata[row][col] += jac[row][axis] * jac[col][axis];
          }
        }
      }
    }

    let applied = false;

    // Levenberg-style damping: keep raising lambda until the step actually helps.
    for (let lambda = 1e-9; lambda < 1e6; lambda *= 10) {
      const delta = solveNormalEquations(ata, atb, lambda);

      if (!delta) {
        continue;
      }

      const candidate = { ...current };

      PARAM_KEYS.forEach((key, idx) => {
        candidate[key] = current[key] + delta[idx];
      });

      const score = residualRms(candidate, samples, m).rms;

      if (score < best) {
        best = score;
        current = candidate;
        applied = true;
        break;
      }
    }

    if (!applied) {
      break;
    }
  }

  return current;
}

/** Cholesky-free Gaussian elimination on (AtA + lambda*diag)x = Atb. */
function solveNormalEquations(ata: Float64Array[], atb: Float64Array, lambda: number): number[] | null {
  const n = atb.length;
  const mat = ata.map((row, idx) => {
    const copy = Array.from(row);

    copy[idx] += lambda * (copy[idx] || 1);

    return copy;
  });
  const rhs = Array.from(atb);

  for (let col = 0; col < n; col++) {
    let pivot = col;

    for (let row = col + 1; row < n; row++) {
      if (Math.abs(mat[row][col]) > Math.abs(mat[pivot][col])) {
        pivot = row;
      }
    }
    if (Math.abs(mat[pivot][col]) < 1e-30) {
      return null;
    }
    [mat[col], mat[pivot]] = [mat[pivot], mat[col]];
    [rhs[col], rhs[pivot]] = [rhs[pivot], rhs[col]];

    for (let row = col + 1; row < n; row++) {
      const factor = mat[row][col] / mat[col][col];

      for (let k = col; k < n; k++) {
        mat[row][k] -= factor * mat[col][k];
      }
      rhs[row] -= factor * rhs[col];
    }
  }

  const out = new Array<number>(n).fill(0);

  for (let row = n - 1; row >= 0; row--) {
    let sum = rhs[row];

    for (let col = row + 1; col < n; col++) {
      sum -= mat[row][col] * out[col];
    }
    out[row] = sum / mat[row][row];
  }

  return out.every((value) => Number.isFinite(value)) ? out : null;
}

function wrapTau(angle: number): number {
  return ((angle % TAU) + TAU) % TAU;
}

function formatConstants(spec: MoonSpec, p: FitParams): string {
  return [
    `  ${spec.name}: {`,
    `    poleRaDeg: ${spec.poleRaDeg},`,
    `    poleDecDeg: ${spec.poleDecDeg},`,
    `    semiMajorAxisKm: ${p.a.toFixed(4)},`,
    `    eccentricity: ${p.e.toFixed(8)},`,
    `    inclinationRad: ${p.i.toFixed(12)},`,
    `    nodeRad: ${wrapTau(p.node0).toFixed(12)},`,
    `    nodeDotRadPerSec: ${p.nodeDot.toExponential(12)},`,
    `    argPeRad: ${wrapTau(p.argPe0).toFixed(12)},`,
    `    argPeDotRadPerSec: ${p.argPeDot.toExponential(12)},`,
    `    meanAnomalyRad: ${wrapTau(p.m0).toFixed(12)},`,
    `    meanMotionRadPerSec: ${p.n.toExponential(12)},`,
    '  },',
  ].join('\n');
}

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh');
  const blocks: string[] = [];

  for (const spec of MOONS) {
    const rotation = laplaceRotation(spec.poleRaDeg, spec.poleDecDeg);
    const seedSamples = await fetchHorizons(spec, SEED_ARC, refresh);
    const fitSamples = await fetchHorizons(spec, FIT_ARC, refresh);
    const seed = refine(initialGuess(seedSamples, rotation), seedSamples, rotation);
    const fitted = refine(seed, fitSamples, rotation);
    const seedScore = residualRms(seed, fitSamples, rotation);
    const fitScore = residualRms(fitted, fitSamples, rotation);

    console.log(`\n=== ${spec.name} (${fitSamples.length} samples, ${FIT_ARC.start}..${FIT_ARC.stop}) ===`);
    console.log(`  period            ${(TAU / fitted.n / 3600).toFixed(6)} h`);
    console.log(`  node precession   ${(TAU / fitted.nodeDot / SEC_PER_DAY / 365.25).toFixed(3)} yr`);
    console.log(`  apsis precession  ${(TAU / fitted.argPeDot / SEC_PER_DAY / 365.25).toFixed(3)} yr`);
    console.log(`  a ${fitted.a.toFixed(3)} km   e ${fitted.e.toFixed(6)}   i ${(fitted.i * RAD2DEG).toFixed(4)} deg`);
    console.log(`  present-day-only fit, scored over the wide span: rms ${seedScore.rms.toFixed(2)} km  max ${seedScore.max.toFixed(2)} km`);
    console.log(`  wide-span fit, scored over the wide span:        rms ${fitScore.rms.toFixed(2)} km  max ${fitScore.max.toFixed(2)} km`);

    for (const arc of CHECK_ARCS) {
      const checkSamples = await fetchHorizons(spec, arc, refresh);
      const score = residualRms(fitted, checkSamples, rotation);

      console.log(`  check ${arc.start}  rms ${score.rms.toFixed(2)} km  max ${score.max.toFixed(2)} km`);
    }

    blocks.push(formatConstants(spec, fitted));
  }

  console.log('\n--- paste into mars-moon-elements.ts ---\n');
  console.log(blocks.join('\n'));
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
