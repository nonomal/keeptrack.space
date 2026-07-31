/* eslint-disable no-sync, no-console */
/**
 * Dump the mesh-relevant catalog fields for every object whose name (or altName)
 * matches a pattern. Mesh authoring is driven by these numbers: the sat-info-box
 * shows the catalog's own `length` / `diameter` / `span` / `shape`, never anything
 * derived from the mesh, so a model that disagrees with them reads as wrong.
 *
 *   npx tsx scripts/mesh-viewer/catalog-lookup.ts "landsat|sentinel-1"
 *   npx tsx scripts/mesh-viewer/catalog-lookup.ts "^goes" --full
 *
 * `--full` adds bus/configuration/equipment/adcs, which is where the antenna and
 * stabilization story usually lives. Matching is case-insensitive.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const [pattern, ...flags] = process.argv.slice(2);

if (!pattern) {
  throw new Error('usage: catalog-lookup.ts <name-regex> [--full] [--limit=N]');
}

const full = flags.includes('--full');
const limitFlag = flags.find((f) => f.startsWith('--limit='));
const limit = limitFlag ? Number.parseInt(limitFlag.split('=')[1], 10) : 25;
const re = new RegExp(pattern, 'iu');

interface CatalogRecord {
  tle1?: string;
  name?: string;
  altName?: string;
  type?: number;
  bus?: string;
  configuration?: string;
  purpose?: string;
  equipment?: string;
  adcs?: string;
  payload?: string;
  owner?: string;
  country?: string;
  manufacturer?: string;
  launchDate?: string;
  dryMass?: string;
  launchMass?: string;
  length?: string;
  diameter?: string;
  span?: string;
  shape?: string;
  rcs?: number | string;
  status?: string;
}

const file = path.join(process.cwd(), 'public', 'tle', 'tle.json');
const records = JSON.parse(fs.readFileSync(file, 'utf8')) as CatalogRecord[];
const hits = records.filter((r) => re.test(r.name ?? '') || re.test(r.altName ?? ''));

console.log(`${hits.length} match(es) for /${pattern}/i${hits.length > limit ? ` (showing ${limit})` : ''}\n`);

for (const r of hits.slice(0, limit)) {
  // The catalog array carries no sccNum field; it lives in columns 3-7 of TLE line 1.
  const sccNum = r.tle1?.slice(2, 7).trim() ?? '?';
  const base = [
    `name       ${r.name}`,
    `sccNum     ${sccNum}`,
    `type       ${r.type}   status ${r.status ?? '-'}   country ${r.country ?? '-'}`,
    `shape      ${r.shape ?? '-'}`,
    `length     ${r.length ?? '-'} m    diameter ${r.diameter ?? '-'} m    span ${r.span ?? '-'} m`,
    `mass       dry ${r.dryMass ?? '-'} kg   launch ${r.launchMass ?? '-'} kg   rcs ${r.rcs ?? '-'}`,
  ];

  if (full) {
    base.push(
      `bus        ${r.bus ?? '-'}   config ${r.configuration ?? '-'}`,
      `adcs       ${r.adcs ?? '-'}`,
      `equipment  ${(r.equipment ?? '-').slice(0, 200)}`,
      `owner      ${r.owner ?? '-'}   mfr ${r.manufacturer ?? '-'}   launched ${(r.launchDate ?? '-').slice(0, 10)}`,
    );
  }

  console.log(`${base.join('\n')}\n`);
}
