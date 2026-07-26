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
import { DOT_HIDE_BODY_RADII } from '@app/engine/rendering/body-glyph';
import { BufferGeometry } from '@app/engine/rendering/buffer-geometry';
import { IrregularBodyGeometry } from '@app/engine/rendering/irregular-body-geometry';
import { IrregularBodyShape } from '@app/engine/rendering/irregular-body-shape';
import { EpochUTC, J2000, Kilometers, KilometersPerSecond, Seconds, SpaceObjectType, Vector3D } from '@ootk/src/main';
import { mat3, mat4, vec3 } from 'gl-matrix';
import { settingsManager } from '../../../../settings/settings';
import { CelestialBody } from './celestial-body';

/** Apply a rotation given as its three column vectors. */
function applyRotation(columns: [number, number, number][], v: readonly [number, number, number]): [number, number, number] {
  const [cx, cy, cz] = columns;

  return [cx[0] * v[0] + cy[0] * v[1] + cz[0] * v[2], cx[1] * v[0] + cy[1] * v[1] + cz[1] * v[2], cx[2] * v[0] + cy[2] * v[1] + cz[2] * v[2]];
}

/**
 * One-entry memo of the J2000-to-TEME rotation, shared by every moon.
 *
 * The rotation depends only on the instant, and all nineteen moons are updated with the
 * same `simTime` - so without this, a frame paid for fifty-seven `J2000.toTEME()`
 * conversions (three basis vectors each) to compute the same three columns nineteen times
 * over. Precession/nutation is by far the most expensive thing in a moon's update.
 */
let lastRotationMs = Number.NaN;
let lastRotation: [number, number, number][] | null = null;

/**
 * Columns of the J2000-to-TEME rotation at `simTime`, obtained by converting the three
 * basis vectors.
 *
 * Three frame transforms per instant, then plain arithmetic for every point that needs
 * rotating. A moon's orbit ring alone is 256 points; converting each one individually is
 * the difference between a ring that can be rebuilt every frame and one that cannot.
 */
function j2000ToTemeRotation(simTime: Date): [number, number, number][] {
  const ms = simTime.getTime();

  if (ms === lastRotationMs && lastRotation) {
    return lastRotation;
  }

  const epoch = new EpochUTC((ms / 1000) as Seconds);
  const zeroVelocity = new Vector3D(0 as KilometersPerSecond, 0 as KilometersPerSecond, 0 as KilometersPerSecond);
  const axis = (x: number, y: number, z: number): [number, number, number] => {
    const teme = new J2000(epoch, new Vector3D(x as Kilometers, y as Kilometers, z as Kilometers), zeroVelocity).toTEME().position;

    return [teme.x, teme.y, teme.z];
  };

  lastRotationMs = ms;
  lastRotation = [axis(1, 0, 0), axis(0, 1, 0), axis(0, 0, 1)];

  return lastRotation;
}

/**
 * Shared behaviour for every moon of another planet: position is the parent's plus a
 * parent-centric offset, orientation is tidally locked so the sub-parent meridian always
 * faces the planet, and the orbit path is a ring around the parent rather than an ellipse
 * around the Sun.
 *
 * Unlike the other {@link CelestialBody} subclasses these do not come from
 * astronomy-engine's `BackdatePosition` and do not orbit the Sun, so geometry, position,
 * orientation and the orbit path are all overridden here. Subclasses supply the offset:
 * {@link AnalyticMoon} propagates a fitted secular element set, `GalileanMoon` calls
 * astronomy-engine's dedicated Jupiter-moon ephemeris.
 *
 * Earth's Moon (`moon.ts`) predates this and is deliberately not a `PlanetMoon` - it is the
 * only moon visible from the default view, so it follows the Earth-centric path instead.
 */
export abstract class PlanetMoon extends CelestialBody {
  /** The planet this moon orbits. Everything is drawn and positioned relative to it. */
  abstract readonly parentBody: SolarBody;
  /**
   * Mean orbit radius, kilometers. Only used to judge how far the moon separates from its
   * planet on screen, which decides whether the dot is worth drawing.
   */
  abstract readonly semiMajorAxisKm: number;
  /**
   * Offset from the parent's center in the J2000/ICRF frame, kilometers. The one piece
   * every moon has to provide for itself.
   */
  protected abstract parentCentricPositionJ2000(simTime: Date): [number, number, number];

  /**
   * A procedural irregular shape, for moons too small to have relaxed into a sphere.
   * Undefined leaves the base class's UV sphere in place, which is right for every moon
   * larger than a few hundred kilometers.
   */
  protected readonly shape?: IrregularBodyShape;
  /**
   * Rotation about the moon's spin axis applied after the tidal lock, radians. Aligns the
   * texture's prime meridian with the sub-parent point of the shape model.
   */
  protected readonly primeMeridianOffsetRad: number = 0;

