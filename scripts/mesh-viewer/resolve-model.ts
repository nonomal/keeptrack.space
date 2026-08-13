/* eslint-disable no-sync, no-console */
/**
 * Resolve which mesh the app would draw for a cataloged object, headlessly, and
 * say whether that mesh is purpose-built or a shape-routed generic. The KTOC
 * notice cron uses this to decide whether an article gets mesh media: a generic
 * bus presented as a named satellite would read as wrong, so only `specific`
 * results are rendered.
 *
 *   npx tsx --tsconfig scripts/mesh-viewer/tsconfig.json scripts/mesh-viewer/resolve-model.ts 28158
 *
 * Prints one JSON line: { sccNum, name, model, specific, meshFile }.
 * meshFile is null when the resolved model has no OBJ on disk (a pack model in
 * an OSS checkout, for example); treat that the same as specific=false.
 *
 * The catalog record comes from public/tle/tle.json, the same data the app
 * boots from, so name/bus/payload routing matches what a user would see.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ModelResolver } from '@app/app/rendering/mesh/model-resolver';
import { Satellite, SpaceObjectType } from '@ootk/src/main';

const sccArg = process.argv[2];

if (!sccArg || !/^\d+$/u.test(sccArg)) {
  throw new Error('usage: resolve-model.ts <sccNum>');
}

/*
 * A pro checkout ships 68 more named spacecraft (Milstar, DSCS, Landsat, ...)
 * as the hero-mesh pack, registered at app boot by registerMeshPacks(). Mirror
 * that here or every pack spacecraft wrongly reports its shape-routed generic.
 * An OSS checkout has no submodule and lands in the catch.
 */
try {
  const pack = await import('@plugins-pro/hero-meshes/hero-meshes');

  pack.registerHeroMeshes();
} catch {
  // OSS checkout: the free SatelliteModels roster is all there is.
}

interface CatalogRecord {
  tle1?: string;
  name?: string;
  altName?: string;
  type?: number;
  bus?: string;
  payload?: string;
  intlDes?: string;
  shape?: string;
  rcs?: number | string;
}

const file = path.join(process.cwd(), 'public', 'tle', 'tle.json');
const records = JSON.parse(fs.readFileSync(file, 'utf8')) as CatalogRecord[];
const padded = sccArg.padStart(5, '0');
const record = records.find((r) => (r.tle1?.slice(2, 7).trim() ?? '') === String(Number(sccArg)) || r.tle1?.slice(2, 7) === padded);

if (!record) {
  console.log(JSON.stringify({ sccNum: sccArg, name: null, model: null, specific: false, meshFile: null }));
  process.exit(0);
}

/*
 * Same prototype-built Satellite the resolver tests use: routing only reads
 * name/sccNum/payload/bus/intlDes/rcs, so the SGP4 cost of a real constructor
 * buys nothing here.
 */
const sat = Object.assign(Object.create(Satellite.prototype) as Satellite, {
  id: 0,
  name: record.name ?? `NORAD ${sccArg}`,
  sccNum: padded,
  type: SpaceObjectType.PAYLOAD,
  payload: record.payload,
  bus: record.bus ?? 'Unknown',
  intlDes: record.intlDes ?? '',
  rcs: typeof record.rcs === 'string' ? Number.parseFloat(record.rcs) : record.rcs,
  shape: record.shape ?? '',
  span: '',
  tle1: record.tle1 ?? '',
  tle2: '',
});

const model = new ModelResolver().resolve(sat);

/*
 * Shape-routed fallbacks: generic buses, cubesat pools, rocket bodies, debris,
 * and the legacy catch-all. Everything else (dsp, aehf, iridium, hero meshes,
 * constellation models) is purpose-built for the object or its family.
 */
const GENERIC = /^(?:gen-|s\d|s0\.5u|rb-|deb-|debris|sat2$|misl|rv$)/u;
const specific = model !== null && !GENERIC.test(model);

// Free meshes live in public/meshes; hero-pack OBJs ship in the pro submodule
// (the pro webpack config copies them into the same meshes/ dir at build time).
const meshFile = [
  path.join(process.cwd(), 'public', 'meshes', `${model}.obj`),
  path.join(process.cwd(), 'src', 'plugins-pro', 'public', 'meshes', `${model}.obj`),
].find((p) => fs.existsSync(p)) ?? null;

console.log(JSON.stringify({ sccNum: sccArg, name: sat.name, model, specific: specific && meshFile !== null, meshFile }));
