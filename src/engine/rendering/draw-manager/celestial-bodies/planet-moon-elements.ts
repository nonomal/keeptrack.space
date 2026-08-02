/**
 * The analytic parent-centric moon model: the element shape, the propagator, and the two
 * Mars moons the free build renders.
 *
 * The other thirteen fitted sets are Solar System Pack content and live in the pack's
 * `moons/outer-moon-elements.ts`. They are the same shape and come from the same fitter, so
 * everything below about how the model works applies to them too; what those particular fits
 * are worth is documented there, beside the constants it describes.
 *
 * Neither Mars moon exists in astronomy-engine (which drives every other body here, and
 * which does cover the Galileans - see `galilean-moon.ts`), and a Chebyshev table is
 * impractical for a 7.65 h orbit, so each is propagated from a secular mean-element model in
 * its own Laplace plane:
 *
 *   node(t)  = node0  + nodeDot  * t
 *   argPe(t) = argPe0 + argPeDot * t
 *   M(t)     = M0     + n        * t
 *
 * The constants are NOT JPL's published mean elements - that table rounds the angles to
 * 0.1 deg and the period to four decimals, which is roughly a full revolution of Phobos
 * drift after five years. They are a least-squares fit of this exact model to JPL Horizons
 * state vectors taken about the planet's body center, produced by an offline fitting tool. Each
 * moon's doc comment carries the span its constants were fitted over and the residual
 * against Horizons across that span.
 *
 * Phobos fits to 39 km and Deimos to 51 km over a century centred on 2026. What matters on
 * screen is the angle rather than the distance, so a residual is best read as a fraction of
 * the orbit radius: for these two that is under 0.3 deg of along-track phase, and well
 * inside the error already contributed by the 600 s position cache on Mars itself.
 */

import type { Kilometers } from '@ootk/src/main';

export interface MoonElements {
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

/*
 * A note on the shapes some of these take. Where the eccentricity is essentially zero the
 * argument of pericenter and the mean anomaly are degenerate - only their sum is observable
 * - so the fitter is free to divide the orbital rate between `argPeDot` and
 * `meanMotionRadPerSec` however it likes, and it does. A near-circular fit can come back
 * with a mean motion at or below zero and the whole rate parked in the apsidal term, or with
 * an eccentricity a hair below zero, which is just a 180 deg relabelling of the apse line.
 * Both are exact in the propagator and in {@link orbitalPeriodSec}, which sums the three
 * rates; neither is a sign of a bad fit.
 */

/** Phobos (Mars): fit +/- 100 yr about 2026, 39 km RMS. */
export const PHOBOS_ELEMENTS: MoonElements = {
  poleRaDeg: 317.7,
  poleDecDeg: 52.9,
  semiMajorAxisKm: 9374.8428,
  eccentricity: 0.01512457,
  inclinationRad: 0.01875216855,
  nodeRad: 2.951302689992,
  nodeDotRadPerSec: -8.803015932438e-8,
  argPeRad: 3.778216683168,
  argPeDotRadPerSec: 1.759402553125e-7,
  meanAnomalyRad: 3.299870728566,
  meanMotionRadPerSec: 2.279452004215e-4,
};

/** Deimos (Mars): fit +/- 100 yr about 2026, 51 km RMS. */
export const DEIMOS_ELEMENTS: MoonElements = {
  poleRaDeg: 316.6,
  poleDecDeg: 53.5,
  semiMajorAxisKm: 23457.4865,
  eccentricity: 0.00026289,
  inclinationRad: 0.03120451988,
  nodeRad: 0.965074946862,
  nodeDotRadPerSec: -3.668789050189e-9,
  argPeRad: 3.820766401313,
  argPeDotRadPerSec: 6.872962608448e-9,
  meanAnomalyRad: 6.030474372647,
  meanMotionRadPerSec: 5.760111663239e-5,
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
const laplaceBasisCache = new WeakMap<MoonElements, { x: number[]; y: number[]; z: number[] }>();

function laplaceBasis(elements: MoonElements) {
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
 * Parent-centric position of the moon in the J2000/ICRF frame, kilometers.
 *
 * The planet's own position is added by the caller, so this is purely the offset from it.
 */
export function moonCentricPositionJ2000(elements: MoonElements, simTime: Date): [Kilometers, Kilometers, Kilometers] {
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
 * Not simply `2*pi / meanMotion`. Two corrections matter:
 *
 * 1. The fitted mean motion is anomalistic - the rate of the mean anomaly, measured from a
 *    pericenter that is itself moving - so the apsidal rate has to be added. Phobos's
 *    apsides precess a full turn every 1.1 years, fast enough that ignoring this puts the
 *    period 10 s per orbit off the published 7 h 39.2 min. For the near-circular moons the
 *    split between the two rates is arbitrary in the first place (see the note above the
 *    constants), so their sum is the only well-defined rate those moons have.
 * 2. The node regresses about the Laplace pole while the other two advance about the orbit
 *    normal, so only the node rate's component along that normal - `nodeDot * cos(i)` -
 *    belongs in the sum. For a prograde, nearly coplanar moon that factor is 1 and can be
 *    dropped, which is why it went unnoticed while only Phobos and Deimos existed. It
 *    cannot be dropped for the five Uranian majors: JPL refers them to the Uranus equator,
 *    where they are retrograde, so cos(i) is -1 and using +nodeDot put every one of their
 *    periods on the wrong side of the published value (Ariel by 0.076%, enough to leave a
 *    visible gap in a ring drawn one period long).
 */
export function orbitalPeriodSec(elements: MoonElements): number {
  const inertialRate = elements.meanMotionRadPerSec + elements.argPeDotRadPerSec + elements.nodeDotRadPerSec * Math.cos(elements.inclinationRad);

  return (Math.PI * 2) / inertialRate;
}