  type: SpaceObjectType = SpaceObjectType.MOON;
  protected readonly NUM_HEIGHT_SEGS = 128;
  protected readonly NUM_WIDTH_SEGS = 128;
  /**
   * These orbit in hours or days, not years. The base class's 600 s position cache would
   * quantize Phobos into 8 deg jumps, so both gates are dropped to per-frame.
   */
  minimumUpdateIntervalSeconds = 0;
  protected minimumPositionUpdateIntervalMs_ = 0;

  /** Enough segments for a smooth ring at this scale; the base class's 8192 is wasted here. */
  orbitPathSegments_ = 256;
  private readonly ringVertexBuffer_ = new Float32Array(this.orbitPathSegments_ * 4);
  /** Which segment-width slice of sim time the ring vertices were last sampled from. */
  private lastRingSampleIndex_ = Number.NaN;
  /** Last dot visibility written to the GPU buffers, so the writes only happen on a change. */
  private isDotVisible_: boolean | null = null;
  /** Pickability upload the last write went out against; a newer one means it was clobbered. */
  private lastPickableGeneration_ = -1;

  /**
   * Minimum on-screen separation from the parent planet, in radians, for this moon's dot to
   * be shown.
   *
   * Zoomed far enough out the moons collapse onto the planet's own pixel, where their dots
   * are both useless and in the way - clicking Jupiter would hit whichever dot happens to be
   * on top. Below this the dot is hidden AND unpickable.
   */
  private static readonly DOT_MIN_SEPARATION_RAD_ = 0.02;

  /**
   * Follows the planets toggle rather than the moon loop that loads it.
   *
   * Earth's Moon is deliberately exempt from `isDisablePlanets` because it is visible from
   * the default Earth view, but these are only ever seen inside their planet's system, which
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
    if (!this.shape) {
      return super.createGeometry_(gl);
    }

    return new IrregularBodyGeometry(gl, {
      shape: this.shape,
      widthSegments: this.NUM_WIDTH_SEGS,
      heightSegments: this.NUM_HEIGHT_SEGS,
    });
  }

  protected get parent_(): CelestialBody {
    return ServiceLocator.getScene().getBodyById(this.parentBody) as CelestialBody;
  }

  /**
   * The parent's position plus the analytic offset. Reuses the planet's already-rendered
   * position rather than recomputing it, so the moon can never drift off its planet when
   * the planet's own (coarser) position cache steps.
   */
  updatePosition(simTime: Date): void {
    const parent = this.parent_;

    if (!parent) {
      return;
    }

    /*
     * The parent recomputes every frame instead of on its default 1000 ms gate. Frozen
     * between ticks it lurches ~90 km each time the gate expires, and the moons' dots -
     * stored in absolute float32, which only resolves to ~10 km out here - re-round and pop
     * with it, once a second. The mesh is immune (it is placed in doubles), the dot is not.
     */
    parent.setPositionUpdateIntervalMs(0);

    /*
     * A moon's position is its planet's plus an offset, so the planet has to be current
     * first. This matters when the camera is centered on a moon: the world shift refreshes
     * the center body before the frame's bodies update, and it would otherwise pick up a
     * planet that is a frame behind. Idempotent inside the parent's own cache window.
     */
    parent.updatePosition(simTime);

    const offset = this.parentCentricOffsetTeme_(simTime);

    this.position = [parent.position[0] + offset[0], parent.position[1] + offset[1], parent.position[2] + offset[2]] as EciArr3;
  }

  /**
   * Where the parent planet is drawn this frame, in the shifted world the meshes live in.
   *
   * Everything in the system is placed against this rather than against absolute
   * coordinates. Saturn sits ~1.4e9 km from the Sun, where a float32 resolves to ~100 km -
   * so translating a mesh by its absolute position and then by the (equal and opposite)
   * world shift loses far more precision than the body being drawn. Summing the two in JS
   * doubles first leaves a small number that float32 renders exactly.
   */
  private parentDrawOffset_(): [number, number, number] {
    const parent = this.parent_;
    const worldShift = Scene.getInstance().worldShift;

    return [parent.position[0] + worldShift[0], parent.position[1] + worldShift[1], parent.position[2] + worldShift[2]];
  }

  /** The parent-centric offset rotated from J2000 into the TEME frame the scene renders in. */
  private parentCentricOffsetTeme_(simTime: Date): [number, number, number] {
    return applyRotation(j2000ToTemeRotation(simTime), this.parentCentricPositionJ2000(simTime));
  }

