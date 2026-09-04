import { defineConfig } from 'oxlint'

// FMC default — shared tilda-geo / trassenscout base (no app-specific jsPlugins).
// ignorePatterns: keep in sync with oxfmt.config.mjs.
export default defineConfig({
  plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react'],
  options: { typeAware: true },
  ignorePatterns: [
    '.agents/**',
    '.cursor/**',
    '.output/**',
    'playwright-report/**',
    'test-results/**',
    '**/.cache/**',
    '**/dist/**',
    'datasets/**/output/**',
    'report/public/datasets/**/output/**',
    '**/*.pmtiles',
  ],
  categories: {
    correctness: 'error',
  },
  rules: {
    'typescript/switch-exhaustiveness-check': 'error',
    // Restriction category — keep ESLint recommended coverage (off by default in oxlint)
    'react/unsupported-syntax': 'error',
    // Allow bare `_` (oxlint default ignores `_foo` but not `_`); object config clears defaults
    'eslint/no-unused-vars': [
      'warn',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    'react/react-in-jsx-scope': 'off',
    'typescript/no-explicit-any': 'warn',
    'typescript/consistent-type-imports': 'off',
    'typescript/no-non-null-assertion': 'off',
    // Type-aware rules that are noisy in FMC apps — keep off unless you tighten deliberately.
    'typescript/no-floating-promises': 'off',
    'typescript/no-duplicate-type-constituents': 'off',
    'typescript/no-redundant-type-constituents': 'off',
    'typescript/restrict-template-expressions': 'off',
    'typescript/no-base-to-string': 'off',
    'typescript/await-thenable': 'off',
    'typescript/unbound-method': 'off',
    'typescript/no-meaningless-void-operator': 'off',
    'typescript/no-useless-default-assignment': 'off',
    'typescript/no-misused-spread': 'off',
    'typescript/require-array-sort-compare': 'off',
    'typescript/no-array-delete': 'off',
  },
  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.tsx'],
      rules: {
        'typescript/no-non-null-assertion': 'off',
        'react/rules-of-hooks': 'off',
      },
    },
    {
      files: ['report/src/**'],
      jsPlugins: [{ name: 'compat', specifier: 'eslint-plugin-compat' }],
      rules: {
        'compat/compat': 'error',
      },
    },
  ],
})
