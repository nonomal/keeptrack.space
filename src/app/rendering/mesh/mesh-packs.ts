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

import { errorManagerInstance } from '@app/engine/utils/errorManager';

/**
 * Registers every satellite mesh pack this build ships, before anything can resolve a model.
 *
 * The free build's models are baked into `SatelliteModels` and need no registration; this is
 * only for packs whose meshes ship separately, which today means the Pro hero-spacecraft pack
 * (89 named spacecraft, copied into `meshes/` by the pro webpack config).
 *
 * `src/keeptrack.ts` calls this before the plugins load so the model pickers in the
 * ephemeris-import menus - which build their `<option>` lists inside their own `init()` - see
 * the full roster. The resolver itself is forgiving about ordering: the mesh manager
 * re-resolves every frame, so a late registration would still take effect on the next one.
 */
export async function registerMeshPacks(): Promise<void> {
  /*
   * Guarded by __IS_PRO__ rather than a try/catch alone so the bundler drops the import
   * outright in an OSS build - the same pattern plugin-manifest.ts and solar-system-content.ts
   * use for pro content. The catch is for a pro build whose submodule is missing or failed to
   * compile: those spacecraft should fall back to their shape-routed generics rather than
   * taking the whole app down.
   */
  if (__IS_PRO__) {
    try {
      const pack = await import(/* @vite-ignore */ '@plugins-pro/hero-meshes/hero-meshes');

      pack.registerHeroMeshes();
    } catch (error) {
      errorManagerInstance.warn(`Hero spacecraft meshes unavailable, falling back to the generic models: ${error}`);
    }
  }
}
