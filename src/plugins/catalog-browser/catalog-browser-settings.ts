// Ensure imports are type only to avoid circular dependencies
import type { PluginConfiguration } from '../keeptrack-plugins-configuration';

export interface CatalogBrowserConfiguration extends PluginConfiguration {
  hideKeepTrackCatalogs: boolean;
}

export const catalogBrowserConfigurationDefaults: CatalogBrowserConfiguration = {
  enabled: true,
  hideKeepTrackCatalogs: false,
};
