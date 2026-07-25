import { DEIMOS_ELEMENTS, marsCentricPositionJ2000, orbitalPeriodSec, PHOBOS_ELEMENTS, tdbSecondsPastJ2000 } from '../mars-moon-elements';

/**
 * Truth data: JPL Horizons state vectors for Phobos (401) and Deimos (402) relative to the
 * Mars body center (500@499) in the ICRF frame, one epoch per checked arc.
 *
 * The epochs are the instants Horizons labels them with, which are TDB rather than UTC, so
 * each is shifted back by the same offset the app applies forward. That makes these a test
 * of the elements and the frame rather than of the time scale; the offset itself is pinned
 * independently by the `tdbSecondsPastJ2000` cases below.
 */
const TDB_MINUS_UTC_MS = 69_184;
const HORIZONS_SAMPLES = {
  Phobos: [
    { tdb: '2000-01-01T00:00:00Z', position: [5117.834591337147, 7632.298839745545, 948.8875855802556] },
    { tdb: '2015-06-01T00:00:00Z', position: [8250.660806839865, 3007.97464067338, -2863.804897549583] },
    { tdb: '2026-01-01T00:00:00Z', position: [-2628.223272465979, -8355.789846470192, -2928.528827295728] },
    { tdb: '2035-01-01T00:00:00Z', position: [-3485.369231205511, -8227.883612944042, -2342.103770610284] },
    { tdb: '2045-01-01T00:00:00Z', position: [-3936.642287251955, 6599.210437829213, 5400.86938584059] },
  ],
  Deimos: [
    { tdb: '2000-01-01T00:00:00Z', position: [-19210.10950537068, 3628.376001633492, 12970.71778297925] },
    { tdb: '2015-06-01T00:00:00Z', position: [20143.2926941426, 10986.02600354953, -4858.459863602718] },
    { tdb: '2026-01-01T00:00:00Z', position: [10863.68893177189, 20169.95437505683, 5021.956584935375] },
    { tdb: '2035-01-01T00:00:00Z', position: [12948.01480327734, -14323.54115482884, -13330.63847297686] },
    { tdb: '2045-01-01T00:00:00Z', position: [-20184.91242069916, 1738.07150066142, 11813.94702430163] },
  ],
} as const;

/** The UTC instant the app would be showing when Horizons reports this TDB epoch. */
function simTimeFor(tdb: string): Date {
  return new Date(Date.parse(tdb) - TDB_MINUS_UTC_MS);
}

/**
 * The secular model's own residual against Horizons is 39 km RMS (Phobos) and 51 km
 * (Deimos) with a 152 km worst case over 2000-2050, so this allows a little headroom over
 * the measured maximum without being loose enough to miss a real regression.
 */
const TOLERANCE_KM = 200;

describe('mars-moon-elements', () => {
  describe('tdbSecondsPastJ2000', () => {
    it('converts a UTC date to the TDB seconds Horizons reports', () => {
      // Horizons prints JD 2461041.5 TDB for 2026-01-01 00:00 UTC.
      const expected = (2461041.5 - 2451545.0) * 86400 + 69.184;

      expect(tdbSecondsPastJ2000(new Date('2026-01-01T00:00:00Z'))).toBeCloseTo(expected, 6);
    });

    it('is zero-crossing at the J2000 epoch instant', () => {
      expect(tdbSecondsPastJ2000(new Date('2000-01-01T12:00:00Z'))).toBeCloseTo(69.184, 6);
    });
  });

  describe('orbitalPeriodSec', () => {
    it('reproduces the published Phobos period of 0.3189 days', () => {
      expect(orbitalPeriodSec(PHOBOS_ELEMENTS) / 86400).toBeCloseTo(0.31891, 4);
    });

    it('reproduces the published Deimos period of 1.26244 days', () => {
      // JPL's table prints this rounded to 1.2625.
      expect(orbitalPeriodSec(DEIMOS_ELEMENTS) / 86400).toBeCloseTo(1.26244, 5);
    });

    it('returns the sidereal period, not the faster-precessing anomalistic one', () => {
      // Phobos's apsides turn over in 1.1 years, so the two differ by ~10 s per orbit.
      const anomalistic = (Math.PI * 2) / PHOBOS_ELEMENTS.meanMotionRadPerSec;

      expect(orbitalPeriodSec(PHOBOS_ELEMENTS)).toBeLessThan(anomalistic - 5);
    });
  });

  describe('marsCentricPositionJ2000', () => {
    it.each(HORIZONS_SAMPLES.Phobos)('matches Horizons for Phobos at $tdb', ({ tdb, position }) => {
      const modeled = marsCentricPositionJ2000(PHOBOS_ELEMENTS, simTimeFor(tdb));
      const error = Math.hypot(modeled[0] - position[0], modeled[1] - position[1], modeled[2] - position[2]);

      expect(error).toBeLessThan(TOLERANCE_KM);
    });

    it.each(HORIZONS_SAMPLES.Deimos)('matches Horizons for Deimos at $tdb', ({ tdb, position }) => {
      const modeled = marsCentricPositionJ2000(DEIMOS_ELEMENTS, simTimeFor(tdb));
      const error = Math.hypot(modeled[0] - position[0], modeled[1] - position[1], modeled[2] - position[2]);

      expect(error).toBeLessThan(TOLERANCE_KM);
    });

    it('stays within the eccentricity-implied radius band over a full Phobos orbit', () => {
      const start = new Date('2026-03-01T00:00:00Z').getTime();
      const periodMs = orbitalPeriodSec(PHOBOS_ELEMENTS) * 1000;
      const { semiMajorAxisKm: a, eccentricity: e } = PHOBOS_ELEMENTS;

      for (let step = 0; step < 32; step++) {
        const position = marsCentricPositionJ2000(PHOBOS_ELEMENTS, new Date(start + (step / 32) * periodMs));
        const radius = Math.hypot(position[0], position[1], position[2]);

        expect(radius).toBeGreaterThanOrEqual(a * (1 - e) - 1);
        expect(radius).toBeLessThanOrEqual(a * (1 + e) + 1);
      }
    });

    it('advances the moon by one full revolution over one period', () => {
      const epoch = new Date('2026-03-01T00:00:00Z');
      const start = marsCentricPositionJ2000(PHOBOS_ELEMENTS, epoch);
      const afterOnePeriod = marsCentricPositionJ2000(PHOBOS_ELEMENTS, new Date(epoch.getTime() + orbitalPeriodSec(PHOBOS_ELEMENTS) * 1000));
      const drift = Math.hypot(afterOnePeriod[0] - start[0], afterOnePeriod[1] - start[1], afterOnePeriod[2] - start[2]);

      // Only the precession of the node and apsides should separate the two positions.
      expect(drift).toBeLessThan(50);
    });
  });
});
