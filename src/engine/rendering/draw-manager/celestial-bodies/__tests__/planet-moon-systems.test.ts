import { SolarBody } from '@app/engine/core/interfaces';
import {
  allPlanetMoons,
  clearPlanetSystems,
  parentPlanetOf,
  registerPlanetSystem,
  systemCompanionsOf,
} from '@app/engine/rendering/draw-manager/celestial-bodies/planet-moon-systems';

/**
 * The Pluto-Charon binary lives outside the moon roster (Charon rides its own heliocentric
 * Chebyshev ephemeris), so its companionship is a table of its own. These tests pin the two
 * properties the scene depends on: each half draws the other, and the pair stays invisible
 * to the roster-driven machinery (moon lists, orbit rings, parent lookups).
 */
describe('planet-moon-systems binary companions', () => {
  beforeEach(clearPlanetSystems);

  it('draws each half of the Pluto-Charon binary from the other', () => {
    expect(systemCompanionsOf(SolarBody.Pluto)).toEqual([SolarBody.Charon]);
    expect(systemCompanionsOf(SolarBody.Charon)).toEqual([SolarBody.Pluto]);
  });

  it('keeps the binary out of the moon roster', () => {
    expect(allPlanetMoons()).not.toContain(SolarBody.Charon);
    expect(parentPlanetOf(SolarBody.Charon)).toBeNull();
  });

  it('does not attach the binary to unrelated systems', () => {
    registerPlanetSystem(SolarBody.Jupiter, [SolarBody.Io, SolarBody.Europa]);

    expect(systemCompanionsOf(SolarBody.Jupiter)).toEqual([SolarBody.Io, SolarBody.Europa]);
    expect(systemCompanionsOf(SolarBody.Io)).toEqual([SolarBody.Jupiter, SolarBody.Europa]);
  });

  it('keeps the binary intact if Pluto ever gains roster moons', () => {
    // Nix and Hydra would land in the roster; Charon must still be drawn first as the binary partner.
    registerPlanetSystem(SolarBody.Pluto, ['Nix' as SolarBody]);

    expect(systemCompanionsOf(SolarBody.Pluto)).toEqual([SolarBody.Charon, 'Nix' as SolarBody]);
  });
});
