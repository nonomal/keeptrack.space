import { SpaceObjectType } from '@ootk/src/main';

/**
 * The marker drawn in place of a solar-system body once the camera is far enough out that the
 * body itself is a fraction of a pixel (see `DotsManager.isSolarSystemView_`).
 *
 * Every body used to get the same ringed-planet icon, which said "this is a planet" and nothing
 * else - Ganymede, Vesta and Voyager 1 all wore Saturn's rings. These classes are what the dot
 * is actually standing in for, so the shape carries information the color alone cannot: a rock
 * looks like a rock, a probe looks like a spacecraft, and the four kinds of planet are told
 * apart at a glance.
 *
 * The values are packed four bits each into `u_bodyGlyph` (see {@link packBodyGlyphs}), so they
 * MUST stay in 0..15 and MUST match the `ktBodyGlyphAlpha` dispatch in the dot shaders.
 */
export enum BodyGlyph {
  /** Not a solar-system body - draw the normal satellite dot. */
  None = 0,
  /** Mercury, Venus, Earth, Mars - a plain filled disc. */
  Terrestrial = 1,
  /** Jupiter - a banded disc. */
  GasGiant = 2,
  /** Uranus, Neptune - a disc inside an upright ring, the way Uranus' rings actually sit. */
  IceGiant = 3,
  /** Saturn - the classic tilted ring. */
  Ringed = 4,
  /** Pluto, Ceres, Eris and friends - a small disc inside a broken ring. */
  DwarfPlanet = 5,
  /** Any moon - a crescent. */
  Moon = 6,
  /** Vesta, Pallas, Juno, Hygiea - a lumpy rock. */
  Asteroid = 7,
  /** Voyager, Pioneer, New Horizons - a bus with solar panels. */
  Spacecraft = 8,
}

/**
 * Bodies whose rings are prominent enough to BE the icon. Saturn only: Jupiter, Uranus and
 * Neptune all have rings, but nobody reads a ringed disc as any of them, and Uranus' rings are
 * near-polar anyway - {@link BodyGlyph.IceGiant} draws those upright instead.
 */
const RINGED_BODY_NAMES: ReadonlySet<string> = new Set(['Saturn']);

/**
 * Camera distance, in body radii, below which a body's dot gives way to its mesh - roughly the
 * range at which the body itself is about a pixel wide, which is why it scales with the radius
 * rather than being a fixed distance: the same number works for 14 m Voyager, 6 km Deimos and
 * 71,492 km Jupiter.
 *
 * Two things use it, and they have to agree or a body loses its marker at one range and gets a
 * second one at another: `PlanetMoon.updateDotVisibility_` (a moon's dot, hidden AND unpickable
 * close in) and `DotsManager.hiddenCenterBodySlot_` (the body the view is centered on).
 */
export const DOT_HIDE_BODY_RADII = 2000;

/** Number of glyph slots uploaded to the shader. Room for ~2.5x the bodies that exist today. */
export const BODY_GLYPH_SLOTS = 128;

/** Glyph slots packed per 32-bit word (four bits each). */
const GLYPHS_PER_WORD = 8;

/** Length of the packed `u_bodyGlyph` uniform array. Must match the shader declaration. */
export const BODY_GLYPH_WORDS = BODY_GLYPH_SLOTS / GLYPHS_PER_WORD;

/**
 * The glyph a body's dot should draw.
 *
 * `name` only matters for the handful of bodies whose type is too coarse to pick a shape -
 * Saturn and Jupiter are both `GAS_GIANT`, and only one of them should wear rings.
 *
 * Anything that is not a recognized celestial type falls through to {@link BodyGlyph.Spacecraft}:
 * the only non-body dots in this block are the deep-space probes, which carry ordinary satellite
 * types (`PAYLOAD`).
 */
export function bodyGlyphFor(type: SpaceObjectType, name: string): BodyGlyph {
  switch (type) {
    case SpaceObjectType.TERRESTRIAL_PLANET:
      return BodyGlyph.Terrestrial;
    case SpaceObjectType.GAS_GIANT:
      return RINGED_BODY_NAMES.has(name) ? BodyGlyph.Ringed : BodyGlyph.GasGiant;
    case SpaceObjectType.ICE_GIANT:
      return RINGED_BODY_NAMES.has(name) ? BodyGlyph.Ringed : BodyGlyph.IceGiant;
    case SpaceObjectType.DWARF_PLANET:
      return BodyGlyph.DwarfPlanet;
    case SpaceObjectType.MOON:
      return BodyGlyph.Moon;
    case SpaceObjectType.ASTEROID:
      return BodyGlyph.Asteroid;
    default:
      return BodyGlyph.Spacecraft;
  }
}

/**
 * Packs one glyph class per body into four-bit fields, eight to a word, for upload as
 * `uniform int u_bodyGlyph[BODY_GLYPH_WORDS]`.
 *
 * A per-vertex attribute would be the obvious home for this, but it would cost a whole extra
 * buffer across the full catalog (tens of thousands of dots) to describe fewer than fifty of
 * them, and it would have to be threaded through both the base and symbology VAOs. The bodies
 * occupy one contiguous index range, so a small uniform indexed by `gl_VertexID - u_planetIdx1`
 * says the same thing in sixteen ints.
 *
 * Glyphs past {@link BODY_GLYPH_SLOTS} are dropped rather than wrapping onto another body.
 */
export function packBodyGlyphs(glyphs: readonly BodyGlyph[]): Int32Array {
  const words = new Int32Array(BODY_GLYPH_WORDS);
  const count = Math.min(glyphs.length, BODY_GLYPH_SLOTS);

  for (let i = 0; i < count; i++) {
    words[Math.floor(i / GLYPHS_PER_WORD)] |= (glyphs[i] & 0xf) << ((i % GLYPHS_PER_WORD) * 4);
  }

  return words;
}
