/* eslint-disable dot-notation */

import { BODY_GLYPH_SLOTS, BODY_GLYPH_WORDS, BodyGlyph, bodyGlyphFor, packBodyGlyphs } from '@app/engine/rendering/body-glyph';
import { DotsManager } from '@app/engine/rendering/dots-manager';
import { createBaseFragShader, createBaseVertShader } from '@app/engine/rendering/dots-shaders-base';
import { SettingsManager } from '@app/settings/settings';
import { SpaceObjectType } from '@ootk/src/main';

/** Reads a slot back out of the packed words, mirroring `ktBodyGlyphAt` in the shader. */
const unpack = (words: Int32Array, slot: number): number => (words[slot >> 3] >> ((slot & 7) * 4)) & 15;

describe('bodyGlyphFor', () => {
  it('gives each kind of planet its own glyph', () => {
    expect(bodyGlyphFor(SpaceObjectType.TERRESTRIAL_PLANET, 'Mars')).toBe(BodyGlyph.Terrestrial);
    expect(bodyGlyphFor(SpaceObjectType.GAS_GIANT, 'Jupiter')).toBe(BodyGlyph.GasGiant);
    expect(bodyGlyphFor(SpaceObjectType.ICE_GIANT, 'Neptune')).toBe(BodyGlyph.IceGiant);
    expect(bodyGlyphFor(SpaceObjectType.ICE_GIANT, 'Uranus')).toBe(BodyGlyph.IceGiant);
  });

  it('reserves the ringed glyph for Saturn, not every gas giant', () => {
    expect(bodyGlyphFor(SpaceObjectType.GAS_GIANT, 'Saturn')).toBe(BodyGlyph.Ringed);
    expect(bodyGlyphFor(SpaceObjectType.GAS_GIANT, 'Jupiter')).not.toBe(BodyGlyph.Ringed);
  });

  it('separates the small bodies from the planets', () => {
    expect(bodyGlyphFor(SpaceObjectType.DWARF_PLANET, 'Pluto')).toBe(BodyGlyph.DwarfPlanet);
    expect(bodyGlyphFor(SpaceObjectType.MOON, 'Ganymede')).toBe(BodyGlyph.Moon);
    expect(bodyGlyphFor(SpaceObjectType.ASTEROID, 'Vesta')).toBe(BodyGlyph.Asteroid);
  });

  it('treats anything that is not a celestial type as a spacecraft', () => {
    // The deep-space probes share the body dot block but carry ordinary satellite types
    expect(bodyGlyphFor(SpaceObjectType.PAYLOAD, 'Voyager 1')).toBe(BodyGlyph.Spacecraft);
    expect(bodyGlyphFor(SpaceObjectType.UNKNOWN, 'Pioneer 10')).toBe(BodyGlyph.Spacecraft);
  });
});

describe('packBodyGlyphs', () => {
  it('round-trips every glyph through the four-bit packing the shader unpacks', () => {
    const glyphs = [
      BodyGlyph.Terrestrial,
      BodyGlyph.GasGiant,
      BodyGlyph.IceGiant,
      BodyGlyph.Ringed,
      BodyGlyph.DwarfPlanet,
      BodyGlyph.Moon,
      BodyGlyph.Asteroid,
      BodyGlyph.Spacecraft,
    ];
    const words = packBodyGlyphs(glyphs);

    for (const [i, glyph] of glyphs.entries()) {
      expect(unpack(words, i)).toBe(glyph);
    }
  });

  it('keeps slots independent across the word boundary', () => {
    const glyphs = new Array<BodyGlyph>(20).fill(BodyGlyph.None);

    glyphs[7] = BodyGlyph.Asteroid;
    glyphs[8] = BodyGlyph.Spacecraft;
    glyphs[19] = BodyGlyph.Moon;

    const words = packBodyGlyphs(glyphs);

    expect(unpack(words, 6)).toBe(BodyGlyph.None);
    expect(unpack(words, 7)).toBe(BodyGlyph.Asteroid);
    expect(unpack(words, 8)).toBe(BodyGlyph.Spacecraft);
    expect(unpack(words, 9)).toBe(BodyGlyph.None);
    expect(unpack(words, 19)).toBe(BodyGlyph.Moon);
  });

  it('always returns exactly the uniform array length the shader declares', () => {
    expect(packBodyGlyphs([])).toHaveLength(BODY_GLYPH_WORDS);
    expect(packBodyGlyphs(new Array<BodyGlyph>(BODY_GLYPH_SLOTS * 2).fill(BodyGlyph.Moon))).toHaveLength(BODY_GLYPH_WORDS);
  });

  it('drops overflow instead of wrapping it onto another body', () => {
    const glyphs = new Array<BodyGlyph>(BODY_GLYPH_SLOTS + 4).fill(BodyGlyph.None);

    glyphs[BODY_GLYPH_SLOTS] = BodyGlyph.Ringed;

    const words = packBodyGlyphs(glyphs);

    expect(words.every((word) => word === 0)).toBe(true);
  });
});