  /**
   * Absolute position of the moon, for the line/label machinery that asks bodies where
   * they are at an arbitrary time. The parent is queried through its own cache, so this
   * shares the planet's accuracy exactly as {@link updatePosition} does.
   */
  getJ2000(simTime: Date, centerBody = SolarBody.Earth): J2000 {
    const parentJ2000 = this.parent_.getJ2000(simTime, centerBody);
    const offset = this.parentCentricPositionJ2000(simTime);

    return new J2000(
      parentJ2000.epoch,
      new Vector3D((parentJ2000.position.x + offset[0]) as Kilometers, (parentJ2000.position.y + offset[1]) as Kilometers, (parentJ2000.position.z + offset[2]) as Kilometers),
      parentJ2000.velocity
    );
  }

  /**
   * Half-width of the central difference used to get the orbit normal, milliseconds.
   *
   * Only the *direction* of the resulting velocity matters, so this wants to be a small
   * fraction of the orbital period: too long and the chord tilts away from the tangent, too
   * short and differencing two nearly equal positions loses precision. One ten-thousandth
   * of a period keeps both errors negligible from 7 h Phobos to 79 d Iapetus - the fixed
   * 60 s the Martian moons used is 0.05% of a Phobos orbit but only 0.0009% of an Iapetus
   * one, where the difference starts to be eaten by the propagator's own rounding.
   */
  protected get velocitySampleStepMs(): number {
    return (this.orbitalPeriod * 1000) / 10_000;
  }

