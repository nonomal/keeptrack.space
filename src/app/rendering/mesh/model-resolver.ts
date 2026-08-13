import type { MissileObject } from '@app/app/data/catalog-manager/MissileObject';
import { OemSatellite } from '@app/app/objects/oem-satellite';
import { BaseObject, Satellite, SpaceObjectType } from '@ootk/src/main';

export const SatelliteModels = {
  aehf: 'aehf',
  'amazon-leo': 'amazon-leo',
  debris0: 'debris0',
  debris1: 'debris1',
  debris2: 'debris2',
  'deb-panel-01': 'deb-panel-01',
  'deb-panel-02': 'deb-panel-02',
  'deb-panel-03': 'deb-panel-03',
  'deb-bracket-01': 'deb-bracket-01',
  'deb-bracket-02': 'deb-bracket-02',
  'deb-bracket-03': 'deb-bracket-03',
  'deb-skin-01': 'deb-skin-01',
  'deb-skin-02': 'deb-skin-02',
  'deb-skin-03': 'deb-skin-03',
  'deb-clampband-01': 'deb-clampband-01',
  'deb-clampband-02': 'deb-clampband-02',
  'deb-clampband-03': 'deb-clampband-03',
  'deb-mli-01': 'deb-mli-01',
  'deb-mli-02': 'deb-mli-02',
  'deb-mli-03': 'deb-mli-03',
  'deb-mli-04': 'deb-mli-04',
  'deb-strut-01': 'deb-strut-01',
  'deb-strut-02': 'deb-strut-02',
  'deb-strut-03': 'deb-strut-03',
  'deb-cone-01': 'deb-cone-01',
  'deb-cone-02': 'deb-cone-02',
  'deb-torus-01': 'deb-torus-01',
  'deb-torus-02': 'deb-torus-02',
  'deb-cyl-01': 'deb-cyl-01',
  'deb-cyl-02': 'deb-cyl-02',
  dsp: 'dsp',
  flock: 'flock',
  galileo: 'galileo',
  globalstar: 'globalstar',
  glonass: 'glonass',
  gps: 'gps',
  hubble: 'hubble',
  iridium: 'iridium',
  iss: 'iss',
  lemur: 'lemur',
  misl: 'misl',
  misl2: 'misl2',
  misl3: 'misl3',
  'misl3-2': 'misl3-2',
  'misl3-6': 'misl3-6',
  'misl3-8': 'misl3-8',
  'misl3-10': 'misl3-10',
  misl4: 'misl4',
  'misl4-2': 'misl4-2',
  'misl4-6': 'misl4-6',
  'misl4-8': 'misl4-8',
  'misl4-10': 'misl4-10',
  o3b: 'o3b',
  oneweb: 'oneweb',
  orbcomm: 'orbcomm',
  orion: 'orion',
  'rb-cyl-centaur': 'rb-cyl-centaur',
  'rb-cyl-china': 'rb-cyl-china',
  'rb-cyl-delta': 'rb-cyl-delta',
  'rb-cyl-electron': 'rb-cyl-electron',
  'rb-cyl-euro': 'rb-cyl-euro',
  'rb-cyl-gray-s': 'rb-cyl-gray-s',
  'rb-cyl-gray-m': 'rb-cyl-gray-m',
  'rb-cyl-gray-l': 'rb-cyl-gray-l',
  'rb-cyl-kerolox': 'rb-cyl-kerolox',
  'rb-cyl-proton': 'rb-cyl-proton',
  'rb-cyl-soviet': 'rb-cyl-soviet',
  'rb-cyl-soviet-b': 'rb-cyl-soviet-b',
  'rb-cyl2n-legacy': 'rb-cyl2n-legacy',
  'rb-cylcone-soviet': 'rb-cylcone-soviet',
  'rb-sphercone-kick': 'rb-sphercone-kick',
  'rb-stepcyl-soviet': 'rb-stepcyl-soviet',
  'rb-trunccone-gray': 'rb-trunccone-gray',
  rv: 'rv',
  's0.5u': 's0.5u',
  s1u: 's1u',
  's1u-b': 's1u-b',
  's1.5u': 's1.5u',
  s2u: 's2u',
  s3u: 's3u',
  's3u-b': 's3u-b',
  's3u-w': 's3u-w',
  s4u: 's4u',
  s6u: 's6u',
  's6u-b': 's6u-b',
  's6u-w': 's6u-w',
  s8u: 's8u',
  s12u: 's12u',
  's12u-w': 's12u-w',
  s16u: 's16u',
  's16u-b': 's16u-b',
  'gen-box-s': 'gen-box-s',
  'gen-box-m': 'gen-box-m',
  'gen-box-l': 'gen-box-l',
  'gen-box-xl': 'gen-box-xl',
  'gen-box-xl-b': 'gen-box-xl-b',
  'gen-box-dish': 'gen-box-dish',
  'gen-box-solar': 'gen-box-solar',
  'gen-trap-geo': 'gen-trap-geo',
  'gen-cyl': 'gen-cyl',
  'gen-cyl-dish': 'gen-cyl-dish',
  'gen-cyl-pan': 'gen-cyl-pan',
  'gen-poly': 'gen-poly',
  'gen-hex-pan': 'gen-hex-pan',
  'gen-sphere': 'gen-sphere',
  sat2: 'sat2',
  'saturn-iv-b': 'saturn-iv-b',
  sbirs: 'sbirs',
  ses: 'ses',
  spacebee1gen: 'spacebee1gen',
  spacebee2gen: 'spacebee2gen',
  spacebee3gen: 'spacebee3gen',
  starlink: 'starlink',
  'starlink-v2mini': 'starlink-v2mini',
  sateliotsat: 'sateliotsat',
  sateliotsat2: 'sateliotsat2',
  tiangong: 'tiangong',
  issmodel: 'issmodel',
  jwst: 'jwst',
  voyager: 'voyager',
  lucy: 'lucy',
  'parker-solar-probe': 'parker-solar-probe',
  pioneer: 'pioneer',
  'new-horizons': 'new-horizons',
} as const;

