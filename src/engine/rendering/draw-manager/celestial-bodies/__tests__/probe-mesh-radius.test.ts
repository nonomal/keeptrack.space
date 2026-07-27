import { DEEP_SPACE_SATELLITE_CONFIGS } from '@app/engine/rendering/draw-manager/celestial-bodies/deep-space-satellite-catalog';
import fs from 'fs';
import path from 'path';

/**
 * `meshRadiusM` is what the camera frames a probe on, so it has to describe the mesh that is
 * actually drawn. OBJ positions are authored in real meters and the loader only converts them
 * to world km (x0.001), so the largest vertex magnitude in the OBJ IS the radius in meters -
 * which makes this checkable against the file on disk rather than trusted to a comment. The
 * constant it falls back to was 10x too large once, on the belief that OBJ units were
 * decameters, and nothing caught it.
 */
describe('deep-space probe mesh radii', () => {
  const meshDir = path.join(process.cwd(), 'public', 'meshes');

  /** Largest vertex distance from the model origin, in OBJ units (= meters). */
  const objBoundingRadiusM = (model: string): number => {
    // eslint-disable-next-line no-sync -- one-time filesystem read in a test
    const obj = fs.readFileSync(path.join(meshDir, `${model}.obj`), 'utf8');
    let maxRadius = 0;

    for (const line of obj.split('\n')) {
      if (!line.startsWith('v ')) {
        continue;
      }

      const [x, y, z] = line.slice(2).trim().split(/\s+/u).map(Number);
      const radius = Math.sqrt(x * x + y * y + z * z);

      if (radius > maxRadius) {
        maxRadius = radius;
      }
    }

    return maxRadius;
  };

  it('states a mesh radius for every probe, so none silently takes the fallback', () => {
    const missing = DEEP_SPACE_SATELLITE_CONFIGS.filter((config) => typeof config.meshRadiusM !== 'number').map((config) => config.name);

    expect(missing).toEqual([]);
  });

  it.each(DEEP_SPACE_SATELLITE_CONFIGS.filter((config) => config.model).map((config) => [config.name, config.model as string, config.meshRadiusM] as const))(
    '%s frames on the extent of its %s mesh',
    (_name, model, meshRadiusM) => {
      const actual = objBoundingRadiusM(model);

      // Generous: the stated radius is rounded up to a tidy number, it just may not be a
      // different order of magnitude from the geometry, and it may never crop the model.
      expect(meshRadiusM).toBeGreaterThanOrEqual(actual - 0.1);
      expect(meshRadiusM).toBeLessThan(actual * 2);
    }
  );
});
