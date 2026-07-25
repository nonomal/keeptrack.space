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

import { EciArr3, SolarBody } from '@app/engine/core/interfaces';
import { Scene } from '@app/engine/core/scene';
import { ServiceLocator } from '@app/engine/core/service-locator';
import { BufferGeometry } from '@app/engine/rendering/buffer-geometry';
import { IrregularBodyGeometry } from '@app/engine/rendering/irregular-body-geometry';
import { IrregularBodyShape } from '@app/engine/rendering/irregular-body-shape';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Seconds, SpaceObjectType, Vector3D } from '@ootk/src/main';
import { mat3, mat4, vec3 } from 'gl-matrix';
import { settingsManager } from '../../../../settings/settings';
import { CelestialBody } from './celestial-body';
import { MarsMoonElements, marsCentricPositionJ2000 } from './mars-moon-elements';

/**
 * Shared behaviour for Phobos and Deimos: an irregular procedural body whose position
 * comes from {@link marsCentricPositionJ2000} added to Mars, and whose orientation is
 * tidally locked so the sub-Mars meridian always faces the planet.
 *
 * Unlike every other {@link CelestialBody}, these are not spheres, do not come from
 * astronomy-engine, and orbit something other than the Sun - so geometry, position,
 * orientation and the orbit path are all overridden here.
 */
/** Apply a rotation given as its three column vectors. */
function applyRotation(columns: [number, number, number][], v: readonly [number, number, number]): [number, number, number] {
  const [cx, cy, cz] = columns;

  return [cx[0] * v[0] + cy[0] * v[1] + cz[0] * v[2], cx[1] * v[0] + cy[1] * v[1] + cz[1] * v[2], cx[2] * v[0] + cy[2] * v[1] + cz[2] * v[2]];
}

export abstract class MarsMoon extends CelestialBody {
  abstract readonly elements: MarsMoonElements;
  abstract readonly shape: IrregularBodyShape;
  /**
   * Rotation about the moon's spin axis applied after the tidal lock, radians. Aligns the
   * texture's prime meridian with the sub-Mars point of the shape model.
   */
  protected readonly primeMeridianOffsetRad: number = 0;

  type: SpaceObjectType = SpaceObjectType.MOON;
  protected readonly NUM_HEIGHT_SEGS = 128;
  protected readonly NUM_WIDTH_SEGS = 128;
  /**
   * These orbit in hours, not years. The base class's 600 s position cache would quantize
   * Phobos into 8 deg jumps, so both gates are dropped to per-frame.
   */
  minimumUpdateIntervalSeconds = 0;
  protected minimumPositionUpdateIntervalMs_ = 0;

  /** Enough segments for a smooth ring at this scale; the base class's 8192 is wasted here. */
  orbitPathSegments_ = 256;
  private readonly ringVertexBuffer_ = new Float32Array(this.orbitPathSegments_ * 4);
  /** Last dot visibility written to the GPU buffers, so the writes only happen on a change. */
  private isDotVisible_: boolean | null = null;

  /**
   * Minimum on-screen separation from Mars, in radians, for this moon's dot to be shown.
   *
   * Zoomed far enough out the moons collapse onto Mars's own pixel, where their dots are
   * both useless and in the way - clicking Mars would hit whichever dot happens to be on
   * top. Below this the dot is hidden AND unpickable.
   */
  private static readonly DOT_MIN_SEPARATION_RAD_ = 0.02;
  /**
   * Camera distance, in body radii, below which the dot gives way to the mesh. Roughly the
   * range at which the body itself is about a pixel wide.
   */
  private static readonly DOT_HIDE_BODY_RADII_ = 2000;

  /**
   * Follows the planets toggle rather than the moon loop that loads it.
   *
   * Earth's Moon is deliberately exempt from `isDisablePlanets` because it is visible from
   * the default Earth view, but these two are only ever seen inside the Mars system, which
   * that flag turns off entirely. Skipping init leaves `isLoaded_` false, which stops both
   * the draw and the per-frame update - including the dot position write, which would
   * otherwise park a Phobos dot 9375 km from the center of the Earth.
   */
  async init(gl: WebGL2RenderingContext): Promise<void> {
    if (settingsManager.isDisablePlanets) {
      return;
    }

    await super.init(gl);
  }

  protected createGeometry_(gl: WebGL2RenderingContext): BufferGeometry {
    return new IrregularBodyGeometry(gl, {
      shape: this.shape,
      widthSegments: this.NUM_WIDTH_SEGS,
      heightSegments: this.NUM_HEIGHT_SEGS,
    });
  }

