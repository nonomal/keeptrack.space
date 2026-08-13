/* eslint-disable no-sync, no-console */
/**
 * Fail-fast guards for scripts that ship in the open-source repo but can only
 * be run by a KeepTrack maintainer, because they push to infrastructure the
 * project owns.
 *
 * These stay listed in package.json on purpose: contributors should be able to
 * see what the release/publishing pipeline does, and anyone with their own
 * Cloudflare account can point them at their own buckets. What they should NOT
 * get is a raw `wrangler` stack trace that reads like a broken repo. Each guard
 * prints one paragraph saying what is missing and why the open-source build
 * does not need it, then exits 0 - not running a maintainer task is a normal
 * state, not a failure.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export interface MaintainerRequirement {
  /** The npm script the user invoked, e.g. "mesh:upload". */
  script: string;
  /** What is missing, as a noun phrase: "an authenticated wrangler session". */
  needs: string;
  /** How a maintainer satisfies it. */
  howTo: string;
  /** Why an open-source contributor can ignore this. */
  why: string;
}

const explain = (req: MaintainerRequirement): never => {
  console.log(`
  ${req.script} needs ${req.needs}.

  ${req.howTo}

  ${req.why}
`);
  process.exit(0);
};

/**
 * Wrangler stores its OAuth session on disk; the exact location has moved
 * between majors, so every known spot is checked. An API token in the
 * environment (how CI authenticates) counts too.
 */
export const requireWranglerSession = (req: MaintainerRequirement): void => {
  if (process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN) {
    return;
  }

  const home = os.homedir();
  const candidates = [
    path.join(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'), 'xdg.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, '.config', '.wrangler', 'config', 'default.toml'),
    path.join(home, '.wrangler', 'config', 'default.toml'),
  ];

  if (candidates.some((p) => fs.existsSync(p))) {
    return;
  }

  explain(req);
};

/** Guards a script whose inputs live in a private sibling repo or asset drop. */
export const requireLocalPath = (target: string, req: MaintainerRequirement): void => {
  if (fs.existsSync(target)) {
    return;
  }

  explain(req);
};