  /**
   * Body-fixed orientation. Every moon here is tidally locked, so +X (the prime meridian
   * and, for the irregular ones, the shape model's long axis) points at the planet and +Z
   * is the orbit normal. Built as a basis rather than the base class's Euler triple because
   * those three angles cannot express an arbitrary orientation.
   */
  private bodyFixedRotation_(simTime: Date, parentToMoonTeme: vec3): mat4 {
    /*
     * The spin axis is taken from the orbit normal in J2000 and used as if it were TEME.
     * Converting it properly would cost two more frame transforms per moon per frame to
     * correct a tilt of at most 0.4 deg (the J2000-to-TEME angle this century) on a body
     * a few pixels across. The planet-facing axis below is exact either way, since it comes
     * from the already-converted position.
     */
    const stepMs = this.velocitySampleStepMs;
    const before = this.parentCentricPositionJ2000(new Date(simTime.getTime() - stepMs));
    const after = this.parentCentricPositionJ2000(new Date(simTime.getTime() + stepMs));
    const velocity = vec3.fromValues(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
    const radial = parentToMoonTeme;
    const zAxis = vec3.create();

    vec3.cross(zAxis, radial, velocity);
    vec3.normalize(zAxis, zAxis);

    // +X faces the planet: the inward radial, re-orthogonalized against the spin axis.
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

    const parent = this.parent_;

    if (!parent) {
      return;
    }

    this.updatePosition(simTime);

    // Reuse the position just computed instead of transforming the offset a second time.
    const parentToMoonTeme = vec3.fromValues(this.position[0] - parent.position[0], this.position[1] - parent.position[1], this.position[2] - parent.position[2]);

    this.updateOrbitPathForProximity_();

    this.modelViewMatrix_ = mat4.clone(this.mesh.geometry.localMvMatrix);

    if (settingsManager.centerBody !== this.getName()) {
      // One small translate (the planet as drawn, plus the offset) rather than the base
      // class's absolute-then-cancel pair - see parentDrawOffset_ for why that matters here.
      const parentDraw = this.parentDrawOffset_();

      mat4.translate(
        this.modelViewMatrix_,
        this.modelViewMatrix_,
        vec3.fromValues(parentDraw[0] + parentToMoonTeme[0], parentDraw[1] + parentToMoonTeme[1], parentDraw[2] + parentToMoonTeme[2])
      );
    }

    mat4.multiply(this.modelViewMatrix_, this.modelViewMatrix_, this.bodyFixedRotation_(simTime, parentToMoonTeme));
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
   * A ring around the parent planet rather than around the Sun.
   *
   * The base class caches one heliocentric ellipse forever, which is right for a planet and
   * wrong here twice over: the ring has to translate with the planet (Saturn moves at
   * 9.7 km/s, against a 238,000 km Enceladus orbit) and the ellipse itself precesses.
   *
   * The vertices stay parent-relative and `Path.draw` re-resolves the planet anchor itself
   * every frame. Storing them in absolute coordinates instead quantized the ring to ~30 km
   * in float32 and left it visibly beside the moon at close range; pushing the anchor from
   * here instead of letting the line resolve it froze the ring in place whenever this moon
   * became the center body, because a center body skips its own path update.
   */
  drawFullOrbitPath(): void {
    const lineManager = ServiceLocator.getLineManager();

    if (!this.parent_) {
      return;
    }

    /*
     * Resampled from the current instant, so the strip's ends stay pinned to the moon and
     * the line reads as the path it is about to travel - the same thing a planet's ring
     * does. A ring cached once and left alone put its seam wherever the moon happened to be
     * when it was built, which is what this replaces.
     *
     * Resampling is not needed every *frame*, though. The ring's shape barely changes over
     * one revolution; what moves is the seam, by exactly one segment per segment-width of
     * sim time. So the rebuild is gated on that, which keeps the seam within a segment of
     * the moon - visually pinned - while cutting the work by a factor of hundreds at normal
     * propagation rates. The gate self-disengages when time runs fast enough to cross a
     * segment every frame, which is exactly when the ring does need rebuilding every frame.
     */
    const simTimeMs = ServiceLocator.getTimeManager().simulationTimeObj.getTime();
    const stepMs = (this.orbitalPeriod * 1000) / (this.orbitPathSegments_ - 1);
    const sampleIndex = Math.floor(simTimeMs / stepMs);

    if (this.fullOrbitPath) {
      if (this.fullOrbitPath.isGarbage) {
        this.fullOrbitPath.isGarbage = false;
        lineManager.add(this.fullOrbitPath);
      }

      if (sampleIndex === this.lastRingSampleIndex_) {
        return;
      }
    }

    this.lastRingSampleIndex_ = sampleIndex;

    const rotation = j2000ToTemeRotation(new Date(simTimeMs));

    for (let i = 0; i < this.orbitPathSegments_; i++) {
      const offset = applyRotation(rotation, this.parentCentricPositionJ2000(new Date(simTimeMs + i * stepMs)));

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

      this.fullOrbitPath = lineManager.createOrbitPath(points, this.color, this.parentBody);

      return;
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
   * Far end: zoomed out the moons collapse onto the planet's own pixel, where their dots are
   * in the way - clicking the planet would select whichever dot won the depth test. Hiding
   * is not enough on its own, because a size-0 dot still owns its pick square; only
   * `a_pickable` clears it.
   *
   * Near end: the dot buffer is a Float32Array of absolute coordinates, and out at Saturn
   * that resolves to no better than ~100 km, which visibly swims against the body it is
   * marking. The mesh is placed in doubles and is already several pixels wide by then, so
   * the dot has nothing left to contribute.
   *
   * The state is reasserted whenever the color scheme re-uploads the pickability buffer.
   * That upload rebuilds every dot from the scheme, which hands all planet dots
   * `Pickable.Yes` unconditionally, so a moon that had gone unpickable silently became
   * clickable again while its dot stayed hidden - you would aim at Jupiter, hit Io, and have
   * nothing on screen explaining why. Comparing the generation costs an integer per moon per
   * frame and issues no GPU work unless something actually clobbered the byte.
   */
  private updateDotVisibility_(): void {
    const planetObject = this.planetObject;

    if (!planetObject) {
      return;
    }

    const camera = ServiceLocator.getMainCamera();
    const cameraDistanceToParent = Math.max(camera.getDistFromEntity(vec3.fromValues(...this.parent_.position)), 1);
    // Small-angle separation between the moon's orbit and the planet, as the camera sees it.
    const separationRad = this.semiMajorAxisKm / cameraDistanceToParent;
    const cameraDistanceToMoon = Math.max(camera.getDistFromEntity(vec3.fromValues(...this.position)), 1);
    const nearLimitKm = this.RADIUS * DOT_HIDE_BODY_RADII;
    /*
     * Hysteresis on the near limit: the camera-to-moon distance swings by the orbit
     * diameter as the moon goes round, so a bare threshold would flicker the dot on and
     * off once per orbit for any view parked near it.
     */
    const nearLimitWithHysteresisKm = this.isDotVisible_ === false ? nearLimitKm * 1.25 : nearLimitKm;
    const isVisible = separationRad >= PlanetMoon.DOT_MIN_SEPARATION_RAD_ && cameraDistanceToMoon > nearLimitWithHysteresisKm;
    // Undefined until the color scheme registers itself, which is later than the first frames.
    const pickableGeneration = ServiceLocator.getColorSchemeManager()?.pickableUploadGeneration ?? -1;

    if (isVisible === this.isDotVisible_ && pickableGeneration === this.lastPickableGeneration_) {
      return;
    }

    this.isDotVisible_ = isVisible;
    this.lastPickableGeneration_ = pickableGeneration;

    const gl = this.gl_;

    planetObject.setHoverDotSize(gl, isVisible ? 1 : 0);
    planetObject.setPickable(gl, isVisible);
  }
}