describe('dot shaders', () => {
  const settings = new SettingsManager();

  it('draws a distinct shape for every glyph class', () => {
    const frag = createBaseFragShader(settings);
    // None is not drawn, and Terrestrial is the plain disc ktBodyGlyphAlpha falls back to.
    const dispatched = Object.values(BodyGlyph).filter((value): value is BodyGlyph => typeof value === 'number' && value !== BodyGlyph.None && value !== BodyGlyph.Terrestrial);

    /*
     * Every other class needs its own branch. Without this, adding a BodyGlyph member and
     * forgetting the shape leaves those bodies silently wearing the terrestrial disc - which
     * is exactly the "one icon for everything" problem the classes exist to fix.
     */
    for (const glyph of dispatched) {
      expect(frag).toContain(`glyph == ${glyph}`);
    }
    expect(frag).toContain('return ktTerrestrialAlpha(p, scale, aa);');
  });

  it('unpacks the glyph table with the same word/slot layout as packBodyGlyphs', () => {
    const vert = createBaseVertShader(settings);

    expect(vert).toContain(`uniform int u_bodyGlyph[${BODY_GLYPH_WORDS}]`);
    expect(vert).toContain(`slot >= ${BODY_GLYPH_SLOTS}`);
    expect(vert).toContain('(u_bodyGlyph[slot >> 3] >> ((slot & 7) * 4)) & 15');
  });

  /*
   * The vertex shader decides once what a dot DRAWS and hands it over as vGlyph. If the
   * fragment shader re-applied a gate of its own the two could disagree, and the sprite size
   * (which only the vertex shader knows) would be reserved for a glyph that never appears.
   */
  it('resolves the drawn glyph once, in the vertex shader', () => {
    const vert = createBaseVertShader(settings);
    const frag = createBaseFragShader(settings);

    expect(vert).toContain('u_planetGlyph) ? float(glyph) : 0.0;');
    expect(vert).toContain('drawSize *= 1.0 + 0.4 * step(0.5, glyphDrawn);');
    expect(frag).toContain('bool hasGlyph = vGlyph > 0.5;');
    expect(frag).not.toContain('u_planetGlyph');
  });

  /*
   * Dropping only the glyph left a plain star-size dot sitting on the mesh. The whole dot has
   * to go, and it has to go in the picking shader too or it stays an invisible click target
   * stealing clicks aimed at the body.
   */
  it('drops the whole hidden-body dot, in the visual and picking shaders alike', () => {
    const vert = createBaseVertShader(settings);
    const dots = new DotsManager();

    dots['settings_'] = settings;
    dots['initShaders_']();

    for (const source of [vert, dots.shaders_.picking.vert]) {
      expect(source).toContain('if (gl_VertexID == u_hiddenBodyIdx) {');
      expect(source).toContain('gl_PointSize = 0.0;');
    }
  });

  /*
   * REGRESSION. The cull first compared the body-block SLOT, which is -1 for every vertex
   * outside the block - exactly the value DotsManager sends when nothing is hidden. So the
   * moment you zoomed out far enough for the center body to want its dot back, the cull
   * swallowed every star, satellite and marker in the catalog instead. Comparing gl_VertexID,
   * which is never negative, makes the sentinel unmatchable by construction.
   */
  it('never compares the hidden-dot sentinel against a value a non-body vertex can hold', () => {
    const dots = new DotsManager();

    dots['settings_'] = settings;
    dots['initShaders_']();

    for (const source of [createBaseVertShader(settings), dots.shaders_.picking.vert]) {
      expect(source).not.toMatch(/bodySlot\s*==\s*u_hiddenBodyIdx/u);
    }
  });

  /*
   * isPlanet drives the near-origin cull exemption (Earth's dot sits AT the ECI origin) and
   * the star-branch exclusion, and both have to hold for the center body too - so it must come
   * off the glyph a body HAS, never the one it draws.
   */
  it('keeps the planet flag on the body glyph, not the drawn one', () => {
    const vert = createBaseVertShader(settings);

    expect(vert).toContain(`float isPlanet = (glyph > ${BodyGlyph.None} && glyph != ${BodyGlyph.Spacecraft}) ? 1.0 : 0.0;`);
  });
});
