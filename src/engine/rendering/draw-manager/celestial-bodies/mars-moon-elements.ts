/**
 * Analytic Mars-centric ephemerides for Phobos and Deimos.
 *
 * Neither moon exists in astronomy-engine (which drives every other body here) and a
 * Chebyshev table is impractical for a 7.65 h orbit, so both are propagated from a
 * secular mean-element model in each moon's Laplace plane:
 *
 *   node(t)  = node0  + nodeDot  * t
 *   argPe(t) = argPe0 + argPeDot * t
 *   M(t)     = M0     + n        * t
 *
 * The constants are NOT JPL's published mean elements - that table rounds the angles to
 * 0.1 deg and the period to four decimals, which is roughly a full revolution of Phobos
 * drift after five years. They are a least-squares fit of this exact model to JPL Horizons
 * state vectors sampled every 12 h from 2000 through 2050, produced by
 * `npm run mars-moons:fit`. Residual against Horizons over that span:
 *
 *   Phobos  39 km RMS, 89 km max      Deimos  51 km RMS, 152 km max
 *
 * ...growing to roughly 210 km by 2060, ten years past the end of the fit span. For scale,
 * Phobos orbits 9375 km from Mars, so that worst case is under 1.3 deg of along-track
 * phase - and well inside the error already contributed by the 600 s position cache on
 * Mars itself.
 */

import type { Kilometers } from '@ootk/src/main';

export interface MarsMoonElements {
  /** Laplace plane pole, ICRF right ascension, degrees (JPL). */
  poleRaDeg: number;
  /** Laplace plane pole, ICRF declination, degrees (JPL). */
  poleDecDeg: number;
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationRad: number;
  /** Longitude of the ascending node at J2000, radians. */
  nodeRad: number;
  nodeDotRadPerSec: number;
  /** Argument of pericenter at J2000, radians. */
  argPeRad: number;
  argPeDotRadPerSec: number;
  /** Mean anomaly at J2000, radians. */
  meanAnomalyRad: number;
  meanMotionRadPerSec: number;
}

export const PHOBOS_ELEMENTS: MarsMoonElements = {
  poleRaDeg: 317.7,
  poleDecDeg: 52.9,
  semiMajorAxisKm: 9374.8428,
  eccentricity: 0.0151246,
  inclinationRad: 0.01875216857,
  nodeRad: 2.951351321248,
  nodeDotRadPerSec: -8.803022377968e-8,
  argPeRad: 3.778216747395,
  argPeDotRadPerSec: 1.759402685125e-7,
  meanAnomalyRad: 3.299822214285,
  meanMotionRadPerSec: 2.279452004726e-4,
};

export const DEIMOS_ELEMENTS: MarsMoonElements = {
  poleRaDeg: 316.6,
  poleDecDeg: 53.5,
  semiMajorAxisKm: 23457.4864,
  eccentricity: 0.00024565,
  inclinationRad: 0.031204519756,
  nodeRad: 0.96498916733,
  nodeDotRadPerSec: -3.668702791562e-9,
  argPeRad: 4.28370020888,
  argPeDotRadPerSec: 6.423131070477e-9,
  meanAnomalyRad: 5.567628540421,
  meanMotionRadPerSec: 5.760156637773e-5,
};

const DEG2RAD = Math.PI / 180;
/** Unix ms at 2000-01-01 12:00:00 UTC, the civil instant nearest the J2000 epoch. */
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
/**
 * TDB - UTC, seconds. The fit's time argument is TDB (Horizons' scale) while the app runs
 * on UTC, and 69 s of Phobos motion is 14 km, so the offset cannot be dropped. Leap seconds
 * have been frozen at 37 since 2017; the resulting sub-second error before then is worth
 * about 1 km, an order of magnitude under the model's own residual.
 */
const TDB_MINUS_UTC_SEC = 69.184;

/** Seconds past the J2000 epoch in TDB, the time argument every fitted rate expects. */
export function tdbSecondsPastJ2000(simTime: Date): number {
  return (simTime.getTime() - J2000_UTC_MS) / 1000 + TDB_MINUS_UTC_SEC;
}

