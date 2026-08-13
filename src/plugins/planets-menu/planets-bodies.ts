import { SolarBody } from '@app/engine/core/interfaces';
import { isBodyRegistered } from '@app/engine/rendering/draw-manager/celestial-bodies/body-registry';
import { allPlanetMoons, PLANET_SYSTEM_MOONS } from '@app/engine/rendering/draw-manager/celestial-bodies/planet-moon-systems';

/**
 * planets-bodies.ts is the single source of truth for the solar-system body
 * taxonomy used by the Planets menu. Keeping the lists and the membership
 * helpers here (instead of inline in the plugin) means the "planned" bodies are
 * derived rather than re-listed, so the menu HTML, the click guard, and the
 * command palette can never drift out of sync.
 */

export type BodyCategory = 'planets' | 'dwarfPlanets' | 'asteroids' | 'moons' | 'otherCelestialBodies';

export const PLANETS: readonly SolarBody[] = [
  SolarBody.Mercury,
  SolarBody.Venus,
  SolarBody.Earth,
  SolarBody.Mars,
  SolarBody.Jupiter,
  SolarBody.Saturn,
  SolarBody.Uranus,
  SolarBody.Neptune,
];

export const DWARF_PLANETS: readonly SolarBody[] = [
  SolarBody.Pluto,
  SolarBody.Makemake,
  SolarBody.Eris,
  SolarBody.Haumea,
  SolarBody.Ceres,
  SolarBody.Sedna,
  SolarBody.Quaoar,
  SolarBody.Orcus,
  SolarBody.Gonggong,
];

/**
 * Earth's Moon first, then every planet moon grouped by parent and ordered outward from it,
 * then Charon. The planet-moon half is pulled from the scene's own roster rather than
 * re-listed, so a moon cannot exist in the renderer and be missing from the menu. Charon is
 * appended by hand because it is Pluto's moon by classification but not by machinery - it
 * rides its own heliocentric Chebyshev ephemeris, not the planet-moon catalog - and Pluto is
 * the outermost parent anyway, so last place is also its ordered place.
 *
 * A function rather than a constant: the roster is registered during plugin init, so a
 * module-level snapshot taken when this file is first imported can miss whatever registers
 * after it. See the load-order note in `planet-moon-systems.ts`.
 */
export function moons(): readonly SolarBody[] {
  return [SolarBody.Moon, ...allPlanetMoons(), SolarBody.Charon];
}

/**
 * Main-belt asteroids rendered as real bodies. Ceres is a dwarf planet and lives above.
 *
 * Every one of these is contributed content, so this is the full set the menu *could* show;
 * {@link displayGroups} filters it down to what the running build actually registered. Lazy
 * for the same reason as {@link moons}.
 */
export function asteroids(): readonly SolarBody[] {
  return [SolarBody.Vesta, SolarBody.Pallas, SolarBody.Juno, SolarBody.Hygiea].filter(isBodyRegistered);
}

export const OTHER_CELESTIAL_BODIES: readonly SolarBody[] = [SolarBody.Sun];

/** One card in the menu: a heading and the primary bodies listed under it. */
export interface BodyDisplayGroup {
  /** Suffix of the `sections.*` locale key for the heading. */
  key: string;
  /**
   * Primary bodies, ordered outward from the Sun. Each one's satellites are rendered
   * indented beneath it by {@link satellitesOf} rather than listed here.
   */
  bodies: readonly SolarBody[];
}

/**
 * The menu reads as one continuous tour of the solar system, from the Sun outward, grouped
 * the way the solar system actually divides: rocky planets, the belt, the two kinds of giant,
 * then everything past Neptune. Ordering inside each group is by mean distance from the Sun,
 * so the list is monotonic all the way down and a body's position on screen tells you
 * something true about where it is.
 *
 * Moons are not listed here - {@link satellitesOf} nests them under their planet, which is
 * the only arrangement that makes a 19-moon roster readable.
 */
