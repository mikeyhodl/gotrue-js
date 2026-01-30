const { overrides } = require('@netlify/eslint-config-node');

module.exports = {
  extends: '@netlify/eslint-config-node',
  parserOptions: {
    sourceType: 'module',
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.mjs', '.cjs'],
      },
    },
    node: {
      version: '>=20.0.0',
      tryExtensions: ['.js', '.mjs', '.cjs', '.json'],
    },
  },
  rules: {
    // Disable rules that conflict with extensionless ES module imports
    'n/no-missing-import': 0,
    'import/no-unresolved': 0,
    'consistent-this': 0,
    'unicorn/no-this-assignment': 0,
    'func-style': 0,
    'no-throw-literal': 0,
    'no-param-reassign': 0,
    'no-magic-numbers': 0,
    'fp/no-mutation': 0,
    'fp/no-let': 0,
    'fp/no-class': 0,
    'fp/no-this': 0,
    'fp/no-loops': 0,
    'fp/no-delete': 0,
    'fp/no-mutating-assign': 0,
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { vars: 'all', args: 'none', ignoreRestSiblings: true }],
    'no-underscore-dangle': 0,
    complexity: 0,
    'max-depth': 0,
    'max-lines': 0,
    'promise/prefer-await-to-then': 0,
    'promise/no-return-wrap': 0,
    'promise/no-nesting': 0,
    'node/no-unsupported-features/es-syntax': 0,
    camelcase: 0,
    'unicorn/prefer-prototype-methods': 0,
  },
  overrides: [
    ...overrides,
    {
      files: ['*.d.ts'],
      rules: {
        'max-classes-per-file': 0,
        'unicorn/filename-case': 0,
        'unicorn/custom-error-definition': 0,
      },
    },
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended',
        'prettier',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
      ],
      rules: {
        'no-use-before-define': 0,
        '@typescript-eslint/no-this-alias': 0,
        'promise/prefer-await-to-callbacks': 0,
      },
    },
    {
      files: ['tests/**/*.js'],
      rules: {
        'node/no-unpublished-import': 0,
        'n/no-unpublished-import': 0,
      },
    },
    {
      // TODO: remove this
      files: ['README.md'],
      rules: {
        'node/no-missing-import': 0,
        'no-console': 0,
        'promise/always-return': 0,
        'require-await': 0,
        'node/exports-style': 0,
        'no-shadow': 0,
      },
    },
  ],
};
