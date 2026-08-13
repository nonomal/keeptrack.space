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

import type { SolarBody } from '@app/engine/core/interfaces';
import type { mat4 } from 'gl-matrix';
import type { CelestialBody } from './celestial-body';

/**
 * Where the solar-system bodies a build renders actually come from.
 *
 * `Scene` used to `new` every body itself, which meant the set of bodies was fixed at compile
 * time and could only be changed by editing the engine. Content is contributed instead: a
 * provider declares which bodies it supplies and how to build them, and `Scene.init()` asks
 * for whatever registered. That is what lets the free build ship the planets, Mars' moons and
 * the dwarf planets while the Solar System Pack adds the outer moons, the big four asteroids
 * and the belt - with neither build's code knowing which one it is in.
 *
 * ## Two-phase on purpose
 *
 * A provider declares its {@link SolarBody} ids *up front* and hands over a thunk that builds
 * the objects later. The ids have to be answerable before anything is constructed, because
 * the Planets menu asks "does this build have Europa?" while deciding what to render, and the
 * bodies themselves touch GL and settings and cannot exist that early. So
 * {@link isBodyRegistered} reads the declared ids and never runs a provider.
 *
 * The cost is that a provider must not build a body it did not declare; that is what
 * {@link createRegisteredBodies} asserts in development.
 *
 * ## Timing
 *
 * Registration happens during plugin `init()`, which `src/keeptrack.ts` runs *before*
 * `Scene.init()`. There is no event to wait for and no ordering constraint between providers.
 *
 * The one rule for consumers is the same as the roster's: **never snapshot this into a
 * module-level constant.** Read through the functions every time.
 */

/** Which of `Scene`'s buckets a provider's bodies belong in. */
export enum RegisteredBodyKind {
  /** A moon of a planet other than Earth. Filed into `Scene.moons`. */
  Moon = 'moon',
  /** A main-belt asteroid rendered as a real body. Filed into `Scene.asteroids`. */
  Asteroid = 'asteroid',
}

/** Builds the bodies a provider supplies, keyed by body. Called once, from `Scene.init()`. */
export type CelestialBodyProvider = () => Partial<Record<SolarBody, CelestialBody>>;

interface ProviderEntry {
  kind: RegisteredBodyKind;
  ids: readonly SolarBody[];
  build: CelestialBodyProvider;
}

const providers_: ProviderEntry[] = [];
const registeredIds_ = new Set<SolarBody>();

/**
 * Contribute a group of bodies.
 *
 * @param kind Which `Scene` bucket the bodies belong in.
 * @param ids Every body this provider will build. Declared separately from the build step so
 *   {@link isBodyRegistered} can answer without constructing anything - see the note above.
 * @param build Builds the bodies. Runs once, inside `Scene.init()`, with a live GL context.
 */
export function registerBodyProvider(kind: RegisteredBodyKind, ids: readonly SolarBody[], build: CelestialBodyProvider): void {
  providers_.push({ kind, ids, build });
  for (const id of ids) {
    registeredIds_.add(id);
  }
}

/**
 * True when some provider supplies this body in this build.
 *
 * The predicate the UI should gate on. A body can be a perfectly valid {@link SolarBody} -
 * the enum deliberately keeps every member in both builds so saved views and URLs stay
 * parseable - and still not exist here.
 */
export function isBodyRegistered(body: SolarBody): boolean {
  return registeredIds_.has(body);
}

/** Every body id any provider supplies, in registration order. */
export function registeredBodyIds(): readonly SolarBody[] {
  return [...registeredIds_];
}

/**
 * Build every body registered for one bucket. Called once per bucket from `Scene.init()`.
 */
export function createRegisteredBodies(kind: RegisteredBodyKind): Partial<Record<SolarBody, CelestialBody>> {
  const built: Partial<Record<SolarBody, CelestialBody>> = {};

  for (const provider of providers_) {
    if (provider.kind !== kind) {
      continue;
    }

    const bodies = provider.build();

    for (const [id, body] of Object.entries(bodies)) {
      /*
       * A body built but not declared would be invisible to isBodyRegistered, so the menu
       * would hide something the scene is drawing. Cheap to catch here, maddening to find
       * from the symptom.
       */
      if (!registeredIds_.has(id as SolarBody)) {
        throw new Error(`Body provider built "${id}" without declaring it. Add it to the ids passed to registerBodyProvider.`);
      }
      built[id as SolarBody] = body;
    }
  }

  return built;
}

/**
 * The procedural asteroid belt, as the engine sees it.
 *
 * Declared here rather than imported because the implementation is Pro content and the free
 * build must compile without it. Only the two calls `Scene` makes are in the contract.
 */
export interface SolarSystemDustField {
  init(gl: WebGL2RenderingContext): void;
  draw(pMvCamMatrix: mat4, simTime: Date, worldShift: readonly [number, number, number], targetBuffer: WebGLFramebuffer | null): void;
}

let dustField_: SolarSystemDustField | null = null;

/** Contribute the procedural belt. At most one; a second call replaces the first. */
export function registerDustField(field: SolarSystemDustField): void {
  dustField_ = field;
}

/** The registered belt, or null in a build that has none. Callers must handle null. */
export function registeredDustField(): SolarSystemDustField | null {
  return dustField_;
}

/**
 * Drop every registration. Test-support only - the app registers once and never unwinds.
 */
export function clearBodyRegistry(): void {
  providers_.length = 0;
  registeredIds_.clear();
  dustField_ = null;
}
