/**
 * /////////////////////////////////////////////////////////////////////////////
 *
 * https://keeptrack.space
 *
 * @Copyright (C) 2025 Kruczek Labs LLC
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

/**
 * Which moons orbit which planet, and the handful of questions everything else asks about
 * that.
 *
 * Deliberately a leaf: this module imports nothing but the `SolarBody` enum. Deriving the
 * table from the moon catalog instead would be tidier on paper, but the catalog reaches
 * `CelestialBody` -> `Scene` -> the plugins, and the Planets menu is one of those plugins -
 * so asking it for the list at module scope closes a cycle and the array is still
 * uninitialized when the menu reads it. That failure mode is silent at build time and shows
 * up as `allPlanetMoons() is empty` on boot.
 *
 * The cost of the split is that this table and `planet-moon-catalog.ts` have to agree; a
 * test in `__tests__/planet-moon-catalog.test.ts` asserts they do.
 *
 * ## Why this is a registry rather than a constant
 *
 * The roster is contributed rather than hard-coded, so a build can ship a different set of
 * moons without this module (or anything that reads it) knowing which build it is in. Content
 * calls {@link registerPlanetSystem} during plugin init, which runs before `Scene.init()` and
 * before the first frame.
 *
 * The consequence for callers: **read the roster through the functions below, never through a
 * module-level constant.** A `const ALL = allPlanetMoons()` at import scope captures whatever
 * had registered by the time that module was first imported, which is a load-order bug waiting
 * to happen. This is the same lazy-evaluation rule the project already applies to `t7e()`
 * lookups in static arrays.
 */
const PLANET_SYSTEM_MOONS_: Partial<Record<SolarBody, readonly SolarBody[]>> = {};

/**
 * Add a planet's moons to the roster, in orbital order outward from the parent.
 *
 * Idempotent per parent by replacement, so re-registering a system during a hot reload or a
 * test reset does not produce duplicates.
 */
export function registerPlanetSystem(parent: SolarBody, moons: readonly SolarBody[]): void {
  PLANET_SYSTEM_MOONS_[parent] = [...moons];
}

/** Drop the whole roster. Test-support only - nothing in the app should need this. */
export function clearPlanetSystems(): void {
  for (const parent of Object.keys(PLANET_SYSTEM_MOONS_)) {
    delete PLANET_SYSTEM_MOONS_[parent as SolarBody];
  }
}

/**
 * The live roster, keyed by parent. Mutated in place by {@link registerPlanetSystem}, so a
 * caller that indexes it at call time always sees the current set - but one that snapshots it
 * at import time does not.
 */
export const PLANET_SYSTEM_MOONS: Readonly<Partial<Record<SolarBody, readonly SolarBody[]>>> = PLANET_SYSTEM_MOONS_;

/**
 * Every moon of another planet, grouped by parent and ordered outward from it.
 *
 * A function, not a constant, because the roster is registered after this module loads.
 */
export function allPlanetMoons(): readonly SolarBody[] {
  return Object.values(PLANET_SYSTEM_MOONS_).flat();
}

/**
 * The planet a moon belongs to, or null for anything that is not a planet moon - including
 * Earth's Moon, which predates this system and is not part of it.
 */
export function parentPlanetOf(body: SolarBody): SolarBody | null {
  for (const [parent, moons] of Object.entries(PLANET_SYSTEM_MOONS_)) {
    if (moons.includes(body)) {
      return parent as SolarBody;
    }
  }

  return null;
}

/**
 * Every body that shares a neighbourhood with `centerBody` and therefore has to be drawn
 * alongside it: a planet's moons, and for a moon its planet plus its siblings.
 *
 * Load-bearing. Only the center body is drawn as a mesh, so a system missing from the table
 * above means centering on Jupiter and seeing no moons at all - or standing on Europa and
 * seeing empty space where Jupiter should fill half the sky.
 */
export function systemCompanionsOf(centerBody: SolarBody): readonly SolarBody[] {
  const ownMoons = PLANET_SYSTEM_MOONS_[centerBody];

  if (ownMoons) {
    return ownMoons;
  }

  const parent = parentPlanetOf(centerBody);

  if (!parent) {
    return [];
  }

  return [parent, ...PLANET_SYSTEM_MOONS_[parent]!.filter((moon) => moon !== centerBody)];
}

/** True when `centerBody` is the given planet or one of its moons. */
export function isInPlanetSystem(centerBody: SolarBody, planet: SolarBody): boolean {
  return centerBody === planet || parentPlanetOf(centerBody) === planet;
}

/*
 * Nothing is seeded here.
 *
 * Every system is contributed: Mars by `mars-moon-catalog.ts` in this build, the rest by the
 * Solar System Pack. Both go through `registerSolarSystemContent()` before the plugins load.
 * A moon that is in the roster but has no body, or vice versa, is the failure mode worth
 * guarding - which is why each catalog registers its roster entries and its bodies together.
 */