  private get mars_() {
    return ServiceLocator.getScene().planets[SolarBody.Mars];
  }

  /**
   * Mars's position plus the analytic offset. Reuses Mars's already-rendered position
   * rather than recomputing it, so the moon can never drift off the planet when Mars's
   * own (coarser) position cache steps.
   */
  updatePosition(simTime: Date): void {
    const mars = this.mars_;

    if (!mars) {
      return;
    }

    /*
     * Mars recomputes every frame instead of on its default 1000 ms gate. Frozen between
     * ticks it lurches ~90 km each time the gate expires, and the moons' dots - stored in
     * absolute float32, which only resolves to ~10 km out here - re-round and pop with it,
     * once a second. The mesh is immune (it is placed in doubles), the dot is not.
     */
    mars.setPositionUpdateIntervalMs(0);

    /*
     * A moon's position is Mars's plus an offset, so Mars has to be current first. This
     * matters when the camera is centered on a moon: the world shift refreshes the center
     * body before the frame's bodies update, and it would otherwise pick up a Mars that is
     * a frame behind. Idempotent inside Mars's own cache window.
     */
    mars.updatePosition(simTime);

    const offset = this.marsCentricOffsetTeme_(simTime);

    this.position = [mars.position[0] + offset[0], mars.position[1] + offset[1], mars.position[2] + offset[2]] as EciArr3;
  }

  /**
   * Where Mars is drawn this frame, in the shifted world the meshes live in.
   *
   * Everything in the Mars system is placed against this rather than against absolute
   * coordinates. Mars sits ~2.5e8 km from the Sun, and a float32 holds that to about 30 km
   * - so translating a mesh by its absolute position and then by the (equal and opposite)
   * world shift loses far more precision than the 11 km body being drawn. Summing the two
   * in JS doubles first leaves a small number that float32 renders exactly.
   */
  private marsDrawOffset_(): [number, number, number] {
    const mars = this.mars_;
    const worldShift = Scene.getInstance().worldShift;

    return [mars.position[0] + worldShift[0], mars.position[1] + worldShift[1], mars.position[2] + worldShift[2]];
  }

  /** The Mars-centric offset rotated from J2000 into the TEME frame the scene renders in. */
  private marsCentricOffsetTeme_(simTime: Date): [number, number, number] {
    return applyRotation(this.j2000ToTemeRotation_(simTime), marsCentricPositionJ2000(this.elements, simTime));
  }

  /**
   * Columns of the J2000-to-TEME rotation at `simTime`, obtained by converting the three
   * basis vectors.
   *
   * Three frame transforms per frame, then plain arithmetic for every point that needs
   * rotating. The orbit ring alone is 256 points; converting each one individually is the
   * difference between a ring that can be rebuilt every frame and one that cannot.
   */
  private j2000ToTemeRotation_(simTime: Date): [number, number, number][] {
    const epoch = new EpochUTC((simTime.getTime() / 1000) as Seconds);
    const zeroVelocity = new Vector3D(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond);
    const axis = (x: number, y: number, z: number): [number, number, number] => {
      const teme = new J2000(epoch, new Vector3D(x as Kilometers, y as Kilometers, z as Kilometers), zeroVelocity).toTEME().position;

      return [teme.x, teme.y, teme.z];
    };

    return [axis(1, 0, 0), axis(0, 1, 0), axis(0, 0, 1)];
  }

  /**
   * Absolute position of the moon, for the line/label machinery that asks bodies where
   * they are at an arbitrary time. Mars is queried through its own cache, so this shares
   * the planet's accuracy exactly as {@link updatePosition} does.
   */
  getJ2000(simTime: Date, centerBody = SolarBody.Earth): J2000 {
    const mars = this.mars_;
    const marsJ2000 = mars.getJ2000(simTime, centerBody);
    const offset = marsCentricPositionJ2000(this.elements, simTime);

    return new J2000(
      marsJ2000.epoch,
      new Vector3D((marsJ2000.position.x + offset[0]) as Kilometers, (marsJ2000.position.y + offset[1]) as Kilometers, (marsJ2000.position.z + offset[2]) as Kilometers),
      marsJ2000.velocity
    );
  }

