import { readFileSync, readdirSync, existsSync } from 'fs';
import * as path from 'path';

const CONFIGS_DIR = path.resolve(__dirname, '../configs');
const MANIFEST_PATH = path.resolve(__dirname, '../src/plugins/plugin-manifest.ts');

/** Extract all configKey values from plugin-manifest.ts */
function getValidConfigKeys(): Set<string> {
  const content = readFileSync(MANIFEST_PATH, 'utf8');
  const keys = new Set<string>();
  const regex = /configKey:\s*'(\w+)'/gu;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    keys.add(match[1]);
  }

  return keys;
}

/** Extract plugin keys referenced in a settingsOverride.js file */
function extractPluginKeys(filePath: string): string[] {
  const content = readFileSync(filePath, 'utf8');

  // Find the plugins: { ... } block and extract top-level keys
  const pluginsMatch = /plugins:\s*\{([\s\S]*?)\n\s*\}/u.exec(content);

  if (!pluginsMatch) {
    return [];
  }

  const pluginsBlock = pluginsMatch[1];
  const keys: Set<string> = new Set();
  const keyRegex = /^\s*(\w+)\s*:\s*\{/gmu;
  let keyMatch: RegExpExecArray | null;

  while ((keyMatch = keyRegex.exec(pluginsBlock)) !== null) {
    keys.add(keyMatch[1]);
  }

  return [...keys];
}

/** Parse a profile.env file into key-value pairs */
function parseEnvFile(filePath: string): Map<string, string> {
  const content = readFileSync(filePath, 'utf8');
  const vars = new Map<string, string>();

  for (const line of content.split('\n')) {
    const trimmed = line.trim();

    if (trimmed.length === 0 || trimmed.startsWith('#')) {
      continue;
    }

    const eqIdx = trimmed.indexOf('=');

    if (eqIdx > 0) {
      const key = trimmed.substring(0, eqIdx).trim();
      const value = trimmed.substring(eqIdx + 1).trim();

      vars.set(key, value);
    }
  }

  return vars;
}

describe('Profile configuration validation', () => {
  const profiles = readdirSync(CONFIGS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const validConfigKeys = getValidConfigKeys();

  it('should find valid config keys from manifest', () => {
    expect(validConfigKeys.size).toBeGreaterThan(50);
  });

  it('should find all expected profiles', () => {
    expect(profiles).toContain('oss');
    expect(profiles).toContain('pro');
    expect(profiles).toContain('celestrak');
    expect(profiles).toContain('embed');
    expect(profiles).toContain('epfl');
    expect(profiles).toContain('offline');
  });

  for (const profile of profiles) {
    const profileDir = path.join(CONFIGS_DIR, profile);

    describe(`profile: ${profile}`, () => {
      it('has a valid profile.env', () => {
        const envPath = path.join(profileDir, 'profile.env');

        expect(existsSync(envPath)).toBe(true);

        const vars = parseEnvFile(envPath);

        // IS_PRO should be set in every profile
        expect(vars.has('IS_PRO')).toBe(true);
      });

      const overridePath = path.join(profileDir, 'settingsOverride.js');

      if (existsSync(overridePath)) {
        it('has valid plugin keys in settingsOverride.js', () => {
          const pluginKeys = extractPluginKeys(overridePath);

          // Skip if no plugins section (oss/pro don't have settingsOverride.js)
          if (pluginKeys.length === 0) {
            return;
          }

          const invalidKeys: string[] = [];

          for (const key of pluginKeys) {
            if (!validConfigKeys.has(key)) {
              invalidKeys.push(key);
            }
          }

          if (invalidKeys.length > 0) {
            // eslint-disable-next-line no-console
            console.error(`[${profile}] Invalid plugin keys: ${invalidKeys.join(', ')}`);
          }

          expect(invalidKeys).toHaveLength(0);
        });
      }
    });
  }
});
