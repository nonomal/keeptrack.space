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

import { BufferGeometry } from '@app/engine/rendering/buffer-geometry';
import { IrregularBodyGeometry } from '@app/engine/rendering/irregular-body-geometry';
import { IrregularBodyShape } from '@app/engine/rendering/irregular-body-shape';
import { settingsManager } from '@app/settings/settings';
import { DEG2RAD, SpaceObjectType } from '@ootk/src/main';
import { ChebyshevBody } from './chebyshev-body';

/** Texture resolutions every asteroid ships. */
export enum AsteroidTextureQuality {
  POTATO = '512',
  /** Procedural regolith maps top out here; Vesta has real imagery and overrides it. */
  HIGH = '2k',
}

/** Milliseconds per day, for the spin phase. */
const MS_PER_DAY = 86400000;
/** J2000.0 epoch (2000-01-01 12:00 TT), the reference for every published spin element. */
const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 11, 58, 55, 816);

/**
 * A main-belt asteroid rendered as a real body: JPL Horizons ephemeris compressed to
 * Chebyshev coefficients, a measured triaxial shape rather than a sphere, and its own spin.
 *
 * Distinct from {@link DwarfPlanet} (Ceres) on two counts that matter to the renderer. First,
 * these bodies are irregular - Vesta is 573 by 446 km, and drawing that as a sphere is wrong
 * in the silhouette, which is the only thing you can see from any distance. Second, they are
 * NOT tidally locked to anything, so unlike the moons in planet-moon.ts their orientation
 * comes from a published pole and rotation rate rather than from where their parent is.
 *
 * Spin follows the same simplification the planets already use in `CelestialBody`: the pole's
 * declination tilts the body and W spins it, while the pole's right ascension is dropped. That
 * costs a fixed azimuthal offset of the spin axis and keeps the rotation rate, axial tilt and
 * phase correct, which is what reads on screen.
 */
export abstract class Asteroid extends ChebyshevBody {
  type: SpaceObjectType = SpaceObjectType.ASTEROID;
  protected readonly NUM_HEIGHT_SEGS = 96;
  protected readonly NUM_WIDTH_SEGS = 96;
  textureQuality: string = AsteroidTextureQuality.POTATO;

  /** Measured triaxial shape, with the craters big enough to alter the outline. */
  abstract get shape(): IrregularBodyShape;
  /** Declination of the spin axis, degrees (IAU pole, or the best published solution). */
  protected abstract get poleDecDeg(): number;
  /** Prime meridian angle at J2000, degrees. */
  protected abstract get primeMeridianAtEpochDeg(): number;
  /** Rotation rate, degrees per day. */
  protected abstract get spinRateDegPerDay(): number;
  /** Highest-quality texture suffix; overridden by bodies that have real imagery. */
  protected get highestTextureQuality(): string {
    return AsteroidTextureQuality.HIGH;
  }

  /** Texture basename, which is also the body's lowercase name. */
  protected abstract get textureSlug(): string;

  getTexturePath(): string {
    return `${settingsManager.installDirectory}textures/${this.textureSlug}${this.textureQuality}.jpg`;
  }

  useHighestQualityTexture(): void {
    this.textureQuality = this.highestTextureQuality;
    this.loadTexture();
  }

  /**
   * The longest point on the shape, not the mean radius, so the camera's surface-zoom floor
   * clears the actual mesh. Vesta's long axis is 286 km against a 261 km mean, which is more
   * than the 20% clearance the floor allows - centering on it put the camera inside the rock.
   */
  get zoomFloorRadiusKm(): number {
    const geometry = this.mesh?.geometry as IrregularBodyGeometry | undefined;

    // Before init, fall back to the shape's own bound (semi-axis plus the roughness envelope).
    return geometry?.maxRadiusKm ?? Math.max(...this.shape.semiAxesKm) + this.shape.roughnessKm;
  }

  /** These are lumpy rocks, not spheres - the whole point of centering on one. */
  protected createGeometry_(gl: WebGL2RenderingContext): BufferGeometry {
    return new IrregularBodyGeometry(gl, {
      shape: this.shape,
      widthSegments: this.NUM_WIDTH_SEGS,
      heightSegments: this.NUM_HEIGHT_SEGS,
    });
  }

  /**
   * `ChebyshevBody` deliberately leaves orientation alone (a dwarf planet at 40 AU is never
   * more than a dot), but an asteroid can be flown right up to, and a rock this irregular
   * sitting perfectly still looks broken. The rotation is refreshed every frame even when the
   * position itself is served from its cache.
   */
  updatePosition(simTime: Date): void {
    super.updatePosition(simTime);

    const daysFromEpoch = (simTime.getTime() - J2000_EPOCH_MS) / MS_PER_DAY;
    const spinDeg = (((this.primeMeridianAtEpochDeg + this.spinRateDegPerDay * daysFromEpoch) % 360) + 360) % 360;

    this.rotation = [0, (this.poleDecDeg - 90) * DEG2RAD, spinDeg * DEG2RAD];
  }

  typeToString(): string {
    return 'Asteroid';
  }
}