/**
 * One name-matched spacecraft rule: the first pattern whose `match` accepts the
 * catalog name wins, so narrower patterns must be registered ahead of broader
 * ones. See {@link ModelResolver.namedSpacecraft_}.
 */
export interface NamedSpacecraftPattern {
  match: RegExp;
  model: string;
}

/**
 * The catalog `shape` field of a generic payload, already parsed, as handed to a variant pack's
 * route hooks. Packs read this instead of re-parsing `sat.shape` so a pack rule and the free rule
 * beside it always agree on what the record says.
 */
export interface GenericShapeContext {
  /** `shape` lowercased with whitespace and `+` stripped ("Box + 2 pan" -> "box2pan"). */
  shape: string;
  /** 0, 1, or 2 - "2 pan" and up all read as 2, since the meshes only distinguish none/one/wings. */
  panels: number;
  /** The record mentions an antenna/dish. */
  hasAnt: boolean;
  /** `span` in meters, 0 when the record has none. */
  spanM: number;
}

/**
 * A content pack that adds procedural model variants on top of the free routing.
 *
 * Two ways to contribute, and the difference matters:
 *
 * - `poolExtensions` widens a pool the free build already picks from, so a pack model can only
 *   ever be an ALTERNATIVE to the free model that would have been chosen. Nothing reroutes.
 * - `routes` adds a decision the free build cannot make at all (a `shape` value it has no mesh
 *   for, a launch-vehicle family it lumps into the gray sizes). Each hook is consulted at the ONE
 *   point in the chain named on it, so a pack rule can only ever be MORE specific than the free
 *   rule it sits next to - never less.
 *
 * See `plugins-pro/variant-meshes`. A free build registers no pack, so every pool stays its free
 * length and every hook is absent: the routing is exactly what it was before packs existed.
 */
export interface MeshVariantPack {
  /**
   * Every model this pack ships. Registers the names for `settingsManager.meshOverride` and the
   * model pickers; a name that no `poolExtensions`/`routes` entry can return is dead weight but
   * harmless.
   */
  models: readonly string[];
  /**
   * Extra variants appended to an existing pool, keyed by the model that ANCHORS that pool (its
   * index 0). Appended, never inserted, so the free build's own picks keep their meaning; the
   * sccNum hash then spreads objects across the longer pool.
   */
  poolExtensions?: Readonly<Record<string, readonly string[]>>;
  /** Extra routing decisions. Every hook returns null to fall through to the free routing. */
  routes?: {
    /** After the free silhouette table misses on `shape`, before launch-vehicle families. */
    rocketBodySilhouette?(shape: string, sat: Satellite): string | null;
    /** Before the free launch-vehicle families, so a broader free family cannot shadow a pack one. */
    rocketBodyFamily?(launchVehicle: string, sat: Satellite): string | null;
    /** After the free debris shape specials miss, before the generic archetype pool. */
    debrisShape?(shape: string, sat: Satellite): string | null;
    /** Inside the box branch of the generic fallback: after the no-panel case, before the span buckets. */
    genericBox?(ctx: GenericShapeContext, sat: Satellite): string | null;
    /** Last call in the generic fallback, before the legacy `sat2` mesh. */
    genericShape?(ctx: GenericShapeContext, sat: Satellite): string | null;
  };
}

enum SatelliteNumber {
  iss = '25544',
  tiangong = '48274',
  jwst = '50463',
  hubble = '20580',
}

export class ModelResolver {
  /**
   * Model names contributed by registered packs (see {@link registerModelPack}),
   * on top of the free {@link SatelliteModels} set. Static because it has to
   * survive a pack registering before or after any ModelResolver is built.
   */
  private static readonly packModelNames_ = new Set<string>();
  /** Pack ids already registered, so a double registration is a no-op. */
  private static readonly registeredPacks_ = new Set<string>();

  /**
   * Adds a content pack's name-matched spacecraft to the resolver.
   *
   * Pack rules are appended AFTER the built-in ones, so a built-in pattern always wins a
   * collision - packs extend the roster, they never silently retarget a free model.
   *
   * Registration is expected at boot (see registerMeshPacks()), but late registration is
   * harmless: the mesh manager re-resolves every frame, so an object already on screen picks
   * up its pack model on the next one.
   */
  static registerModelPack(packId: string, entries: NamedSpacecraftPattern[]): void {
    if (ModelResolver.registeredPacks_.has(packId)) {
      return;
    }
    ModelResolver.registeredPacks_.add(packId);

    for (const entry of entries) {
      ModelResolver.namedSpacecraft_.push(entry);
      ModelResolver.packModelNames_.add(entry.model);
    }
  }

