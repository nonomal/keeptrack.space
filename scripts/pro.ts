/* eslint-disable no-console */
/**
 * Dispatcher for KeepTrack Pro tooling.
 *
 * The commercial edition ships private generators and content tools (mesh and
 * texture bakers, ephemeris fitters, scenario builders, the explainer-video
 * pipeline). They live in the `src/plugins-pro` submodule, which is not part of
 * the open-source distribution. Rather than listing a dozen entries in the
 * public package.json that no OSS clone can run, they are registered inside the
 * submodule and reached through one command:
 *
 *   npm run pro                          # list what is available
 *   npm run pro -- <command> [args...]   # run one
 *
 * Without the submodule this prints an explanation and exits 0, because not
 * having the commercial tools is the normal, expected state for a contributor -
 * it is not a build failure.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const proRoot = path.join(repoRoot, 'src', 'plugins-pro');
const registryPath = path.join(proRoot, 'pro-commands.json');

interface ProCommand {
  /** Script path relative to src/plugins-pro, run with tsx from the repo root. */
  script?: string;
  /** Optional tsconfig for tsx, relative to src/plugins-pro. */
  tsconfig?: string;
  /** Alternative to `script`: argv run with cwd = src/plugins-pro. */
  exec?: string[];
  /** One line shown by the listing. */
  description: string;
  /** Hidden from the listing (plumbing invoked by CI or other scripts). */
  internal?: boolean;
}

interface Registry {
  commands: Record<string, ProCommand>;
}

const explainMissing = (): void => {
  console.log(`
  KeepTrack Pro tools are not installed.

  These are the content and data generators for the commercial edition
  (src/plugins-pro), which is not part of the open-source distribution.
  Nothing in the open-source build depends on them.

  Everything you need to build, run and test keeptrack.space is listed
  under "Development Commands" in README.md.
`);
};

if (!fs.existsSync(registryPath)) {
  explainMissing();
  process.exit(0);
}

const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as Registry;
const args = process.argv.slice(2);
const [name, ...rest] = args;

const listCommands = (): void => {
  const entries = Object.entries(registry.commands).filter(([, c]) => !c.internal);
  const width = entries.reduce((w, [n]) => Math.max(w, n.length), 0);

  console.log('\n  KeepTrack Pro tools (npm run pro -- <command> [args...]):\n');
  for (const [n, cmd] of entries) {
    console.log(`    ${n.padEnd(width)}  ${cmd.description}`);
  }
  console.log('');
};

if (!name) {
  listCommands();
  process.exit(0);
}

const cmd = registry.commands[name];

if (!cmd) {
  console.error(`\n  Unknown pro command: ${name}`);
  listCommands();
  process.exit(1);
}

// tsx resolves from the parent's node_modules, and several generators depend on
// cwd being the repo root for ESM resolution (ootk / astronomy-engine), so the
// default is to run from the root and pass an absolute script path.
const run = (): number => {
  if (cmd.exec) {
    const [bin, ...binArgs] = cmd.exec;

    return spawnSync(bin, [...binArgs, ...rest], { stdio: 'inherit', cwd: proRoot, shell: process.platform === 'win32' }).status ?? 1;
  }

  if (!cmd.script) {
    console.error(`  Pro command "${name}" has neither "script" nor "exec" in pro-commands.json`);

    return 1;
  }

  const tsxArgs = cmd.tsconfig ? ['--tsconfig', path.join(proRoot, cmd.tsconfig)] : [];
  const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

  return spawnSync(process.execPath, [tsxCli, ...tsxArgs, path.join(proRoot, cmd.script), ...rest], { stdio: 'inherit', cwd: repoRoot }).status ?? 1;
};

process.exit(run());
