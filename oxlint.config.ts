import { defineConfig } from 'oxlint'

export default defineConfig({
  plugins: ['react', 'typescript', 'unicorn', 'oxc'],
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
