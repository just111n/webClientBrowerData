const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:5500',
    setupNodeEvents(on, config) {
      // implement node event listeners if needed
    },
  },
});
