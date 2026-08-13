import { SolarBody } from '@app/engine/core/interfaces';
import { clearBodyRegistry, RegisteredBodyKind, registerBodyProvider } from '@app/engine/rendering/draw-manager/celestial-bodies/body-registry';
import type { CelestialBody } from '@app/engine/rendering/draw-manager/celestial-bodies/celestial-body';
import { registerMarsMoons } from '@app/engine/rendering/draw-manager/celestial-bodies/mars-moon-catalog';
import { clearPlanetSystems, registerPlanetSystem } from '@app/engine/rendering/draw-manager/celestial-bodies/planet-moon-systems';
import {
  allBodies,
  asteroids,
  categoryOf,
  DWARF_PLANETS,
  displayGroups,
  isKnownBody,
  isPlanned,
  isSelectableBody,
  moons,
  OTHER_CELESTIAL_BODIES,
  PLANETS,
  PLANNED_BODIES,
  satellitesOf,
} from '@app/plugins/planets-menu/planets-bodies';

/**
 * The menu taxonomy is no longer a fixed list - it reflects whatever content registered. So
 * these tests register content themselves rather than assuming a roster, and the interesting
 * assertions are about what appears and disappears with it.
 *
 * `registerMarsMoons()` is the built-in content every build ships. Everything else (the outer
 * moons, the big four asteroids) is the Solar System Pack, stubbed here so the OSS test suite
 * can prove the gating both ways without depending on the pro submodule being present.
 */
const stubBody = () => ({}) as CelestialBody;

/** Stands in for the pack, registering the bodies it would contribute. */
function registerStubPack(): void {
  registerPlanetSystem(SolarBody.Jupiter, [SolarBody.Io, SolarBody.Europa, SolarBody.Ganymede, SolarBody.Callisto]);
  registerBodyProvider(RegisteredBodyKind.Moon, [SolarBody.Io, SolarBody.Europa, SolarBody.Ganymede, SolarBody.Callisto], () => ({
    [SolarBody.Io]: stubBody(),
    [SolarBody.Europa]: stubBody(),
    [SolarBody.Ganymede]: stubBody(),
    [SolarBody.Callisto]: stubBody(),
  }));
  registerBodyProvider(RegisteredBodyKind.Asteroid, [SolarBody.Vesta, SolarBody.Juno, SolarBody.Pallas, SolarBody.Hygiea], () => ({
    [SolarBody.Vesta]: stubBody(),
    [SolarBody.Juno]: stubBody(),
    [SolarBody.Pallas]: stubBody(),
    [SolarBody.Hygiea]: stubBody(),
  }));
}

