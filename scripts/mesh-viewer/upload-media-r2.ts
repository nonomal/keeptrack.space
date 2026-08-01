/* eslint-disable no-sync, no-console */
/**
 * Push mesh media (rotating GIFs, hero PNGs, optional WebM) from a local
 * gitignored drop directory to the `keeptrack` R2 bucket under `mesh-media/`,
 * and maintain `mesh-media/manifest.json` so consumers (keeptrack-home
 * satellite pages) can know which objects have media without probing per key.
 *
 *   npm run mesh:upload                # uploads everything in media-drop/
 *   npm run mesh:upload -- --dry-run   # list what would upload
 *
 * Flags:
 *   --dir <path>          source directory (default scripts/mesh-viewer/media-drop)
 *   --prefix <key/>       R2 key prefix (default mesh-media/)
 *   --wrangler-dir <path> repo whose wrangler install + OAuth session to use
 *                         (default ../workers/serve-keeptrack-api relative to this repo)
 *   --dry-run
 *   --force               upload even when the remote manifest already has the
 *                         same key at the same byte size (default: skip those)
 *
 * Uses `wrangler r2 object put`, which needs an interactive `wrangler login`
 * session in the wrangler dir (wrangler 3.x targets the remote bucket by
 * default; there is no --remote flag in that major). The manifest is
 * fetched, merged with this run's uploads, and re-put, so repeated runs are
 * cumulative and re-uploading a file just refreshes its entry.
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));

const BUCKET = 'keeptrack';
const CONTENT_TYPES: Record<string, string> = {
  '.gif': 'image/gif',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  // sat-map.json (sccNum <-> mesh mapping from media-map.ts) rides along with
  // the media; the cumulative manifest.json is managed separately below.
  '.json': 'application/json',
};

const args = process.argv.slice(2);

function flagValue(name: string): string | undefined {
  const idx = args.indexOf(name);

  return idx >= 0 ? args[idx + 1] : undefined;
}

const repoRoot = path.resolve(scriptDir, '..', '..');
const sourceDir = path.resolve(flagValue('--dir') ?? path.join(scriptDir, 'media-drop'));
const prefix = flagValue('--prefix') ?? 'mesh-media/';
const wranglerDir = path.resolve(flagValue('--wrangler-dir') ?? path.join(repoRoot, '..', 'workers', 'serve-keeptrack-api'));
const isDryRun = args.includes('--dry-run');
const isForce = args.includes('--force');

interface ManifestEntry {
  key: string;
  bytes: number;
  contentType: string;
  uploadedAt: string;
}

function wrangler(command: string): string {
  return execSync(`npx wrangler ${command}`, { cwd: wranglerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

function loadRemoteManifest(): ManifestEntry[] {
  try {
    const raw = wrangler(`r2 object get ${BUCKET}/${prefix}manifest.json --pipe`);
    // The banner can precede the payload depending on wrangler's mood; parse
    // from the first JSON bracket.
    const start = raw.search(/[[{]/u);

    if (start < 0) {
      return [];
    }
    const parsed = JSON.parse(raw.slice(start)) as { entries?: ManifestEntry[] };

    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    // No manifest yet (first run) or fetch failed; start fresh.
    return [];
  }
}

const main = (): void => {
  if (!fs.existsSync(sourceDir)) {
    fs.mkdirSync(sourceDir, { recursive: true });
    console.log(`Created empty drop directory ${sourceDir} - put .gif/.png/.webm files there and rerun.`);

    return;
  }

  const files = fs
    .readdirSync(sourceDir)
    .filter((f) => CONTENT_TYPES[path.extname(f).toLowerCase()])
    // Batch-driver artifacts (batch-done.json, batch-log.txt) live in the drop
    // dir but are not media; keep them out of the bucket.
    .filter((f) => !f.startsWith('batch-'))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log(`Nothing to upload: no media files in ${sourceDir}`);

    return;
  }

  console.log(`${isDryRun ? '[dry-run] ' : ''}${files.length} file(s) from ${sourceDir} -> r2://${BUCKET}/${prefix}`);

  const remote = loadRemoteManifest();
  const uploaded: ManifestEntry[] = [];
  let skipped = 0;

  for (const file of files) {
    const filePath = path.join(sourceDir, file);
    const contentType = CONTENT_TYPES[path.extname(file).toLowerCase()];
    const bytes = fs.statSync(filePath).size;
    const key = `${prefix}${file}`;

    if (!isForce && remote.some((entry) => entry.key === key && entry.bytes === bytes)) {
      skipped += 1;
      continue;
    }

    console.log(`  ${file} (${(bytes / 1024).toFixed(0)} KiB, ${contentType}) -> ${key}`);
    if (!isDryRun) {
      wrangler(`r2 object put ${BUCKET}/${key} --file "${filePath}" --content-type ${contentType}`);
      uploaded.push({ key, bytes, contentType, uploadedAt: new Date().toISOString() });
    }
  }

  if (skipped > 0) {
    console.log(`Skipped ${skipped} file(s) already in the manifest at the same size (use --force to re-upload).`);
  }

  if (isDryRun) {
    return;
  }

  if (uploaded.length === 0) {
    console.log('Nothing uploaded; manifest left untouched.');

    return;
  }

  // Merge this run into the remote manifest (replace same-key entries).
  const previous = remote.filter((entry) => !uploaded.some((u) => u.key === entry.key));
  const entries = [...previous, ...uploaded].sort((a, b) => a.key.localeCompare(b.key));
  const manifest = { generatedAt: new Date().toISOString(), entries };
  const manifestPath = path.join(os.tmpdir(), 'mesh-media-manifest.json');

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  wrangler(`r2 object put ${BUCKET}/${prefix}manifest.json --file "${manifestPath}" --content-type application/json`);
  console.log(`Manifest updated: ${entries.length} entries at ${prefix}manifest.json`);
};

main();
