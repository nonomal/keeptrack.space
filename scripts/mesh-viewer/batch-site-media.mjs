/* eslint-disable no-sync, no-console */
/**
 * Batch driver: render the `site` media package for every purpose-built mesh
 * in sat-map.json (produced by media-map.ts), sequentially, resumably.
 *
 *   npm run mesh:batch          # or: node scripts/mesh-viewer/batch-site-media.mjs
 *
 * A mesh is skipped when all four outputs already exist in media-drop/, so a
 * crashed or interrupted run continues where it left off. Progress appends to
 * media-drop/batch-log.txt; a JSON summary lands at media-drop/batch-done.json
 * when the sweep finishes (watch for that file to know it is over). Failures
 * are logged and skipped, never fatal - rerun to retry them.
 *
 * Runs plain node (no tsx): it only shells out to capture-rotation.ts.
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const dropDir = path.join(scriptDir, 'media-drop');
const logFile = path.join(dropDir, 'batch-log.txt');
const doneFile = path.join(dropDir, 'batch-done.json');
const PER_MESH_TIMEOUT_MS = 15 * 60 * 1000;

const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`;

  console.log(stamped);
  fs.appendFileSync(logFile, `${stamped}\n`);
};

const satMap = JSON.parse(fs.readFileSync(path.join(dropDir, 'sat-map.json'), 'utf8'));
const meshes = Object.keys(satMap.models);
const outputsFor = (mesh) => ['webm', 'mp4', 'gif'].map((ext) => path.join(dropDir, `${mesh}.${ext}`)).concat(path.join(dropDir, `${mesh}-hero.png`));

fs.rmSync(doneFile, { force: true });
log(`batch start: ${meshes.length} meshes from sat-map.json (satCount ${satMap.satCount})`);

const failed = [];
let rendered = 0;
let skipped = 0;

for (const [i, mesh] of meshes.entries()) {
  if (outputsFor(mesh).every((f) => fs.existsSync(f))) {
    skipped++;
    continue;
  }
  const t0 = Date.now();

  try {
    execSync(`npx tsx scripts/mesh-viewer/capture-rotation.ts ${mesh} --package site --out-dir scripts/mesh-viewer/media-drop`, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: PER_MESH_TIMEOUT_MS,
    });
    rendered++;
    log(`ok ${mesh} (${((Date.now() - t0) / 1000).toFixed(0)}s) [${i + 1}/${meshes.length}]`);
  } catch (err) {
    failed.push(mesh);
    log(`FAILED ${mesh}: ${String(err.message ?? err).slice(0, 300)} [${i + 1}/${meshes.length}]`);
  }
}

const summary = { finishedAt: new Date().toISOString(), total: meshes.length, rendered, skipped, failed };

fs.writeFileSync(doneFile, `${JSON.stringify(summary, null, 2)}\n`);
log(`batch done: ${rendered} rendered, ${skipped} already present, ${failed.length} failed${failed.length ? ` (${failed.join(', ')})` : ''}`);
