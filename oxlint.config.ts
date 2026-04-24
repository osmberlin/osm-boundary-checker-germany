import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['react', 'typescript', 'unicorn', 'oxc'],
  ignorePatterns: [
    '**/.cache/**',
    '**/dist/**',
    '**/node_modules/**',
    'datasets/**/output/**',
    '**/*.pmtiles',
  ],
  categories: {
    correctness: 'error',
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'typescript/no-explicit-any': 'warn',
    'typescript/consistent-type-imports': 'off',
    'typescript/no-non-null-assertion': 'off',
  },
})
