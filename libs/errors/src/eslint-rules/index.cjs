/**
 * ═══════════════════════════════════════════════════════════════════════════
 * @nextgen/eslint-plugin-errors - ESLint Plugin for Error Handling
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Custom ESLint rules for enforcing error handling invariants.
 *
 * Installation:
 *   1. Add to .eslintrc.js:
 *      plugins: ['@nextgen/errors'],
 *      rules: {
 *        '@nextgen/errors/no-raw-error-throws': 'error',
 *      }
 *
 *   2. Or use the recommended config:
 *      extends: ['plugin:@nextgen/errors/recommended']
 */

const noRawErrorThrows = require('./no-raw-error-throws.cjs');

module.exports = {
  rules: {
    'no-raw-error-throws': noRawErrorThrows,
  },
  configs: {
    recommended: {
      plugins: ['@nextgen/errors'],
      rules: {
        '@nextgen/errors/no-raw-error-throws': 'error',
        'no-throw-literal': 'error',
      },
    },
    strict: {
      plugins: ['@nextgen/errors'],
      rules: {
        '@nextgen/errors/no-raw-error-throws': [
          'error',
          {
            allowKillSwitch: false,
          },
        ],
        'no-throw-literal': 'error',
      },
    },
  },
};
