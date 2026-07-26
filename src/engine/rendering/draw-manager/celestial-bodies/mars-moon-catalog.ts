/**
 * /////////////////////////////////////////////////////////////////////////////
 *
 * https://keeptrack.space
 *
 * @Copyright (C) 2026 Kruczek Labs LLC
 *
 * KeepTrack is free software: you can redistribute it and/or modify it under the
 * terms of the GNU Affero General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * KeepTrack is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
 * without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License along with
 * KeepTrack. If not, see <http://www.gnu.org/licenses/>.
 *
 * /////////////////////////////////////////////////////////////////////////////
 */

import { SolarBody } from '@app/engine/core/interfaces';
import { AnalyticMoon, PlanetMoonSpec } from './analytic-moon';
import { RegisteredBodyKind, registerBodyProvider } from './body-registry';
import { PlanetColors } from './celestial-body';
import { DEIMOS_SHAPE, PHOBOS_SHAPE } from './irregular-moon-shapes';
import { DEIMOS_ELEMENTS, PHOBOS_ELEMENTS } from './planet-moon-elements';
import { registerPlanetSystem } from './planet-moon-systems';

/**
 * Phobos and Deimos: the moons of another planet that the free build renders.
 *
 * Both are far too small to have relaxed into spheres, so unlike every other moon in the app
 * they carry a procedural shape model rather than a UV sphere - the silhouette is most of
 * what there is to look at. Mean radii are JPL's; they set the mesh size, the camera's
 * minimum zoom, the orbit-path proximity fade and the range at which the dot hands over to
 * the mesh.
 *
 * Every other planet's moons are Solar System Pack content and register themselves the same
 * way from the pack - see docs-local/oss-pro-split-solar-system.md.
 */
const MARS_MOONS: [PlanetMoonSpec, typeof PHOBOS_ELEMENTS][] = [
  [
    {
      name: SolarBody.Phobos,
      parent: SolarBody.Mars,
      radiusKm: 11.08,
      color: PlanetColors.MOON,
      texture: 'phobos',
      highQualityTier: '8k',
      shape: PHOBOS_SHAPE,
    },
    PHOBOS_ELEMENTS,
  ],
  [
    {
      name: SolarBody.Deimos,
      parent: SolarBody.Mars,
      radiusKm: 6.2,
      color: PlanetColors.MOON,
      texture: 'deimos',
      highQualityTier: '4k',
      shape: DEIMOS_SHAPE,
    },
    DEIMOS_ELEMENTS,
  ],
];

/**
 * Contribute the Mars system. Called once, before the plugins load, from
 * `registerSolarSystemContent()`.
 *
 * Registers the roster and the bodies together so the two cannot drift: a build that draws
 * Phobos always lists it under Mars in the menu, and vice versa.
 */
export function registerMarsMoons(): void {
  registerPlanetSystem(
    SolarBody.Mars,
    MARS_MOONS.map(([spec]) => spec.name)
  );

  registerBodyProvider(
    RegisteredBodyKind.Moon,
    MARS_MOONS.map(([spec]) => spec.name),
    () => {
      const built: Partial<Record<SolarBody, AnalyticMoon>> = {};

      for (const [spec, elements] of MARS_MOONS) {
        built[spec.name] = new AnalyticMoon(spec, elements);
      }

      return built;
    }
  );
}
