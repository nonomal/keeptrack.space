import type { KeepTrackPluginsConfiguration } from '@app/plugins/keeptrack-plugins-configuration';
import { pluginManifest } from '@app/plugins/plugin-manifest';

/**
 * Default plugin configuration derived from the plugin manifest.
 * Each manifest entry's configKey and defaultConfig become entries here.
 * When multiple entries share a configKey, the first entry's defaultConfig wins.
 */
export const defaultPlugins: KeepTrackPluginsConfiguration = (() => {
  const config = {} as Record<string, unknown>;

  for (const descriptor of pluginManifest) {
    if (!(descriptor.configKey in config)) {
      config[descriptor.configKey] = descriptor.defaultConfig;
    }
  }

  return config as KeepTrackPluginsConfiguration;
})();