  /**
   * Variants a pack appended to a pool, keyed by the pool's anchor model (see
   * {@link MeshVariantPack.poolExtensions}). A pool is IDENTIFIED by its anchor, so two pools
   * must never be authored with the same model at index 0 - they would share extensions.
   */
  private static readonly poolExtensions_ = new Map<string, readonly string[]>();
  /** Route hooks contributed by registered variant packs, in registration order. */
  private static readonly variantRoutes_: NonNullable<MeshVariantPack['routes']>[] = [];

  /**
   * Adds a variant pack's models, pool extensions and extra routes to the resolver.
   *
   * Shares the pack-id registry with {@link registerModelPack}, so one pack cannot register both
   * kinds under the same id - give a pack that does both two ids.
   *
   * Registration is expected at boot (see registerMeshPacks()), but late registration is
   * harmless: the mesh manager re-resolves every frame, so an object already on screen picks up
   * its pack variant on the next one.
   */
  static registerVariantPack(packId: string, pack: MeshVariantPack): void {
    if (ModelResolver.registeredPacks_.has(packId)) {
      return;
    }
    ModelResolver.registeredPacks_.add(packId);

    for (const model of pack.models) {
      ModelResolver.packModelNames_.add(model);
    }

    for (const [anchor, extra] of Object.entries(pack.poolExtensions ?? {})) {
      ModelResolver.poolExtensions_.set(anchor, [...(ModelResolver.poolExtensions_.get(anchor) ?? []), ...extra]);
    }

    if (pack.routes) {
      ModelResolver.variantRoutes_.push(pack.routes);
    }
  }

  /**
   * The first non-null answer from a registered pack's hook, or null when no pack routes this
   * object. Packs are asked in registration order.
   */
  private static packRoute_<A>(hook: keyof NonNullable<MeshVariantPack['routes']>, arg: A, sat: Satellite): string | null {
    for (const routes of ModelResolver.variantRoutes_) {
      const model = (routes[hook] as ((arg: A, sat: Satellite) => string | null) | undefined)?.(arg, sat);

      if (model) {
        return model;
      }
    }

    return null;
  }

  /**
   * Picks one model out of a variant pool, including anything a pack appended to it, by a stable
   * hash of the object's sccNum. Public so a pack's own route hooks spread their pools the same
   * way the free routing does.
   */
  static pickFromPool(sat: Satellite, pool: readonly string[]): string {
    const full = ModelResolver.poolExtensions_.get(pool[0]);
    const variants = full ? [...pool, ...full] : pool;

    return variants[ModelResolver.variantIndex_(sat.sccNum, variants.length)];
  }

  /** Every model name this build can resolve: the free set plus any registered pack. */
  static getAvailableModelNames(): string[] {
    return [...Object.values(SatelliteModels), ...ModelResolver.packModelNames_];
  }

  /**
   * This build knows the model, i.e. a mesh is expected to exist for it. Gates
   * `settingsManager.meshOverride` and the model pickers in the ephemeris-import menus, so a
   * pack model is only offered once its pack has registered.
   */
  static isRegisteredModel(name: string): boolean {
    // hasOwn, not `in`: prototype keys like 'toString' must not read as models.
    return Object.hasOwn(SatelliteModels, name) || ModelResolver.packModelNames_.has(name);
  }

  /** Instance-side convenience for {@link ModelResolver.isRegisteredModel}. */
  isRegisteredModel(name: string): boolean {
    return ModelResolver.isRegisteredModel(name);
  }

  private readonly sccNumAehf_ = ['36868', '38254', '39256', '43651', '44481', '45465'];
  private readonly sccNumDsp_ = [
    '04630',
    '05204',
    '05851',
    '06691',
    '08482',
    '08916',
    '09803',
    '11397',
    '12339',
    '13086',
    '14930',
    '15453',
    '18583',
    '20066',
    '20929',
    '21805',
    '23435',
    '24737',
    '26356',
    '26880',
    '28158',
  ];

  resolve(obj: BaseObject): string {
    return this.resolveModelName_(obj);
  }

  private resolveModelName_(obj: BaseObject): string {
    if (obj.isMissile()) {
      return this.resolveMislModelName_(obj as MissileObject);
    } else if (obj instanceof OemSatellite) {
      if (obj.model) {
        return obj.model;
      }

      // Currently no specific model for OEM satellites - default to aehf
      return SatelliteModels.aehf;
    }

    const sat = obj as Satellite;

    switch (sat.type) {
      case SpaceObjectType.PAYLOAD:
        return this.resolveSatModelName_(sat);
      case SpaceObjectType.ROCKET_BODY:
        return this.resolveRocketBodyModelName_(sat);
      case SpaceObjectType.DEBRIS:
        return this.resolveDebrisModelName_(sat);
      default:
      // Generic Model
    }

    return SatelliteModels.sat2;
  }

  /**
   * Non-cylinder silhouettes, matched on the catalog `shape` field with all
   * whitespace stripped (the data mixes "Sphere + Cone" / "Sphere+Cone" etc.).
   * Each maps to a variant pool a pack can widen; the free build ships one
   * model per silhouette, so its pick is fixed.
   */
  private static readonly rbSilhouettes_: Record<string, readonly string[]> = {
    'sphere+cone': [SatelliteModels['rb-sphercone-kick']],
    trunccone: [SatelliteModels['rb-trunccone-gray']],
    truncatedcone: [SatelliteModels['rb-trunccone-gray']],
    stepcyl: [SatelliteModels['rb-stepcyl-soviet']],
    'cyl+cyl': [SatelliteModels['rb-stepcyl-soviet']],
    'cyl+cone': [SatelliteModels['rb-cylcone-soviet']],
    'cyl+2nozzle': [SatelliteModels['rb-cyl2n-legacy']],
  };