const DISPLAY_GROUPS_: readonly BodyDisplayGroup[] = [
  { key: 'star', bodies: [SolarBody.Sun] },
  { key: 'terrestrialPlanets', bodies: [SolarBody.Mercury, SolarBody.Venus, SolarBody.Earth, SolarBody.Mars] },
  // By mean distance: Vesta 2.36, Juno 2.67, Ceres 2.77, Pallas 2.77, Hygiea 3.14 AU.
  { key: 'asteroidBelt', bodies: [SolarBody.Vesta, SolarBody.Juno, SolarBody.Ceres, SolarBody.Pallas, SolarBody.Hygiea] },
  { key: 'gasGiants', bodies: [SolarBody.Jupiter, SolarBody.Saturn] },
  { key: 'iceGiants', bodies: [SolarBody.Uranus, SolarBody.Neptune] },
  // By mean distance: Orcus 39.4, Pluto 39.5, Haumea 43.1, Quaoar 43.7, Makemake 45.4,
  // Gonggong 67.4, Eris 67.8, Sedna 506 AU.
  {
    key: 'transNeptunian',
    bodies: [SolarBody.Orcus, SolarBody.Pluto, SolarBody.Haumea, SolarBody.Quaoar, SolarBody.Makemake, SolarBody.Gonggong, SolarBody.Eris, SolarBody.Sedna],
  },
];

/**
 * The groups above, reduced to the bodies this build can actually render, with any group that
 * ends up empty dropped.
 *
 * The full ordering is written down once, in {@link DISPLAY_GROUPS_}, rather than per build:
 * where a body sits in the tour of the solar system does not change with the build, only
 * whether it is there at all. Contributed bodies - the outer moons and the big four asteroids
 * - are filtered out when nothing registered them, which is what turns the asteroid-belt card
 * into a Ceres-only row in the free build instead of four dead entries.
 */
export function displayGroups(): readonly BodyDisplayGroup[] {
  const groups: BodyDisplayGroup[] = [];

  for (const group of DISPLAY_GROUPS_) {
    const bodies = group.bodies.filter((body) => !CONTRIBUTED_BODIES.has(body) || isBodyRegistered(body));

    if (bodies.length > 0) {
      groups.push({ key: group.key, bodies });
    }
  }

  return groups;
}

/**
 * Bodies that only exist when some provider contributes them, and therefore have to be
 * filtered rather than assumed. Everything else in {@link DISPLAY_GROUPS_} is built into the
 * engine and always present.
 */
const CONTRIBUTED_BODIES: ReadonlySet<SolarBody> = new Set([SolarBody.Vesta, SolarBody.Juno, SolarBody.Pallas, SolarBody.Hygiea]);

/**
 * The bodies shown indented under `body` in the menu: its moons.
 *
 * Earth's Moon and Charon are special-cased because neither belongs to the planet-moon
 * catalog - the Moon predates it, and Charon rides its own heliocentric Chebyshev ephemeris
 * (Pluto-Charon is near enough a binary that both bodies are fitted directly).
 */
export function satellitesOf(body: SolarBody): readonly SolarBody[] {
  if (body === SolarBody.Earth) {
    return [SolarBody.Moon];
  }
  if (body === SolarBody.Pluto) {
    return [SolarBody.Charon];
  }

  return PLANET_SYSTEM_MOONS[body] ?? [];
}

/**
 * Bodies that appear in the menu but are not yet loaded into the scene. They
 * render as disabled rows and are rejected by {@link changePlanet}. Derived
 * membership only - never re-list these inline.
 *
 * Empty since every moon in the menu became real; kept because the disabled-row path is
 * still the right way to advertise a body before it ships.
 */
export const PLANNED_BODIES: ReadonlySet<SolarBody> = new Set([]);

/** Every body the menu knows about, in display order. Lazy for the same reason as {@link moons}. */
export function allBodies(): readonly SolarBody[] {
  return [...PLANETS, ...DWARF_PLANETS, ...asteroids(), ...moons(), ...OTHER_CELESTIAL_BODIES];
}

/** True if the body is listed in the menu but planned for a future update (not yet in the scene). */
export function isPlanned(body: SolarBody): boolean {
  return PLANNED_BODIES.has(body);
}

/** True if the body belongs to any of the menu's categories. */
export function isKnownBody(body: SolarBody): boolean {
  return PLANETS.includes(body) || DWARF_PLANETS.includes(body) || asteroids().includes(body) || moons().includes(body) || OTHER_CELESTIAL_BODIES.includes(body);
}

/** True if the body is known and currently selectable (loaded, not planned). */
export function isSelectableBody(body: SolarBody): boolean {
  return isKnownBody(body) && !isPlanned(body);
}

/** The category a body belongs to, or null if unknown. */
export function categoryOf(body: SolarBody): BodyCategory | null {
  if (PLANETS.includes(body)) {
    return 'planets';
  }
  if (DWARF_PLANETS.includes(body)) {
    return 'dwarfPlanets';
  }
  if (asteroids().includes(body)) {
    return 'asteroids';
  }
  if (moons().includes(body)) {
    return 'moons';
  }
  if (OTHER_CELESTIAL_BODIES.includes(body)) {
    return 'otherCelestialBodies';
  }

  return null;
}
