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

import { rgbaArray, SolarBody } from '@app/engine/core/interfaces';
import { Seconds } from '@ootk/src/main';
import { JupiterMoons, JupiterMoonsInfo, KM_PER_AU } from 'astronomy-engine';
import { settingsManager } from '../../../../settings/settings';
import { PlanetMoon } from './planet-moon';

/** Which of the four `JupiterMoonsInfo` state vectors a body reads. */
export type GalileanMoonKey = 'io' | 'europa' | 'ganymede' | 'callisto';

/**
 * One-entry memo of {@link JupiterMoons}.
 *
 * The call returns all four moons at once, but each body asks for itself, so a frame in the
 * Jupiter system would otherwise evaluate the same Lieske E5 series four times over for the
 * position update alone - and four more times for each moon's orientation sample. Keying on
 * the exact millisecond is enough: the four moons are always updated with the same
 * `simTime`, and the orientation samples that miss are the only evaluations left.
 */
let lastMoonsMs = Number.NaN;
let lastMoons: JupiterMoonsInfo | null = null;

function jupiterMoonsAt(simTime: Date): JupiterMoonsInfo {
  const ms = simTime.getTime();

  if (ms !== lastMoonsMs || !lastMoons) {
    lastMoonsMs = ms;
    lastMoons = JupiterMoons(simTime);
  }

  return lastMoons;
}

export interface GalileanMoonSpec {
  name: SolarBody;
  key: GalileanMoonKey;
  /** Mean radius, km (JPL). */
  radiusKm: number;
  /** Mean orbit radius, km (JPL). Only used for the on-screen separation test. */
  semiMajorAxisKm: number;
  /** Sidereal period, seconds. Sets the span of the drawn orbit ring. */
  orbitalPeriodSec: number;
  color: rgbaArray;
  texture: string;
  highQualityTier: string;
  /** RGB multiplier applied to the texture; see {@link PlanetMoonSpec.tint}. */
  tint?: [number, number, number];
}

/** Texture tier loaded at boot. */
const DEFAULT_TEXTURE_TIER = '512';

/**
 * Io, Europa, Ganymede or Callisto, positioned by astronomy-engine's dedicated Jupiter-moon
 * ephemeris rather than by a fitted mean-element model.
 *
 * The library already ships Lieske's E5 theory for exactly these four, in exactly the frame
 * the rest of this pipeline uses (EQJ, which is J2000 equatorial), so fitting them against
 * Horizons the way the Saturnian and Uranian moons are fitted would be strictly worse work.
 * The only conversion needed is AU to kilometers.
 */
export class GalileanMoon extends PlanetMoon {
  // `declare` on the three inherited fields: they are set from the spec in the constructor,
  // so re-declaring them for real would emit a field initializer that shadows the base.
  declare readonly RADIUS: number;
  declare orbitalPeriod: Seconds;
  declare color: rgbaArray;
  readonly parentBody = SolarBody.Jupiter;
  readonly semiMajorAxisKm: number;

  private readonly name_: SolarBody;
  private readonly key_: GalileanMoonKey;
  private readonly textureBase_: string;
  private readonly highQualityTier_: string;
  private textureTier_ = DEFAULT_TEXTURE_TIER;

  constructor(spec: GalileanMoonSpec) {
    super();
    this.name_ = spec.name;
    this.key_ = spec.key;
    this.RADIUS = spec.radiusKm;
    this.semiMajorAxisKm = spec.semiMajorAxisKm;
    this.orbitalPeriod = spec.orbitalPeriodSec as Seconds;
    this.color = spec.color;
    this.textureBase_ = spec.texture;
    this.highQualityTier_ = spec.highQualityTier;
    this.tintColor = spec.tint ?? [1, 1, 1];
  }

  protected parentCentricPositionJ2000(simTime: Date): [number, number, number] {
    // StateVector is flat (x/y/z/vx/vy/vz), and its positions are in AU.
    const { x, y, z } = jupiterMoonsAt(simTime)[this.key_];

    return [x * KM_PER_AU, y * KM_PER_AU, z * KM_PER_AU];
  }

  getName(): SolarBody {
    return this.name_;
  }

  getTexturePath(): string {
    return `${settingsManager.installDirectory}textures/${this.textureBase_}${this.textureTier_}.jpg`;
  }

  useHighestQualityTexture(): void {
    if (this.textureTier_ === this.highQualityTier_) {
      return;
    }
    this.textureTier_ = this.highQualityTier_;
    this.loadTexture();
  }
}
