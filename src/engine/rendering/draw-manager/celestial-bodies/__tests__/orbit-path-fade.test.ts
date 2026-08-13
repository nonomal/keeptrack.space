import { Camera } from '@app/engine/camera/camera';
import { SolarBody } from '@app/engine/core/interfaces';
import { ServiceLocator } from '@app/engine/core/service-locator';
import { Kilometers } from '@ootk/src/main';
import { CelestialBody } from '../celestial-body';

/**
 * An orbit path is enormous next to the body riding it, so from close up it stops looking
 * like an orbit and becomes a line drawn across whatever you are inspecting. The fade is
 * expressed in body radii precisely so one rule covers a 3389 km planet and an 11 km moon;
 * these cases pin that scale invariance.
 */
class FadeTestBody extends CelestialBody {
  readonly RADIUS: number;
  protected readonly NUM_HEIGHT_SEGS = 4;
  protected readonly NUM_WIDTH_SEGS = 4;

  constructor(radiusKm: number) {
    super();
    this.RADIUS = radiusKm;
  }

  getName(): SolarBody {
    return SolarBody.Mars;
  }

  getTexturePath(): string {
    return '';
  }

  useHighestQualityTexture(): void {
    // Nothing to load in a test double.
  }

  /** Exposes the protected proximity curve. */
  opacityAt(cameraDistanceKm: number): number {
    mockCameraDistanceKm = cameraDistanceKm;

    return this.orbitPathProximityOpacity_();
  }
}

let mockCameraDistanceKm = 0;

beforeEach(() => {
  vi.spyOn(ServiceLocator, 'getMainCamera').mockReturnValue({
    getDistFromEntity: () => mockCameraDistanceKm as Kilometers,
  } as unknown as Camera);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CelestialBody orbit-path proximity fade', () => {
  const mars = new FadeTestBody(3389.5);
  const phobos = new FadeTestBody(11.08);

  it('is fully transparent inside the fade-out radius', () => {
    expect(mars.opacityAt(3389.5 * 50 - 1)).toBe(0);
    expect(phobos.opacityAt(11.08 * 50 - 1)).toBe(0);
  });

  it('is fully opaque beyond the fade-in radius', () => {
    expect(mars.opacityAt(3389.5 * 200 + 1)).toBe(1);
    expect(phobos.opacityAt(11.08 * 200 + 1)).toBe(1);
  });

  it('ramps linearly through the band', () => {
    // Midpoint of the 50-200 radii band.
    expect(mars.opacityAt(3389.5 * 125)).toBeCloseTo(0.5, 6);
    expect(phobos.opacityAt(11.08 * 125)).toBeCloseTo(0.5, 6);
  });

  it('scales with the body, so a moon and a planet fade at the same apparent size', () => {
    for (const fraction of [0.25, 0.5, 0.75]) {
      const radii = 50 + fraction * 150;

      expect(mars.opacityAt(3389.5 * radii)).toBeCloseTo(phobos.opacityAt(11.08 * radii), 6);
    }
  });

  it('never returns a value outside 0-1', () => {
    for (const distance of [0, 1, 1e3, 1e6, 1e12]) {
      const opacity = mars.opacityAt(distance);

      expect(opacity).toBeGreaterThanOrEqual(0);
      expect(opacity).toBeLessThanOrEqual(1);
    }
  });

  it('treats a zero-radius body as 1 km so the curve cannot divide by zero', () => {
    const massless = new FadeTestBody(0);

    expect(Number.isFinite(massless.opacityAt(100))).toBe(true);
    expect(massless.opacityAt(1e6)).toBe(1);
  });
});
