/** @type {import('knip').KnipConfig} */
// Tune entry/ignoreBinaries per .agents/skills/tech-stack/references/knip.md
const strict = process.env.KNIP_STRICT === '1'

export default {
  ignore: ['.agents/**', '.cursor/**'],
  ignoreBinaries: ['ogr2ogr', 'osmium', 'rustc', 'tippecanoe'],
  ignoreDependencies: ['bun-plugin-react-compiler', 'bun-plugin-tailwind'],
  ignoreFiles: [
    'report/src/App.css',
    'report/src/components/KpiHintInline.tsx',
    'report/src/lib/countMatchCategories.ts',
  ],
  workspaces: {
    '.': {
      entry: ['cli/**/*.ts'],
    },
    report: {
      entry: ['src/**/*.test.ts', 'dev-server.ts', 'preview-server.ts', '*.ts'],
    },
    scripts: {
      entry: ['**/*.ts'],
    },
  },
  rules: {
    files: 'error',
    dependencies: 'error',
    devDependencies: 'error',
    unlisted: 'error',
    binaries: 'error',
    exports: strict ? 'error' : 'warn',
    types: strict ? 'error' : 'warn',
    enumMembers: strict ? 'error' : 'warn',
    duplicates: 'warn',
  },
}