  /**
   * Launch-vehicle families for cylinder stages, checked in order. A null
   * pool is a deliberate opt-out (e.g. hydrolox Delta IV is not the teal
   * Delta II) that falls through to the size buckets. Soviet vehicles are
   * handled separately because they split by length.
   */
  private static readonly rbFamilies_: { match: RegExp; pool: readonly string[] | null }[] = [
    { match: /falcon/u, pool: [SatelliteModels['rb-cyl-kerolox']] },
    { match: /electron/u, pool: [SatelliteModels['rb-cyl-electron']] },
    { match: /ariane|vega/u, pool: [SatelliteModels['rb-cyl-euro']] },
    { match: /chang zheng|long march|^cz[\s-]/u, pool: [SatelliteModels['rb-cyl-china']] },
    { match: /atlas|centaur|titan/u, pool: [SatelliteModels['rb-cyl-centaur']] },
    { match: /delta (?:iv|4)/u, pool: null },
    { match: /delta/u, pool: [SatelliteModels['rb-cyl-delta']] },
    { match: /proton|briz|fregat/u, pool: [SatelliteModels['rb-cyl-proton']] },
  ];

  private static readonly rbSovietVehicles_ = /kosmos|cosmos|tsiklon|tsyklon|cyclone|vostok|voskhod|molniya|soyuz|rokot|dnepr|zenit|shtil|angara|sputnik/u;

  /** Standard-length Soviet stages; the squat rb-cyl-soviet-b stays a length split, not a variant. */
  private static readonly rbSovietStandardPool_: readonly string[] = [SatelliteModels['rb-cyl-soviet']];

  /** Gray size buckets, one model each in the free build. */
  private static readonly rbGrayPools_ = {
    s: [SatelliteModels['rb-cyl-gray-s']],
    m: [SatelliteModels['rb-cyl-gray-m']],
    l: [SatelliteModels['rb-cyl-gray-l']],
  } as const;

  /**
   * Rocket bodies, most-specific signal first: catalog `shape` picks the
   * silhouette, `launchVehicle` picks the palette family for plain cylinders,
   * and real dimensions bucket everything else into the gray sizes.
   */
  private resolveRocketBodyModelName_(sat: Satellite): string {
    const shape = sat.shape.toLowerCase().replace(/\s+/gu, '');
    const silhouettePool = ModelResolver.rbSilhouettes_[shape];

    if (silhouettePool) {
      return ModelResolver.pickFromPool(sat, silhouettePool);
    }

    // A pack may know this silhouette even though the free build has no mesh for it.
    const packSilhouette = ModelResolver.packRoute_('rocketBodySilhouette', shape, sat);

    if (packSilhouette) {
      return packSilhouette;
    }

    const family = this.resolveRbFamilyModelName_(sat);

    if (family) {
      return family;
    }

    return this.resolveRbSizeBucket_(sat);
  }

  private resolveRbFamilyModelName_(sat: Satellite): string | null {
    const launchVehicle = sat.launchVehicle.toLowerCase();

    if (!launchVehicle) {
      return null;
    }

    // Ahead of the free families on purpose: a pack family is narrower than the one that would
    // otherwise swallow it, and the free build lumps these vehicles into the gray sizes anyway.
    const packFamily = ModelResolver.packRoute_('rocketBodyFamily', launchVehicle, sat);

    if (packFamily) {
      return packFamily;
    }

    for (const { match, pool } of ModelResolver.rbFamilies_) {
      if (match.test(launchVehicle)) {
        return pool ? ModelResolver.pickFromPool(sat, pool) : null;
      }
    }

    if (ModelResolver.rbSovietVehicles_.test(launchVehicle)) {
      const length = Number.parseFloat(sat.length);

      // Short Soviet stages (Tsiklon S5M class) get the squat variant
      if (length > 0 && length <= 4) {
        return SatelliteModels['rb-cyl-soviet-b'];
      }

      return ModelResolver.pickFromPool(sat, ModelResolver.rbSovietStandardPool_);
    }

    return null;
  }

  /**
   * Size-bucketed generic gray stages. Catalog diameter (meters) drives the
   * bucket, length is the fallback, medium the default; 99.7% of rocket-body
   * records carry both fields.
   */
  private resolveRbSizeBucket_(sat: Satellite): string {
    const pools = ModelResolver.rbGrayPools_;
    const diameter = Number.parseFloat(sat.diameter);

    if (diameter > 0) {
      if (diameter < 2.0) {
        return ModelResolver.pickFromPool(sat, pools.s);
      }

      return ModelResolver.pickFromPool(sat, diameter <= 3.2 ? pools.m : pools.l);
    }

    const length = Number.parseFloat(sat.length);

    if (length > 0) {
      if (length < 5) {
        return ModelResolver.pickFromPool(sat, pools.s);
      }

      return ModelResolver.pickFromPool(sat, length <= 9 ? pools.m : pools.l);
    }

    return ModelResolver.pickFromPool(sat, pools.m);
  }

