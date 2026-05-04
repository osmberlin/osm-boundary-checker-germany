import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/**
 * GitHub Pages has no server-side fallback to index.html. Unknown paths return
 * 404 before the SPA loads. GH Pages serves custom 404.html for those URLs; a
 * copy of index.html lets TanStack Router read the real path and render.
 * @see https://github.com/orgs/community/discussions/36010
 */
function spaGithubPages404(): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  return {
    name: 'spa-github-pages-404',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
      root = config.root
    },
    closeBundle() {
      const dir = resolve(root, outDir)
      copyFileSync(resolve(dir, 'index.html'), resolve(dir, '404.html'))
    },
  }
}

export default defineConfig(({ command }) => ({
  // Production: custom domain root (https://grenzabgleich.osm-verkehrswende.org/). Dev: '/'.
  base: command === 'build' ? '/' : '/',
  plugins: [
    tailwindcss(),
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    spaGithubPages404(),
  ],
  server: {
    port: 5174,
    strictPort: true,
    host: '127.0.0.1',
  },
  preview: {
    port: 4173,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@compare-metrics': fileURLToPath(new URL('../scripts/compare/lib/metrics', import.meta.url)),
    },
  },
}))
