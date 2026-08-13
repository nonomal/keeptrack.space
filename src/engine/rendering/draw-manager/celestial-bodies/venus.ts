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
import { Kilometers, Seconds, TemeVec3 } from '@ootk/src/main';
import { vec3 } from 'gl-matrix';
import { settingsManager } from '../../../../settings/settings';
import { CelestialBody, PlanetColors } from './celestial-body';
import { VENUS_RADIUS_KM, VenusAtmosphere } from './venus-atmosphere';

export enum VenusTextureQuality {
  POTATO = '512',
  HIGH = '4k',
  /**
   * Present but deliberately unused - see {@link Venus.useHighestQualityTexture}. Kept so the
   * asset stays addressable if the zoom cap ever opens up enough to justify it.
   */
  ULTRA = '8k',
}

export class Venus extends CelestialBody {
  readonly RADIUS = VENUS_RADIUS_KM;
  protected readonly NUM_HEIGHT_SEGS = 64;
  protected readonly NUM_WIDTH_SEGS = 64;
  color = PlanetColors.VENUS;
  orbitalPeriod = (0.61519726 * 365 * 24 * 3600) as Seconds;
  meanDistanceToSun = 108209475 as Kilometers;
  eci: TemeVec3;
  textureQuality: VenusTextureQuality = VenusTextureQuality.POTATO;
  private readonly atmosphere_: VenusAtmosphere;

  constructor() {
    super();
    this.atmosphere_ = new VenusAtmosphere(this);
  }

  async init(gl: WebGL2RenderingContext): Promise<void> {
    await super.init(gl);
    await this.atmosphere_.init(gl);
  }

  /** Face-on opacity of the cloud deck, 0 (invisible) to 1 (fully hides the surface). */
  setAtmosphereOpacity(opacity: number): void {
    this.atmosphere_.opacity = Math.min(Math.max(opacity, 0), 1);
  }

  getTexturePath(): string {
    return `${settingsManager.installDirectory}textures/venus${this.textureQuality}.jpg`;
  }

  /**
   * Loads the highest tier that this body's zoom cap can actually resolve, which is 4k - NOT
   * {@link VenusTextureQuality.ULTRA}.
   *
   * `getBodyViewConfig` pins minZoom at `RADIUS * 1.2`, so the camera never gets closer than
   * ~1450 km above the surface. MEASURED at that limit on a 1000px viewport, 4k vs 8k differ
   * by a max of 6/255 per channel and 0.21% mean - indistinguishable, because 4096 texels
   * around the equator already out-resolve the screen. The 8k costs a 3560 ms JPEG decode
   * and a 67 ms GPU upload against 356 ms / 16.7 ms for the 4k, which is the stutter you see
   * when the swap lands. If the zoom cap is ever raised, revisit this before ULTRA - a KTX2 /
   * Basis texture would upload without a decode at all.
   */
  useHighestQualityTexture(): void {
    this.textureQuality = VenusTextureQuality.HIGH;
    this.loadTexture();
  }

  getName(): SolarBody {
    return SolarBody.Venus;
  }

  update(simTime: Date): void {
    super.update(simTime);
    this.atmosphere_.update(simTime);
  }

  draw(sunPosition: vec3, tgtBuffer: WebGLFramebuffer | null = null) {
    if (!this.isLoaded_ || settingsManager.isDisablePlanets) {
      return;
    }
    super.draw(sunPosition, tgtBuffer);
    // After the surface: the shell blends over it and depth-tests against it.
    this.atmosphere_.draw(sunPosition, tgtBuffer);
  }
}
