import type { Venus } from '../venus';
import { CLOUD_ROTATION_PERIOD_DAYS, SURFACE_ROTATION_PERIOD_DAYS, VENUS_CLOUD_TOP_ALTITUDE_KM, VENUS_RADIUS_KM, VenusAtmosphere } from '../venus-atmosphere';

const MS_PER_DAY = 86400000;
/** Same reference instant the module measures the super-rotation from. */
const J2000_UTC_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const RAD2DEG = 180 / Math.PI;

/**
 * The cloud period is a tuning knob (it is deliberately run faster than the physical 4.2 days
 * so the motion reads at 1x time), so these assertions pin the RELATIONSHIP between the two
 * periods rather than a literal rate - tuning the spin must not turn the suite red.
 */
const SURFACE_PERIOD_DAYS = SURFACE_ROTATION_PERIOD_DAYS;
const CLOUD_PERIOD_DAYS = CLOUD_ROTATION_PERIOD_DAYS;

/**
 * A Venus with a fixed attitude. The shell only ever reads `position` and `rotation` off
 * the parent body, so nothing here needs a GL context or the astronomy ephemeris.
 */
function makeVenusStub(): Venus {
  return {
    position: [1e8, -2e8, 3e7],
    rotation: [0.11, 0.22, 0.33],
  } as unknown as Venus;
}

/** Folds an angle difference into (-180, 180] so the module's `% 360` wrap doesn't matter. */
function normalizeDeg(deg: number): number {
  return ((((deg + 180) % 360) + 360) % 360) - 180;
}

/** Degrees the cloud deck has turned relative to the surface at `simTime`. */
function relativeSpinDeg(atmosphere: VenusAtmosphere, venus: Venus, simTime: Date): number {
  atmosphere.updatePosition(simTime);

  return normalizeDeg((atmosphere.rotation[2] - venus.rotation[2]) * RAD2DEG);
}

/**
 * Sampling window for the rate measurements, in days. Short enough that the deck cannot turn
 * a full half-revolution within it at any plausible cloud period, so the wrap never aliases
 * the measured rate (a whole day would, at the tuned-fast period).
 */
const RATE_SAMPLE_DAYS = 0.01;

/** Measured relative spin rate in deg/day, differentiated across {@link RATE_SAMPLE_DAYS}. */
function relativeSpinRateDegPerDay(atmosphere: VenusAtmosphere, venus: Venus, atDay: number): number {
  const before = relativeSpinDeg(atmosphere, venus, new Date(J2000_UTC_MS + atDay * MS_PER_DAY));
  const after = relativeSpinDeg(atmosphere, venus, new Date(J2000_UTC_MS + (atDay + RATE_SAMPLE_DAYS) * MS_PER_DAY));

  return normalizeDeg(after - before) / RATE_SAMPLE_DAYS;
}

describe('VenusAtmosphere', () => {
  it('sits above the surface at the cloud-top altitude', () => {
    const atmosphere = new VenusAtmosphere(makeVenusStub());

    expect(atmosphere.RADIUS).toBeCloseTo(VENUS_RADIUS_KM + VENUS_CLOUD_TOP_ALTITUDE_KM, 6);
    expect(atmosphere.RADIUS).toBeGreaterThan(VENUS_RADIUS_KM);
  });

  it('is transparent enough to leave the surface visible', () => {
    const atmosphere = new VenusAtmosphere(makeVenusStub());

    expect(atmosphere.opacity).toBeGreaterThan(0);
    expect(atmosphere.opacity).toBeLessThan(1);
  });

  it('tracks the parent body position without aliasing its array', () => {
    const venus = makeVenusStub();
    const atmosphere = new VenusAtmosphere(venus);

    atmosphere.updatePosition(new Date(J2000_UTC_MS));

    expect(atmosphere.position).toEqual(venus.position);
    expect(atmosphere.position).not.toBe(venus.position);
  });

  it('inherits the pole orientation so it spins on the same axis as the surface', () => {
    const venus = makeVenusStub();
    const atmosphere = new VenusAtmosphere(venus);

    atmosphere.updatePosition(new Date(J2000_UTC_MS + 12 * MS_PER_DAY));

    expect(atmosphere.rotation[0]).toBe(venus.rotation[0]);
    expect(atmosphere.rotation[1]).toBe(venus.rotation[1]);
  });

  it('laps the surface once per cloud-rotation period, retrograde', () => {
    const venus = makeVenusStub();
    const atmosphere = new VenusAtmosphere(venus);
    // Retrograde: the deck runs the same way the ground does, only far faster. The surface
    // term cancels the spin Venus's own rotation already carries.
    const expectedRateDegPerDay = -360 / CLOUD_PERIOD_DAYS + 360 / SURFACE_PERIOD_DAYS;

    expect(relativeSpinDeg(atmosphere, venus, new Date(J2000_UTC_MS))).toBeCloseTo(0, 6);
    expect(relativeSpinRateDegPerDay(atmosphere, venus, 0)).toBeCloseTo(expectedRateDegPerDay, 6);
    expect(expectedRateDegPerDay).toBeLessThan(0);
  });

  it('stays continuous across the 360-degree wrap far from the epoch', () => {
    const venus = makeVenusStub();
    const atmosphere = new VenusAtmosphere(venus);
    const daysOut = 9700; // roughly the present day, millions of degrees of accumulated spin
    const expectedRateDegPerDay = -360 / CLOUD_PERIOD_DAYS + 360 / SURFACE_PERIOD_DAYS;

    expect(relativeSpinRateDegPerDay(atmosphere, venus, daysOut)).toBeCloseTo(expectedRateDegPerDay, 3);
  });

  it('turns fast enough against the surface to be visibly a separate layer', () => {
    const venus = makeVenusStub();
    const atmosphere = new VenusAtmosphere(venus);
    const deckRate = Math.abs(relativeSpinRateDegPerDay(atmosphere, venus, 0));
    const surfaceDegPerDay = 360 / SURFACE_PERIOD_DAYS;

    // The whole point of the shell: it must not read as painted onto the ground.
    expect(deckRate).toBeGreaterThan(surfaceDegPerDay * 50);
  });
});