  /**
   * Generic debris archetype pool (6 archetypes x 3-4 seeds). Objects with no
   * distinguishing catalog metadata are spread across these by a stable hash of
   * their sccNum.
   */
  private static readonly debrisGenericPool_ = [
    SatelliteModels['deb-panel-01'],
    SatelliteModels['deb-panel-02'],
    SatelliteModels['deb-panel-03'],
    SatelliteModels['deb-bracket-01'],
    SatelliteModels['deb-bracket-02'],
    SatelliteModels['deb-bracket-03'],
    SatelliteModels['deb-skin-01'],
    SatelliteModels['deb-skin-02'],
    SatelliteModels['deb-skin-03'],
    SatelliteModels['deb-clampband-01'],
    SatelliteModels['deb-clampband-02'],
    SatelliteModels['deb-clampband-03'],
    SatelliteModels['deb-mli-01'],
    SatelliteModels['deb-mli-02'],
    SatelliteModels['deb-mli-03'],
    SatelliteModels['deb-mli-04'],
    SatelliteModels['deb-strut-01'],
    SatelliteModels['deb-strut-02'],
    SatelliteModels['deb-strut-03'],
  ];

  /**
   * Shape-driven debris specials, matched on the catalog `shape` field (all
   * whitespace stripped, lowercased) BEFORE the generic hash. Covers the ~4% of
   * debris that carry a shape: cone (154 records), cyl (108), torus (83 - the
   * Proton SOZ ullage-motor rings). Each maps to a small sub-pool; the hash then
   * picks a variant within it. disk / disk+cable fall through to the generic pool.
   */
  private static readonly debrisShapeSpecials_: Record<string, string[]> = {
    cone: [SatelliteModels['deb-cone-01'], SatelliteModels['deb-cone-02']],
    cyl: [SatelliteModels['deb-cyl-01'], SatelliteModels['deb-cyl-02']],
    cylinder: [SatelliteModels['deb-cyl-01'], SatelliteModels['deb-cyl-02']],
    torus: [SatelliteModels['deb-torus-01'], SatelliteModels['deb-torus-02']],
    toroid: [SatelliteModels['deb-torus-01'], SatelliteModels['deb-torus-02']],
  };

  /**
   * Debris. The catalog gives almost no signal here (`shape` is empty on ~96%
   * of records and `rcs` is null): match the shape special when present, else
   * spread across the generic archetype pool. Either way a stable per-object
   * hash of the sccNum picks the variant, so a given piece always renders the
   * same mesh across sessions and screenshots.
   */
  private resolveDebrisModelName_(sat: Satellite): string {
    const shape = sat.shape.toLowerCase().replace(/\s+/gu, '');
    const special = ModelResolver.debrisShapeSpecials_[shape];

    if (special) {
      return ModelResolver.pickFromPool(sat, special);
    }

    // disk / disk+cable and friends: shapes the free build has no mesh for, so they would
    // otherwise be spread across the generic archetypes as if they carried no shape at all.
    const packShape = ModelResolver.packRoute_('debrisShape', shape, sat);

    if (packShape) {
      return packShape;
    }

    return ModelResolver.pickFromPool(sat, ModelResolver.debrisGenericPool_);
  }

  /**
   * Cubesat variant pools keyed by bus size. The base mesh anchors index 0 (so
   * a size with no variants stays deterministic); sizes with skin (`-b`) and
   * deployable-wing (`-w`) variants add pool entries the sccNum hash spreads
   * across. 0.25U stays SPACEBEE-routed above; 0.3U/0.5U alias to the half-U.
   */
  private static readonly cubesatPools_: Record<string, readonly string[]> = {
    '0.5u': [SatelliteModels['s0.5u']],
    '1u': [SatelliteModels.s1u, SatelliteModels['s1u-b']],
    '1.5u': [SatelliteModels['s1.5u']],
    '2u': [SatelliteModels.s2u],
    '3u': [SatelliteModels.s3u, SatelliteModels['s3u-b'], SatelliteModels['s3u-w']],
    '4u': [SatelliteModels.s4u],
    '6u': [SatelliteModels.s6u, SatelliteModels['s6u-b'], SatelliteModels['s6u-w']],
    '8u': [SatelliteModels.s8u],
    '12u': [SatelliteModels.s12u, SatelliteModels['s12u-w']],
    '16u': [SatelliteModels.s16u, SatelliteModels['s16u-b']],
  };

  /** Pick the size's base/skin/wing variant deterministically from the sccNum. */
  private resolveCubesatModelName_(sat: Satellite, sizeKey: string): string {
    return ModelResolver.pickFromPool(sat, ModelResolver.cubesatPools_[sizeKey]);
  }

  /**
   * Stable FNV-1a hash of an identity string into [0, count). Spreads objects
   * with no distinguishing metadata across a variant pool while guaranteeing
   * the same object always maps to the same variant. Handles alpha-5 and
   * extended sccNums (it hashes characters), unlike the parseInt bucketing it
   * replaced, which collapsed every non-5-digit id into one bucket.
   */
  private static variantIndex_(key: string, count: number): number {
    let h = 0x811c9dc5;

    for (const ch of key) {
      h = Math.imul(h ^ (ch.codePointAt(0) ?? 0), 0x01000193);
    }

    return (h >>> 0) % count;
  }

