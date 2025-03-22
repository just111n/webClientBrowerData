import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';

export default defineConfig([
  // For frontend JS files
  {
    files: ['app.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: globals.browser,
    },
    plugins: {
      js,
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'no-empty': 'warn',
      semi: ['error', 'always'],
      quotes: ['error', 'single'],
    },
  },

  // For Node.js configs like bs-config.js and cypress.config.js
  {
    files: ['bs-config.js', 'cypress.config.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
    },
  },

  // For Cypress test files
  {
    files: ['cypress/**/*.js'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.mocha,
        cy: true,
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'off', // handled via globals above
    },
  },

  // Ignore build/artifact folders
  {
    ignores: ['node_modules', 'dist', 'build', '.vercel'],
  },
]);