describe('planets-bodies', () => {
  beforeEach(() => {
    clearBodyRegistry();
    clearPlanetSystems();
    registerMarsMoons();
  });

  it('lists each body exactly once across the categories', () => {
    const all = [...PLANETS, ...DWARF_PLANETS, ...asteroids(), ...moons(), ...OTHER_CELESTIAL_BODIES];

    expect(new Set(all).size).toBe(all.length);
    expect(allBodies()).toHaveLength(all.length);
  });

  describe('with only the built-in content', () => {
    it("ships Earth's Moon, the two Mars moons, and Charon, and no others", () => {
      expect(moons()).toEqual([SolarBody.Moon, SolarBody.Phobos, SolarBody.Deimos, SolarBody.Charon]);
    });

    it('ships no asteroids', () => {
      expect(asteroids()).toEqual([]);
    });

    it("leaves the pack's bodies out of the menu entirely", () => {
      expect(isKnownBody(SolarBody.Io)).toBe(false);
      expect(isKnownBody(SolarBody.Vesta)).toBe(false);
      expect(satellitesOf(SolarBody.Jupiter)).toEqual([]);
    });

    it('collapses the asteroid-belt card to Ceres rather than showing dead rows', () => {
      const belt = displayGroups().find((group) => group.key === 'asteroidBelt')!;

      expect(belt.bodies).toEqual([SolarBody.Ceres]);
    });
  });

  describe('with the pack registered', () => {
    beforeEach(registerStubPack);

    it("adds the pack's moons under their planet", () => {
      expect(satellitesOf(SolarBody.Jupiter)).toEqual([SolarBody.Io, SolarBody.Europa, SolarBody.Ganymede, SolarBody.Callisto]);
      expect(isKnownBody(SolarBody.Io)).toBe(true);
    });

    it('restores the full asteroid-belt card in mean-distance order', () => {
      const belt = displayGroups().find((group) => group.key === 'asteroidBelt')!;

      expect(belt.bodies).toEqual([SolarBody.Vesta, SolarBody.Juno, SolarBody.Ceres, SolarBody.Pallas, SolarBody.Hygiea]);
    });

    it("classifies the pack's bodies into the right categories", () => {
      expect(categoryOf(SolarBody.Io)).toBe('moons');
      expect(categoryOf(SolarBody.Vesta)).toBe('asteroids');
    });
  });

  it('treats only the listed bodies as planned', () => {
    for (const body of PLANNED_BODIES) {
      expect(isPlanned(body)).toBe(true);
      expect(isSelectableBody(body)).toBe(false);
    }
    expect(isPlanned(SolarBody.Mars)).toBe(false);
    expect(isPlanned(SolarBody.Moon)).toBe(false);
  });

  it('marks every listed body selectable now that no moon is merely planned', () => {
    expect(PLANNED_BODIES.size).toBe(0);
    for (const body of allBodies()) {
      expect(isSelectableBody(body)).toBe(true);
    }
  });

  it('rejects unknown bodies', () => {
    expect(isKnownBody('Nibiru' as SolarBody)).toBe(false);
    expect(categoryOf('Nibiru' as SolarBody)).toBeNull();
  });

  it('classifies the built-in bodies into the correct category', () => {
    expect(categoryOf(SolarBody.Earth)).toBe('planets');
    expect(categoryOf(SolarBody.Pluto)).toBe('dwarfPlanets');
    expect(categoryOf(SolarBody.Moon)).toBe('moons');
    expect(categoryOf(SolarBody.Phobos)).toBe('moons');
    // Charon is Pluto's moon by classification, even though it renders as a Chebyshev body.
    expect(categoryOf(SolarBody.Charon)).toBe('moons');
    expect(categoryOf(SolarBody.Sun)).toBe('otherCelestialBodies');
  });

  describe('displayGroups', () => {
    beforeEach(registerStubPack);

    const displayedBodies = () => displayGroups().flatMap((group) => group.bodies.flatMap((body) => [body, ...satellitesOf(body)]));

    it('shows every known body exactly once', () => {
      const displayed = displayedBodies();

      expect(new Set(displayed).size).toBe(displayed.length);
      expect(new Set(displayed)).toEqual(new Set(allBodies()));
    });

    it('runs outward from the Sun', () => {
      const displayed = displayedBodies();

      expect(displayed[0]).toBe(SolarBody.Sun);
      expect(displayed.indexOf(SolarBody.Mercury)).toBeLessThan(displayed.indexOf(SolarBody.Earth));
      expect(displayed.indexOf(SolarBody.Mars)).toBeLessThan(displayed.indexOf(SolarBody.Vesta));
      expect(displayed.indexOf(SolarBody.Hygiea)).toBeLessThan(displayed.indexOf(SolarBody.Jupiter));
      expect(displayed.indexOf(SolarBody.Neptune)).toBeLessThan(displayed.indexOf(SolarBody.Pluto));
      expect(displayed.at(-1)).toBe(SolarBody.Sedna);
    });

    it('puts the whole main belt between Mars and Jupiter', () => {
      const displayed = displayedBodies();
      const belt = displayGroups().find((group) => group.key === 'asteroidBelt')!.bodies;

      expect(belt).toContain(SolarBody.Ceres);
      expect(belt).toContain(SolarBody.Vesta);
      for (const body of belt) {
        expect(displayed.indexOf(body)).toBeGreaterThan(displayed.indexOf(SolarBody.Mars));
        expect(displayed.indexOf(body)).toBeLessThan(displayed.indexOf(SolarBody.Jupiter));
      }
    });

    it('nests each moon directly under its planet', () => {
      const displayed = displayedBodies();

      for (const group of displayGroups()) {
        for (const body of group.bodies) {
          const satellites = satellitesOf(body);

          for (let index = 0; index < satellites.length; index++) {
            expect(displayed[displayed.indexOf(body) + 1 + index]).toBe(satellites[index]);
          }
        }
      }
    });

    it('gives Earth its Moon, Mars its two, and Pluto Charon', () => {
      expect(satellitesOf(SolarBody.Earth)).toEqual([SolarBody.Moon]);
      expect(satellitesOf(SolarBody.Mars)).toEqual([SolarBody.Phobos, SolarBody.Deimos]);
      expect(satellitesOf(SolarBody.Pluto)).toEqual([SolarBody.Charon]);
      expect(satellitesOf(SolarBody.Vesta)).toEqual([]);
      expect(satellitesOf(SolarBody.Sun)).toEqual([]);
    });
  });
});
