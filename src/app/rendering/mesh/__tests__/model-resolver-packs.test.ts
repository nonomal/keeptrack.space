import { type MeshVariantPack, ModelResolver, SatelliteModels } from '@app/app/rendering/mesh/model-resolver';
import { Satellite, SpaceObjectType, TleLine1, TleLine2 } from '@ootk/src/main';

/*
 * The variant-pack contract, exercised with a synthetic pack so the free build's own routing is
 * the thing under test rather than whatever Pro happens to ship. The guarantee that a build with
 * NO pack routes exactly as it always did lives in model-resolver.test.ts and
 * model-resolver-satellites.test.ts, neither of which registers anything.
 *
 * ModelResolver's pack state is static, so this file is separate: registering here must not leak
 * into the free-routing assertions elsewhere.
 */

const makeSat = (over: Partial<Satellite> = {}): Satellite =>
  Object.assign(Object.create(Satellite.prototype) as Satellite, {
    id: 0,
    name: 'GENERIC SAT',
    sccNum: '99990',
    type: SpaceObjectType.PAYLOAD,
    bus: 'Unknown',
    intlDes: '2020-001A',
    shape: '',
    span: '',
    diameter: '',
    length: '',
    launchVehicle: '',
    tle1: '' as TleLine1,
    tle2: '' as TleLine2,
    ...over,
  });

/** Every model resolved across a run of sccNums, so a pool's spread is visible. */
const resolvedAcross = (resolver: ModelResolver, over: Partial<Satellite>, count = 400): Set<string> => {
  const seen = new Set<string>();

  for (let i = 0; i < count; i++) {
    seen.add(resolver.resolve(makeSat({ ...over, sccNum: String(10000 + i) })));
  }

  return seen;
};

const TEST_PACK: MeshVariantPack = {
  models: ['test-cube-a', 'test-cube-b', 'test-silhouette', 'test-debris-shape', 'test-generic'],
  poolExtensions: {
    // Anchored on the free 1U cubesat, which already has one variant of its own.
    s1u: ['test-cube-a', 'test-cube-b'],
    // An anchor no free pool uses: must be inert rather than an error.
    'not-a-pool-anchor': ['test-cube-a'],
  },
  routes: {
    rocketBodySilhouette: (shape) => (shape === 'test+shape' ? 'test-silhouette' : null),
    debrisShape: (shape) => (shape === 'test-shape' ? 'test-debris-shape' : null),
    genericShape: (ctx) => (ctx.shape.includes('blob') ? 'test-generic' : null),
  },
};

describe('ModelResolver variant packs', () => {
  let resolver: ModelResolver;

  beforeAll(() => {
    ModelResolver.registerVariantPack('test-pack', TEST_PACK);
  });

  beforeEach(() => {
    resolver = new ModelResolver();
  });

  describe('registration', () => {
    it('is idempotent under the same pack id, so a double boot cannot double a pool', () => {
      const before = resolvedAcross(resolver, { bus: 'Cubesat 1U' }).size;

      ModelResolver.registerVariantPack('test-pack', TEST_PACK);

      expect(resolvedAcross(resolver, { bus: 'Cubesat 1U' }).size).toBe(before);
    });

    it('registers the pack models for meshOverride and the model pickers', () => {
      expect(ModelResolver.isRegisteredModel('test-cube-a')).toBe(true);
      expect(ModelResolver.getAvailableModelNames()).toContain('test-cube-a');
    });

    it('does not register a model the pack never declared', () => {
      expect(ModelResolver.isRegisteredModel('test-cube-z')).toBe(false);
    });
  });

  describe('pool extensions', () => {
    it('appends to the pool anchored by the named model, keeping the free models in it', () => {
      const resolved = resolvedAcross(resolver, { bus: 'Cubesat 1U' });

      expect(resolved).toContain(SatelliteModels.s1u);
      expect(resolved).toContain(SatelliteModels['s1u-b']);
      expect(resolved).toContain('test-cube-a');
      expect(resolved).toContain('test-cube-b');
      expect(resolved.size).toBe(4);
    });

    it('leaves a pool the pack did not name at its free length', () => {
      const resolved = resolvedAcross(resolver, { bus: 'Cubesat 6U' });

      expect(resolved.size).toBe(3);
      expect([...resolved].every((model) => model.startsWith('s6u'))).toBe(true);
    });

    it('ignores an anchor that matches no pool rather than failing the resolve', () => {
      expect(resolver.resolve(makeSat({ bus: 'Cubesat 2U' }))).toBe(SatelliteModels.s2u);
    });

    it('still resolves the same object to the same model every time', () => {
      const sat = makeSat({ bus: 'Cubesat 1U', sccNum: '41783' });

      expect(resolver.resolve(sat)).toBe(new ModelResolver().resolve(sat));
    });
  });

  describe('route hooks fire at their documented point in the chain', () => {
    it('takes a pack silhouette only after the free silhouette table misses', () => {
      const packShape = resolver.resolve(makeSat({ type: SpaceObjectType.ROCKET_BODY, shape: 'test + shape' }));
      const freeShape = resolver.resolve(makeSat({ type: SpaceObjectType.ROCKET_BODY, shape: 'Trunc Cone' }));

      expect(packShape).toBe('test-silhouette');
      expect(freeShape).toBe(SatelliteModels['rb-trunccone-gray']);
    });

    it('takes a pack debris shape only after the free specials miss', () => {
      const packShape = resolver.resolve(makeSat({ type: SpaceObjectType.DEBRIS, shape: 'test-shape' }));
      const freeShape = resolvedAcross(resolver, { type: SpaceObjectType.DEBRIS, shape: 'Torus' });

      expect(packShape).toBe('test-debris-shape');
      expect(freeShape).toEqual(new Set([SatelliteModels['deb-torus-01'], SatelliteModels['deb-torus-02']]));
    });

    it('falls through to the free generic pool when no pack route matches', () => {
      const resolved = resolvedAcross(resolver, { type: SpaceObjectType.DEBRIS }, 2000);

      expect(resolved.size).toBe(19);
    });

    it('takes a pack generic shape only after every free archetype declines', () => {
      const packShape = resolver.resolve(makeSat({ shape: 'Blob' }));
      // The free box archetype claims this one even though the pack's hook would also match it.
      const freeShape = resolver.resolve(makeSat({ shape: 'Box + blob', span: '1' }));

      expect(packShape).toBe('test-generic');
      expect(freeShape).toBe(SatelliteModels['gen-box-solar']);
    });

    it('keeps the legacy generic mesh when no pack route claims the shape either', () => {
      expect(resolver.resolve(makeSat({ shape: 'Unknowable' }))).toBe(SatelliteModels.sat2);
    });

    it('leaves a hook the pack did not supply inert', () => {
      // TEST_PACK supplies no rocketBodyFamily hook, so the free families still decide.
      expect(resolver.resolve(makeSat({ type: SpaceObjectType.ROCKET_BODY, launchVehicle: 'Falcon 9' }))).toBe(SatelliteModels['rb-cyl-kerolox']);
    });
  });
});
