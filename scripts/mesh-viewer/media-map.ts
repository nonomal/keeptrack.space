/* eslint-disable no-sync, no-console */
/**
 * Sweep the whole catalog through the app's ModelResolver and emit the
 * sccNum <-> mesh mapping that satellite-page media needs. Media in R2 is
 * keyed by MESH name (one render serves every satellite that uses the mesh -
 * all six Milstar birds share milstar.webm), while keeptrack-home thinks in
 * NORAD ids, so the site needs this map to go from a sccNum to its media.
 *
 *   npx tsx --tsconfig scripts/mesh-viewer/tsconfig.json scripts/mesh-viewer/media-map.ts
 *   ... --out scripts/mesh-viewer/media-drop/sat-map.json   (default)
 *   ... --model milstar                                      (print one model's sats)
 *
 * Output JSON: { generatedAt, satCount, models: { <mesh>: [sccNum...] },
 * bySccNum: { <sccNum>: <mesh> } }. Upload it with the media so home fetches
 * one file: https://r2.keeptrack.space/mesh-media/sat-map.json
 *
 * Routing rules mirror scripts/mesh-viewer/resolve-model.ts (the per-object
 * CLI the KTOC notice cron uses): hero pack registered when present, and
 * shape-routed generics excluded - a generic bus rendered as a named
 * satellite would read as wrong on its page. Keep the GENERIC regex in step
 * with resolve-model.ts.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ModelResolver } from '@app/app/rendering/mesh/model-resolver';
import { Satellite, SpaceObjectType } from '@ootk/src/main';

const args = process.argv.slice(2);

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(name);

  return idx >= 0 ? args[idx + 1] : undefined;
}

const outFile = flagValue('--out') ?? path.join('scripts', 'mesh-viewer', 'media-drop', 'sat-map.json');
const printModel = flagValue('--model');

try {
  const pack = await import('@plugins-pro/hero-meshes/hero-meshes');

  pack.registerHeroMeshes();
} catch {
  // OSS checkout: the free SatelliteModels roster is all there is.
}

interface CatalogRecord {
  tle1?: string;
  name?: string;
  type?: number;
  bus?: string;
  payload?: string;
  intlDes?: string;
  shape?: string;
  rcs?: number | string;
}

const GENERIC = /^(?:gen-|s\d|s0\.5u|rb-|deb-|debris|sat2$|misl|rv$)/u;

const meshExists = (model: string): boolean =>
  fs.existsSync(path.join(process.cwd(), 'public', 'meshes', `${model}.obj`)) ||
  fs.existsSync(path.join(process.cwd(), 'src', 'plugins-pro', 'public', 'meshes', `${model}.obj`));

const records = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public', 'tle', 'tle.json'), 'utf8')) as CatalogRecord[];
const resolver = new ModelResolver();
const models = new Map<string, string[]>();
const bySccNum: Record<string, string> = {};
const meshExistsCache = new Map<string, boolean>();

for (const record of records) {
  const sccNum = record.tle1?.slice(2, 7).trim();

  if (!sccNum || !/^\d+$/u.test(sccNum)) {
    continue;
  }

  const sat = Object.assign(Object.create(Satellite.prototype) as Satellite, {
    id: 0,
    name: record.name ?? `NORAD ${sccNum}`,
    sccNum: sccNum.padStart(5, '0'),
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

  const model = resolver.resolve(sat);

  if (!model || GENERIC.test(model)) {
    continue;
  }
  if (!meshExistsCache.has(model)) {
    meshExistsCache.set(model, meshExists(model));
  }
  if (!meshExistsCache.get(model)) {
    continue;
  }

  const scc = String(Number(sccNum));

  bySccNum[scc] = model;
  const list = models.get(model) ?? [];

  list.push(scc);
  models.set(model, list);
}

const sorted = [...models.entries()].sort((a, b) => b[1].length - a[1].length);

if (printModel) {
  console.log(JSON.stringify({ model: printModel, sccNums: models.get(printModel) ?? [] }, null, 2));
  process.exit(0);
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(
  outFile,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      satCount: Object.keys(bySccNum).length,
      models: Object.fromEntries(sorted),
      bySccNum,
    },
    null,
    2,
  )}\n`,
);

console.log(`${Object.keys(bySccNum).length} satellites resolve to ${models.size} purpose-built meshes -> ${outFile}`);
console.log('Top meshes by satellite count:');
for (const [model, sccNums] of sorted.slice(0, 15)) {
  console.log(`  ${model}: ${sccNums.length}`);
}
