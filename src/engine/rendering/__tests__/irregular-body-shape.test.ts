import { PHOBOS_SHAPE } from '@app/engine/rendering/draw-manager/celestial-bodies/irregular-moon-shapes';
import { buildIrregularSurface, IrregularBodyShape, shapeRadius } from '@app/engine/rendering/irregular-body-shape';

const DEG2RAD = Math.PI / 180;

/** Unit direction for a body-fixed latitude/longitude, matching CraterSpec's convention. */
function direction(latDeg: number, lonDeg: number): [number, number, number] {
  const lat = latDeg * DEG2RAD;
  const lon = lonDeg * DEG2RAD;

  return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
}

const SMOOTH_ELLIPSOID: IrregularBodyShape = {
  semiAxesKm: [10, 8, 6],
  craters: [],
  roughnessKm: 0,
  roughnessFrequency: 2,
  seed: 1,
};

describe('irregular-body-shape', () => {
  describe('shapeRadius', () => {
    it('returns the semi-axes along the principal axes with no craters or roughness', () => {
      expect(shapeRadius(SMOOTH_ELLIPSOID, 1, 0, 0)).toBeCloseTo(10, 6);
      expect(shapeRadius(SMOOTH_ELLIPSOID, 0, 1, 0)).toBeCloseTo(8, 6);
      expect(shapeRadius(SMOOTH_ELLIPSOID, 0, 0, 1)).toBeCloseTo(6, 6);
    });

    it('is deterministic for a given seed', () => {
      const first = shapeRadius(PHOBOS_SHAPE, ...direction(12, 34));
      const second = shapeRadius(PHOBOS_SHAPE, ...direction(12, 34));

      expect(first).toBe(second);
    });

    it('digs Stickney in below the surrounding terrain', () => {
      const stickney = PHOBOS_SHAPE.craters[0];
      const atCenter = shapeRadius(PHOBOS_SHAPE, ...direction(stickney.latDeg, stickney.lonDeg));
      // Well outside the crater and its ejecta shoulder.
      const awayFromCrater = shapeRadius(PHOBOS_SHAPE, ...direction(stickney.latDeg, stickney.lonDeg + 90));

      expect(atCenter).toBeLessThan(awayFromCrater - 1);
    });

    it('leaves terrain a long way from any crater untouched by the bowls', () => {
      const withCraters = shapeRadius(PHOBOS_SHAPE, ...direction(0, 60));
      const withoutCraters = shapeRadius({ ...PHOBOS_SHAPE, craters: [] }, ...direction(0, 60));

      expect(withCraters).toBeCloseTo(withoutCraters, 6);
    });

    it('keeps every radius inside a physically sane band for Phobos', () => {
      for (let lat = -90; lat <= 90; lat += 10) {
        for (let lon = 0; lon < 360; lon += 10) {
          const radius = shapeRadius(PHOBOS_SHAPE, ...direction(lat, lon));

          expect(radius).toBeGreaterThan(6);
          expect(radius).toBeLessThan(15);
        }
      }
    });
  });

  describe('buildIrregularSurface', () => {
    const segments = 32;
    const surface = buildIrregularSurface(PHOBOS_SHAPE, segments, segments);
    const stride = 8;
    const vertexCount = surface.combined.length / stride;

    it("emits SphereGeometry's vertex count and interleaved layout", () => {
      expect(vertexCount).toBe((segments + 1) * (segments + 1));
      expect(surface.positions.length).toBe(vertexCount * 3);
      expect(surface.indices.length).toBe(segments * segments * 6);
    });

    it('keeps the longitude seam watertight', () => {
      // The first and last column of each row are the same point on the body.
      for (let row = 0; row <= segments; row++) {
        const first = row * (segments + 1);
        const last = first + segments;

        for (let axis = 0; axis < 3; axis++) {
          expect(surface.combined[last * stride + axis]).toBeCloseTo(surface.combined[first * stride + axis], 6);
        }
      }
    });

    it('emits unit normals that point outward', () => {
      for (let i = 0; i < vertexCount; i++) {
        const o = i * stride;
        const normal = [surface.combined[o + 3], surface.combined[o + 4], surface.combined[o + 5]];
        const position = [surface.combined[o], surface.combined[o + 1], surface.combined[o + 2]];
        const positionLength = Math.hypot(...position);

        expect(Math.hypot(...normal)).toBeCloseTo(1, 5);
        // Outward-facing: within 90 deg of the radial direction everywhere on a star-shaped body.
        expect((normal[0] * position[0] + normal[1] * position[1] + normal[2] * position[2]) / positionLength).toBeGreaterThan(0);
      }
    });

    it('reports the largest vertex radius as the bounding radius', () => {
      let measured = 0;

      for (let i = 0; i < vertexCount; i++) {
        const o = i * stride;

        measured = Math.max(measured, Math.hypot(surface.combined[o], surface.combined[o + 1], surface.combined[o + 2]));
      }

      expect(surface.maxRadiusKm).toBeCloseTo(measured, 6);
    });

    it('produces a body that is genuinely non-spherical', () => {
      let min = Infinity;
      let max = -Infinity;

      for (let i = 0; i < vertexCount; i++) {
        const o = i * stride;
        const radius = Math.hypot(surface.combined[o], surface.combined[o + 1], surface.combined[o + 2]);

        min = Math.min(min, radius);
        max = Math.max(max, radius);
      }

      // Phobos is roughly 13 x 11 x 9 km before craters; anything near 1.0 means the
      // shape model collapsed back to a sphere.
      expect(max / min).toBeGreaterThan(1.3);
    });
  });
});
