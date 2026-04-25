import { defineConfig } from 'oxfmt'

export default defineConfig({
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  singleQuote: true,
  jsxSingleQuote: false,
  quoteProps: 'as-needed',
  trailingComma: 'all',
  semi: false,
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  endOfLine: 'lf',
  ignorePatterns: [
    '**/.cache/**',
    '**/dist/**',
    '**/node_modules/**',
    'datasets/**/output/**',
    'report/public/datasets/**/output/**',
    '**/*.pmtiles',
  ],
  sortImports: {
    newlinesBetween: false,
  },
  sortTailwindcss: {
    stylesheet: './report/src/index.css',
    functions: ['clsx', 'cn', 'cva', 'tw'],
    attributes: [],
    preserveWhitespace: true,
    preserveDuplicates: false,
  },
  sortPackageJson: true,
})