  // eslint-disable-next-line complexity
  private resolveSatModelName_(sat: Satellite): string {
    if (sat.name.startsWith('STARLINK')) {
      return this.resolveStarlinkModelName_(sat);
    }

    // Amazon Leo (Project Kuiper): bus metadata first, name-prefix fallback
    // so prototypes (KUIPER-P*) and records missing bus data still match.
    if (sat.bus === 'Kuiper' || sat.name.startsWith('KUIPER')) {
      return SatelliteModels['amazon-leo'];
    }

    const knownSatelliteModel = this.resolveByName_(sat.name);

    if (knownSatelliteModel) {
      return knownSatelliteModel;
    }

    if (sat.sccNum === SatelliteNumber.iss) {
      return SatelliteModels.iss;
    }

    if (sat.sccNum === SatelliteNumber.hubble) {
      return SatelliteModels.hubble;
    }

    if (sat.sccNum === SatelliteNumber.tiangong) {
      return SatelliteModels.tiangong;
    }

    if (sat.sccNum === SatelliteNumber.jwst) {
      return SatelliteModels.jwst;
    }

    if (this.sccNumAehf_.indexOf(sat.sccNum) !== -1) {
      return SatelliteModels.aehf;
    }

    if (this.sccNumDsp_.indexOf(sat.sccNum) !== -1) {
      return SatelliteModels.dsp;
    }

    switch (sat.payload) {
      case 'Platform-3':
      case 'Sateliot-1':
        return SatelliteModels.sateliotsat;
      case 'Sateliot-2':
      case 'Sateliot-3':
      case 'Sateliot-4':
        return SatelliteModels.sateliotsat2;
      default:
        // Do Nothing
        break;
    }

    switch (sat.bus) {
      case 'sateliotsat':
        return SatelliteModels.sateliotsat;
      case 'Cubesat 0.25U':
        if (sat.intlDes.startsWith('2018')) {
          return SatelliteModels.spacebee1gen;
        } else if (sat.name.startsWith('SPACEBEE')) {
          return SatelliteModels.spacebee3gen;
        }

        return SatelliteModels.spacebee1gen;
      case 'Cubesat':
      case 'Cubesat 1U':
        if (sat.name.startsWith('SPACEBEE')) {
          return SatelliteModels.spacebee2gen;
        }

        return this.resolveCubesatModelName_(sat, '1u');
      case 'Cubesat 0.5U':
      case 'Cubesat 0.3U':
        return this.resolveCubesatModelName_(sat, '0.5u');
      case 'Cubesat 1.5U':
        return this.resolveCubesatModelName_(sat, '1.5u');
      case 'Cubesat 2U':
        return this.resolveCubesatModelName_(sat, '2u');
      case 'Cubesat 3U':
      case 'Cubesat 3U+':
        return this.resolveCubesatModelName_(sat, '3u');
      case 'Cubesat 4U':
        return this.resolveCubesatModelName_(sat, '4u');
      case 'Cubesat 6U':
        return this.resolveCubesatModelName_(sat, '6u');
      case 'Cubesat 8U':
        return this.resolveCubesatModelName_(sat, '8u');
      case 'Cubesat 12U':
        return this.resolveCubesatModelName_(sat, '12u');
      case 'Cubesat 16U':
        return this.resolveCubesatModelName_(sat, '16u');
      case 'DSP':
      case 'DSP B14':
      case 'DSP B18':
      case 'DSP MOS/PIM':
      case 'DSP P2U':
      case 'DSP P2':
        return SatelliteModels.dsp;
      case 'GPS':
      case 'GPS II':
      case 'GPS IIA':
      case 'GPS IIF':
      case 'GPS IIR':
        return SatelliteModels.gps;
      case 'Iridium':
        return SatelliteModels.iridium;
      case 'ARROW':
        return SatelliteModels.oneweb;
      default:
      // Do Nothing
    }

    switch (!Number.isNaN(sat.rcs as number)) {
      case sat.rcs! < 0.1 && sat.rcs! > 0.04:
        return this.resolveCubesatModelName_(sat, '1u');
      case sat.rcs! < 0.22 && sat.rcs! >= 0.1:
        return this.resolveCubesatModelName_(sat, '2u');
      case sat.rcs! < 0.33 && sat.rcs! >= 0.22:
        return this.resolveCubesatModelName_(sat, '3u');
      default:
      // Generic Model
    }

    return this.resolveGenericModelName_(sat);
  }

  /**
   * Generic payload fallback. The catalog `shape` field is populated on ~100% of
   * payloads and describes the silhouette ("Box + pan", "Trapezoid+2 pan",
   * "Cyl + Ant", "Poly", ...), so parse it into (bus, panels, antenna) and route
   * into a shape-matched archetype, sized by the `span` field (a big GEO comsat
   * must not render at smallsat scale). The sccNum hash breaks ties where a
   * bucket has more than one variant. Unparseable/empty shapes keep the legacy
   * `sat2` mesh for continuity.
   *
   * The archetype pools it picks from are anchored on the archetype's base mesh. The free build
   * ships one model in most of them; a variant pack widens them (see
   * {@link MeshVariantPack.poolExtensions}).
   */
  private static readonly genPools_ = {
    trap: [SatelliteModels['gen-trap-geo']],
    cylPan: [SatelliteModels['gen-cyl-pan']],
    cylDish: [SatelliteModels['gen-cyl-dish']],
    cyl: [SatelliteModels['gen-cyl']],
    hexPan: [SatelliteModels['gen-hex-pan']],
    poly: [SatelliteModels['gen-poly']],
    sphere: [SatelliteModels['gen-sphere']],
    boxDish: [SatelliteModels['gen-box-dish']],
    boxSolar: [SatelliteModels['gen-box-solar']],
    boxS: [SatelliteModels['gen-box-s']],
    boxM: [SatelliteModels['gen-box-m']],
    boxL: [SatelliteModels['gen-box-l']],
    boxXl: [SatelliteModels['gen-box-xl'], SatelliteModels['gen-box-xl-b']],
  } as const;

