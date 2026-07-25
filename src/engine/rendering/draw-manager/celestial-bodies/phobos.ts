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
import { Seconds } from '@ootk/src/main';
import { settingsManager } from '../../../../settings/settings';
import { PlanetColors } from './celestial-body';
import { MarsMoon } from './mars-moon';
import { MarsMoonElements, orbitalPeriodSec, PHOBOS_ELEMENTS } from './mars-moon-elements';
import { PHOBOS_SHAPE } from './mars-moon-shapes';

export enum PhobosTextureQuality {
  POTATO = '512',
  HIGH = '4k',
  ULTRA = '8k',
}

export class Phobos extends MarsMoon {
  /** Mean radius (JPL): the sphere-equivalent size used for zoom limits and hit tests. */
  readonly RADIUS = 11.08;
  readonly elements: MarsMoonElements = PHOBOS_ELEMENTS;
  readonly shape = PHOBOS_SHAPE;
  orbitalPeriod = orbitalPeriodSec(PHOBOS_ELEMENTS) as Seconds;
  color = PlanetColors.MOON;
  textureQuality: PhobosTextureQuality = PhobosTextureQuality.POTATO;

  getName(): SolarBody {
    return SolarBody.Phobos;
  }

  getTexturePath(): string {
    return `${settingsManager.installDirectory}textures/phobos${this.textureQuality}.jpg`;
  }

  useHighestQualityTexture(): void {
    this.textureQuality = PhobosTextureQuality.ULTRA;
    this.loadTexture();
  }
}