  /**
   * Body-fixed orientation. Both moons are tidally locked, so +X (the prime meridian and
   * the shape model's long axis) points at Mars and +Z is the orbit normal. Built as a
   * basis rather than the base class's Euler triple because those three angles cannot
   * express an arbitrary orientation.
   */
  private bodyFixedRotation_(simTime: Date, marsToMoonTeme: vec3): mat4 {
    /*
     * The spin axis is taken from the orbit normal in J2000 and used as if it were TEME.
     * Converting it properly would cost two more frame transforms per moon per frame to
     * correct a tilt of at most 0.4 deg (the J2000-to-TEME angle this century) on a body
     * a few pixels across. The Mars-facing axis below is exact either way, since it comes
     * from the already-converted position.
     */
    const stepMs = 60_000;
    const before = marsCentricPositionJ2000(this.elements, new Date(simTime.getTime() - stepMs));
    const after = marsCentricPositionJ2000(this.elements, new Date(simTime.getTime() + stepMs));
    const velocity = vec3.fromValues(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
    const radial = marsToMoonTeme;
    const zAxis = vec3.create();

    vec3.cross(zAxis, radial, velocity);
    vec3.normalize(zAxis, zAxis);

    // +X faces Mars: the inward radial, re-orthogonalized against the spin axis.
    const xAxis = vec3.create();

    vec3.negate(xAxis, radial);
    vec3.scaleAndAdd(xAxis, xAxis, zAxis, -vec3.dot(xAxis, zAxis));
    vec3.normalize(xAxis, xAxis);

    const yAxis = vec3.create();

    vec3.cross(yAxis, zAxis, xAxis);

    const rotation = mat4.fromValues(xAxis[0], xAxis[1], xAxis[2], 0, yAxis[0], yAxis[1], yAxis[2], 0, zAxis[0], zAxis[1], zAxis[2], 0, 0, 0, 0, 1);

    if (this.primeMeridianOffsetRad !== 0) {
      mat4.rotateZ(rotation, rotation, this.primeMeridianOffsetRad);
    }

    return rotation;
  }

  update(simTime: Date): void {
    if (!this.isLoaded_) {
      return;
    }

    const mars = this.mars_;

    if (!mars) {
      return;
    }

    this.updatePosition(simTime);

    // Reuse the position just computed instead of transforming the offset a second time.
    const marsToMoonTeme = vec3.fromValues(this.position[0] - mars.position[0], this.position[1] - mars.position[1], this.position[2] - mars.position[2]);

    this.updateOrbitPathForProximity_();

    this.modelViewMatrix_ = mat4.clone(this.mesh.geometry.localMvMatrix);

    if (settingsManager.centerBody !== this.getName()) {
      // One small translate (Mars as drawn, plus the offset) rather than the base class's
      // absolute-then-cancel pair - see marsDrawOffset_ for why that matters here.
      const marsDraw = this.marsDrawOffset_();

      mat4.translate(
        this.modelViewMatrix_,
        this.modelViewMatrix_,
        vec3.fromValues(marsDraw[0] + marsToMoonTeme[0], marsDraw[1] + marsToMoonTeme[1], marsDraw[2] + marsToMoonTeme[2])
      );
    }

    mat4.multiply(this.modelViewMatrix_, this.modelViewMatrix_, this.bodyFixedRotation_(simTime, marsToMoonTeme));
    mat3.normalFromMat4(this.normalMatrix_, this.modelViewMatrix_);

    this.calculateRelativeSatPos();
    this.updateDotVisibility_();

    const positionData = ServiceLocator.getDotsManager().positionData;

    if (positionData && this.planetObject?.id) {
      positionData[Number(this.planetObject.id) * 3] = this.position[0];
      positionData[Number(this.planetObject.id) * 3 + 1] = this.position[1];
      positionData[Number(this.planetObject.id) * 3 + 2] = this.position[2];
    }
  }

  /**
   * A ring around Mars rather than around the Sun.
   *
   * The base class caches one heliocentric ellipse forever, which is right for a planet and
   * wrong here twice over: the ring has to translate with Mars (24 km/s, against a 9375 km
   * orbit) and the ellipse itself precesses.
   *
   * The vertices stay Mars-relative and `Path.draw` re-resolves the Mars anchor itself
   * every frame. Storing them in absolute coordinates instead quantized the ring to ~30 km
   * in float32 and left it visibly beside the moon at close range; pushing the anchor from
   * here instead of letting the line resolve it froze the ring in place whenever this moon
   * became the center body, because a center body skips its own path update.
   */
  drawFullOrbitPath(): void {
    const lineManager = ServiceLocator.getLineManager();
    const mars = this.mars_;

    if (!mars) {
      return;
    }

    /*
     * Resampled from the current instant every frame, so the strip's ends stay pinned to
     * the moon and the line reads as the path it is about to travel - the same thing a
     * planet's ring does. A cached ring left its seam wherever the moon happened to be when
     * it was built. Affordable only because the frame transform is computed once here and
     * applied to all 256 points as plain arithmetic.
     */
    const simTimeMs = ServiceLocator.getTimeManager().simulationTimeObj.getTime();
    const stepMs = (this.orbitalPeriod * 1000) / (this.orbitPathSegments_ - 1);
    const rotation = this.j2000ToTemeRotation_(new Date(simTimeMs));

    for (let i = 0; i < this.orbitPathSegments_; i++) {
      const offset = applyRotation(rotation, marsCentricPositionJ2000(this.elements, new Date(simTimeMs + i * stepMs)));

      this.ringVertexBuffer_[i * 4] = offset[0];
      this.ringVertexBuffer_[i * 4 + 1] = offset[1];
      this.ringVertexBuffer_[i * 4 + 2] = offset[2];
      this.ringVertexBuffer_[i * 4 + 3] = 1;
    }

    if (!this.fullOrbitPath) {
      const points = Array.from({ length: this.orbitPathSegments_ }, (_unused, i) => [
        this.ringVertexBuffer_[i * 4],
        this.ringVertexBuffer_[i * 4 + 1],
        this.ringVertexBuffer_[i * 4 + 2],
      ]) as [number, number, number][];

      this.fullOrbitPath = lineManager.createOrbitPath(points, this.color, SolarBody.Mars);

      return;
    }

    if (this.fullOrbitPath.isGarbage) {
      this.fullOrbitPath.isGarbage = false;
      lineManager.add(this.fullOrbitPath);
    }

    this.fullOrbitPath.updateData(this.ringVertexBuffer_, this.orbitPathSegments_);
  }

  /**
   * A moon's ring around its planet stays useful from the moon's own surface, unlike a
   * planet's heliocentric ellipse - so it keeps drawing as center body, and only the
   * shared proximity fade takes it away.
   */
  protected get isOrbitPathDrawnAsCenterBody_(): boolean {
    return true;
  }

  /**
   * The dot stands in for the moon only in the range where it is the better marker, and is
   * hidden (and made unpickable) at both ends of that range.
   *
   * Far end: zoomed out the moons collapse onto Mars's own pixel, where their dots are in
   * the way - clicking Mars would select whichever dot won the depth test. Hiding is not
   * enough on its own, because a size-0 dot still owns its pick square; only `a_pickable`
   * clears it.
   *
   * Near end: the dot buffer is a Float32Array of absolute coordinates, and out at Mars
   * that resolves to no better than ~10 km, which visibly swims against a body 11 km in
   * radius. The mesh is placed in doubles and is already several pixels wide by then, so
   * the dot has nothing left to contribute.
   */
  private updateDotVisibility_(): void {
    const planetObject = this.planetObject;

    if (!planetObject) {
      return;
    }

    const camera = ServiceLocator.getMainCamera();
    const cameraDistanceToMars = Math.max(camera.getDistFromEntity(vec3.fromValues(...this.mars_.position)), 1);
    // Small-angle separation between the moon's orbit and Mars itself, as the camera sees it.
    const separationRad = this.elements.semiMajorAxisKm / cameraDistanceToMars;
    const cameraDistanceToMoon = Math.max(camera.getDistFromEntity(vec3.fromValues(...this.position)), 1);
    const nearLimitKm = this.RADIUS * MarsMoon.DOT_HIDE_BODY_RADII_;
    /*
     * Hysteresis on the near limit: the camera-to-moon distance swings by the orbit
     * diameter as the moon goes round, so a bare threshold would flicker the dot on and
     * off once per orbit for any view parked near it.
     */
    const nearLimitWithHysteresisKm = this.isDotVisible_ === false ? nearLimitKm * 1.25 : nearLimitKm;
    const isVisible = separationRad >= MarsMoon.DOT_MIN_SEPARATION_RAD_ && cameraDistanceToMoon > nearLimitWithHysteresisKm;

    if (isVisible === this.isDotVisible_) {
      return;
    }

    this.isDotVisible_ = isVisible;

    const gl = this.gl_;

    planetObject.setHoverDotSize(gl, isVisible ? 1 : 0);
    planetObject.setPickable(gl, isVisible);
  }
}
