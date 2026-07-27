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
import { ChebyshevInterpolator } from '@ootk/src/interpolator/ChebyshevInterpolator';
import { Kilometers, Seconds, SpaceObjectType, TemeVec3 } from '@ootk/src/main';
import { KM_PER_AU } from 'astronomy-engine';
import { PlanetColors } from './celestial-body';
import { charonChebyshevCoeffs } from './charon-chebyshev';
import { DwarfPlanet } from './dwarf-planet';

export enum CharonTextureQuality {
  POTATO = '512',
  MEDIUM = '2k',
  HIGH = '4k',
}

/**
 * Charon is carried as Pluto's moon: it declares a `parentBody`, wears the moon glyph, and the
 * menu nests it under Pluto. It still rides its own heliocentric Chebyshev ephemeris rather
 * than the planet-moon catalog - the Pluto-Charon system is near enough a binary that both
 * bodies are fitted directly from Horizons, so the moon classification is taxonomy, not motion.
 */
export class Charon extends DwarfPlanet {
  readonly RADIUS = 606;
  protected readonly NUM_HEIGHT_SEGS = 64;
  protected readonly NUM_WIDTH_SEGS = 64;
  orbitalPeriod = (247.94 * 365.25 * 24 * 3600) as Seconds;
  meanDistanceToSun = (39.482 * KM_PER_AU) as Kilometers;
  type: SpaceObjectType = SpaceObjectType.MOON;
  parentBody = SolarBody.Pluto;
  /** Mean Pluto-Charon center-to-center separation. */
  semiMajorAxisKm = 19596 as Kilometers;
  eci: TemeVec3;
  rotation = [0, 0, 0];
  color = PlanetColors.CHARON;
  tintColor: [number, number, number] = [0.85, 0.85, 0.88];
  textureQuality: CharonTextureQuality = CharonTextureQuality.POTATO;
  protected interpolator_ = new ChebyshevInterpolator(charonChebyshevCoeffs);

  getName(): SolarBody {
    return 'Charon' as SolarBody;
  }

  /**
   * Charon draws as a mesh beside Pluto (see `BINARY_COMPANIONS_` in planet-moon-systems.ts),
   * so its dot follows the same rule as a catalog moon's: hidden and unpickable while the
   * mesh is doing the job or once it collapses onto Pluto's pixel.
   */
  update(simTime: Date): void {
    super.update(simTime);
    if (this.isLoaded_) {
      this.updateDotVisibility_();
    }
  }
  getTexturePath(): string {
    return `${settingsManager.installDirectory}textures/pluto${this.textureQuality}.jpg`;
  }

  useHighestQualityTexture(): void {
    this.textureQuality = CharonTextureQuality.HIGH;
    this.loadTexture();
  }
}