/**
 * Rows of the rotation taking an ICRF vector into the moon's Laplace frame: +Z is the
 * Laplace pole, +X that plane's ascending node on the ICRF equator. Cached per element
 * set because it only depends on the (constant) pole.
 */
const laplaceBasisCache = new WeakMap<MarsMoonElements, { x: number[]; y: number[]; z: number[] }>();

function laplaceBasis(elements: MarsMoonElements) {
  const cached = laplaceBasisCache.get(elements);

  if (cached) {
    return cached;
  }

  const ra = elements.poleRaDeg * DEG2RAD;
  const dec = elements.poleDecDeg * DEG2RAD;
  const z = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const x = [-Math.sin(ra), Math.cos(ra), 0];
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  const basis = { x, y, z };

  laplaceBasisCache.set(elements, basis);

  return basis;
}

function solveKepler(meanAnomaly: number, eccentricity: number): number {
  let eccAnomaly = meanAnomaly;

  for (let iter = 0; iter < 8; iter++) {
    const delta = (eccAnomaly - eccentricity * Math.sin(eccAnomaly) - meanAnomaly) / (1 - eccentricity * Math.cos(eccAnomaly));

    eccAnomaly -= delta;
    if (Math.abs(delta) < 1e-12) {
      break;
    }
  }

  return eccAnomaly;
}

/**
 * Mars-centric position of the moon in the J2000/ICRF frame, kilometers.
 *
 * Mars's own position is added by the caller, so this is purely the offset from the planet.
 */
export function marsCentricPositionJ2000(elements: MarsMoonElements, simTime: Date): [Kilometers, Kilometers, Kilometers] {
  const t = tdbSecondsPastJ2000(simTime);
  const node = elements.nodeRad + elements.nodeDotRadPerSec * t;
  const argPe = elements.argPeRad + elements.argPeDotRadPerSec * t;
  const eccAnomaly = solveKepler(elements.meanAnomalyRad + elements.meanMotionRadPerSec * t, elements.eccentricity);
  const xOrb = elements.semiMajorAxisKm * (Math.cos(eccAnomaly) - elements.eccentricity);
  const yOrb = elements.semiMajorAxisKm * Math.sqrt(1 - elements.eccentricity ** 2) * Math.sin(eccAnomaly);
  const cosArgPe = Math.cos(argPe);
  const sinArgPe = Math.sin(argPe);
  const xPeri = xOrb * cosArgPe - yOrb * sinArgPe;
  const yPeri = xOrb * sinArgPe + yOrb * cosArgPe;
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosInc = Math.cos(elements.inclinationRad);
  const sinInc = Math.sin(elements.inclinationRad);
  // Position in the Laplace frame.
  const lx = xPeri * cosNode - yPeri * cosInc * sinNode;
  const ly = xPeri * sinNode + yPeri * cosInc * cosNode;
  const lz = yPeri * sinInc;
  const { x, y, z } = laplaceBasis(elements);

  // Laplace frame back to ICRF (transpose of the basis rows).
  return [(x[0] * lx + y[0] * ly + z[0] * lz) as Kilometers, (x[1] * lx + y[1] * ly + z[1] * lz) as Kilometers, (x[2] * lx + y[2] * ly + z[2] * lz) as Kilometers];
}

/**
 * Sidereal orbital period of the moon, seconds - the time to return to the same inertial
 * direction, which is what closes the drawn orbit ring.
 *
 * Not simply `2*pi / meanMotion`: the fitted mean motion is anomalistic (the rate of the
 * mean anomaly, measured from a pericenter that is itself moving). Phobos's apsides
 * precess a full turn every 1.1 years, which is fast enough that ignoring the difference
 * would put the period 10 s per orbit off the published 7 h 39.2 min.
 */
export function orbitalPeriodSec(elements: MarsMoonElements): number {
  return (Math.PI * 2) / (elements.meanMotionRadPerSec + elements.argPeDotRadPerSec + elements.nodeDotRadPerSec);
}
