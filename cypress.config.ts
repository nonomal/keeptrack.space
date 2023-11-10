import { defineConfig } from 'cypress';

export default defineConfig({
  video: false,
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // eslint-disable-next-line global-require
      return require('./cypress/plugins/index.js').default(on, config);
    },
    viewportWidth: 1920,
    viewportHeight: 1080,
  },
});