  private resolveGenericModelName_(sat: Satellite): string {
    const s = sat.shape.toLowerCase().replaceAll(/\s+/gu, '').replaceAll('+', '');

    if (s === '') {
      return SatelliteModels.sat2;
    }

    const pools = ModelResolver.genPools_;
    const span = Number.parseFloat(sat.span);
    const spanM = Number.isFinite(span) ? span : 0;
    const hasAnt = s.includes('ant');
    let panels = 0;

    if (/[234]pan/u.test(s)) {
      panels = 2;
    } else if (s.includes('pan')) {
      panels = 1;
    }

    const ctx: GenericShapeContext = { shape: s, panels, hasAnt, spanM };

    if (s.includes('trap')) {
      return ModelResolver.pickFromPool(sat, pools.trap);
    }
    if (s.includes('cyl')) {
      if (panels >= 2) {
        return ModelResolver.pickFromPool(sat, pools.cylPan);
      }

      return ModelResolver.pickFromPool(sat, hasAnt ? pools.cylDish : pools.cyl);
    }
    if (s.includes('hex')) {
      return ModelResolver.pickFromPool(sat, panels >= 2 ? pools.hexPan : pools.poly);
    }
    if (s.includes('poly')) {
      return ModelResolver.pickFromPool(sat, pools.poly);
    }
    if (s.includes('spher')) {
      return ModelResolver.pickFromPool(sat, pools.sphere);
    }
    if (s.includes('box')) {
      if (panels === 0) {
        return ModelResolver.pickFromPool(sat, hasAnt ? pools.boxDish : pools.boxSolar);
      }

      // A pack may split the panelled buses further than span alone can (the single-panel
      // smallsat look); the free build sizes every one of them by span.
      const packBox = ModelResolver.packRoute_('genericBox', ctx, sat);

      if (packBox) {
        return packBox;
      }

      if (spanM < 2) {
        return ModelResolver.pickFromPool(sat, pools.boxS);
      }
      if (spanM < 10) {
        return ModelResolver.pickFromPool(sat, pools.boxM);
      }
      if (spanM < 18) {
        return ModelResolver.pickFromPool(sat, pools.boxL);
      }

      return ModelResolver.pickFromPool(sat, pools.boxXl);
    }

    // Silhouettes the free build has no archetype for (cone and friends) are a pack's last
    // chance before the legacy generic mesh.
    const packShape = ModelResolver.packRoute_('genericShape', ctx, sat);

    if (packShape) {
      return packShape;
    }

    // cone / other / unrecognized silhouettes keep the legacy generic mesh.
    return SatelliteModels.sat2;
  }

  /**
   * The catalog metadata marks v2 Mini variants with a "Starlink V2M" bus
   * prefix (V2M, V2MD direct-to-cell, V2MO optimized). When bus metadata is
   * missing, fall back on SpaceX naming: v1.x names are 4-digit (max 6380),
   * v2 Mini names are 5-digit (11072+).
   */
  private resolveStarlinkModelName_(sat: Satellite): string {
    if (sat.bus.startsWith('Starlink V2M')) {
      return SatelliteModels['starlink-v2mini'];
    }
    if (sat.bus === 'Starlink') {
      return SatelliteModels.starlink;
    }

    const nameNumber = Number.parseInt(sat.name.replace(/\D+/gu, ''), 10);

    return nameNumber >= 10000 ? SatelliteModels['starlink-v2mini'] : SatelliteModels.starlink;
  }

  /**
   * Name-matched spacecraft, checked IN ORDER - the first match wins, so put
   * anything narrower ahead of a pattern that would also swallow it.
   *
   * Matching is case-insensitive on purpose: the catalog is not consistent about
   * case ("STARLINK-1008" but "Vanguard 1"), so an uppercase-only test silently
   * misses the older records.
   *
   * Names are the last resort for a family that carries no distinguishing `bus`
   * or catalog-number signal. Where a spacecraft DOES have a usable bus value,
   * route it in the bus switch instead - it survives renames.
   *
   * Content packs append to this table via {@link ModelResolver.registerModelPack} - the Pro
   * hero-spacecraft pack is the big one. Anything not matched here (or by a registered pack)
   * falls through to the bus/RCS/shape generics, which is exactly what a free build does for
   * every pack-only spacecraft.
   */
  private static readonly namedSpacecraft_: NamedSpacecraftPattern[] = [
    // --- constellations and comsats ---
    { match: /^globalstar/iu, model: SatelliteModels.globalstar },
    { match: /^iridium/iu, model: SatelliteModels.iridium },
    { match: /^orbcomm/iu, model: SatelliteModels.orbcomm },
    // The \b matters: without it "ULYSSES 1" contains "SES 1" and steals the SES mesh.
    { match: /\bses\s\d+/iu, model: SatelliteModels.ses },
    { match: /^o3b/iu, model: SatelliteModels.o3b },
    { match: /^navstar/iu, model: SatelliteModels.gps },
    { match: /^galileo/iu, model: SatelliteModels.galileo },
    { match: /glonass/iu, model: SatelliteModels.glonass },
    { match: /^sbirs/iu, model: SatelliteModels.sbirs },
    { match: /^flock/iu, model: SatelliteModels.flock },
    { match: /^lemur/iu, model: SatelliteModels.lemur },
  ];

