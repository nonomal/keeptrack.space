/**
 * Fetch the latest TLE data from the KeepTrack API and save to public/tle/tle.json.
 *
 * Usage:
 *   npx tsx scripts/fetch-tle.ts
 */

import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TLE_URL = 'https://api.keeptrack.space/v4/sats';
const OUT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'tle', 'tle.json');

/**
 * Fetch TLE data from the KeepTrack API and save to a local file. The output is used by the Best Pass plugin to calculate satellite passes without needing to make API calls from the client.
 */
async function main() {
  console.log(`Fetching TLE data from ${TLE_URL}...`);

  const res = await fetch(TLE_URL);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const data = await res.text();

  writeFileSync(OUT_PATH, data, 'utf-8');
  console.log(`Saved to ${OUT_PATH} (${(Buffer.byteLength(data) / 1024 / 1024).toFixed(1)} MB)`);
}

await main().catch((err) => {
  console.error(err);
  throw new Error('Failed to fetch and save TLE data');
});