  private resolveByName_(name: string): string | null {
    // TODO: Currently all named models aim at nadir - that isn't always true
    for (const { match, model } of ModelResolver.namedSpacecraft_) {
      if (match.test(name)) {
        return model;
      }
    }

    return null;
  }

  /** Karman line (km). Below this apogee a shot never stages/deploys RVs. */
  private static readonly mislKarmanKm_ = 100;
  /** Ascending below this fraction of apogee is still boosting the full stack. */
  private static readonly mislBoostTop_ = 0.25;
  /**
   * Fraction of the ascent (launch -> apogee) spent in the deploy sequence. The
   * shroud-separation (misl3) and RV-separation (misl4) meshes only show during
   * this short window right before the RVs separate at apogee.
   */
  private static readonly mislDeployFrac_ = 0.05;

  /**
   * Reentry-vehicle counts for which a dedicated deploy mesh (misl3-N / misl4-N)
   * exists. The count-4 mesh is the original unsuffixed `misl3`/`misl4`, so it is
   * represented here as the empty suffix. A missile's warhead count is snapped to
   * the nearest of these so the revealed/separating RV cluster shows the right
   * number of reentry vehicles (see {@link mislVariantSuffix_}).
   */
  private static readonly mislRvVariants_ = [2, 4, 6, 8, 10] as const;

  /**
   * Model-name suffix for the RV-count variant nearest `warheadCount` (e.g. 6 ->
   * "-6", 4 -> "" for the original mesh). Ties round up, so a between-sizes count
   * reads as the more heavily MIRVed option. Non-MIRV missiles default to a
   * warhead count of 1 and snap to the 2-RV mesh.
   */
  private static mislVariantSuffix_(warheadCount: number): string {
    const count = Number.isFinite(warheadCount) ? warheadCount : 1;
    let best = ModelResolver.mislRvVariants_[0] as 2 | 4 | 6 | 8 | 10;

    for (const v of ModelResolver.mislRvVariants_) {
      if (Math.abs(v - count) <= Math.abs(best - count)) {
        best = v;
      }
    }

    return best === 4 ? '' : `-${best}`;
  }

  /**
   * Ballistic-missile mesh, chosen by where the object sits in its trajectory so
   * the model reads out the current flight phase. The mesh manager re-resolves
   * every frame, so scrubbing the sim clock either direction updates the mesh
   * live as the missile advances along (or back down) its arc.
   *
   * Every MIRV reentry vehicle shares the bus trajectory up to apogee and then
   * separates and flies its own descent (see MirvAttack / findSeparationIndex),
   * so apogee is the deploy/separation point. The sequence around it:
   *
   *   ascending, low                  -> misl   (full multi-stage boost stack)
   *   ascending, high                 -> misl2  (final stage, boosters dropped)
   *   short window before apogee (1)  -> misl3  (shroud separating, RVs revealed)
   *   short window before apogee (2)  -> misl4  (RVs separating from the spent bus)
   *   at/after apogee (separation)    -> rv     (a single reentry vehicle, all the way down)
   *
   * Short, purely atmospheric shots (apogee below the Karman line) keep the boost
   * model the whole way: they neither stage to an exo-atmospheric bus nor deploy
   * reentry vehicles, so the RV sequence would misrepresent them.
   */
  private resolveMislModelName_(misl: MissileObject): string {
    const { altList, maxAlt } = misl;

    if (!altList || altList.length === 0 || maxAlt < ModelResolver.mislKarmanKm_) {
      return SatelliteModels.misl;
    }

    const lastIdx = altList.length - 1;
    const t = Math.max(0, Math.min(misl.getTimeInTrajectory(), lastIdx));
    const sepIdx = misl.getApogeeIndex();

    // At/after separation the object is a lone reentry vehicle coasting down to
    // its aimpoint - use the single-RV mesh the rest of the way down.
    if (t >= sepIdx) {
      return SatelliteModels.rv;
    }

    // The deploy sequence plays out in a short window just before separation: the
    // shroud comes off to reveal the RVs (misl3), then the RVs pull away from the
    // spent bus (misl4). Keep it brief so it reads as a discrete event. The mesh
    // carries the right number of reentry vehicles for this missile's warhead load.
    const deploySamples = Math.max(2, Math.round(sepIdx * ModelResolver.mislDeployFrac_));

    if (t >= sepIdx - deploySamples) {
      const suffix = ModelResolver.mislVariantSuffix_(misl.warheadCount);

      return t >= sepIdx - Math.ceil(deploySamples / 2) ? `${SatelliteModels.misl4}${suffix}` : `${SatelliteModels.misl3}${suffix}`;
    }

    // Still climbing below the deploy window: full boost stack low, final stage high.
    return altList[t] / maxAlt < ModelResolver.mislBoostTop_ ? SatelliteModels.misl : SatelliteModels.misl2;
  }
}
