import { copyFileSync, existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import browserslistToEsbuild from 'browserslist-to-esbuild'
import { defineConfig, searchForWorkspaceRoot, type Plugin } from 'vite'

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

/**
 * Vite SPA fallback rewrites missing URLs to index.html (200). Optional runtime
 * JSON under /data and /datasets must 404 instead so loaders can treat them as absent.
 */
function staticRuntimeNoSpaFallback(): Plugin {
  return {
    name: 'static-runtime-no-spa-fallback',
    configureServer(server) {
      const publicRoot = resolve(server.config.publicDir)
      server.middlewares.use((req, res, next) => {
        const pathname = decodeURIComponent((req.url ?? '').split('?')[0] ?? '')
        if (!pathname.startsWith('/data/') && !pathname.startsWith('/datasets/')) {
          next()
          return
        }
        const filePath = resolve(publicRoot, pathname.slice(1))
        if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}/`)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }
        if (!existsSync(filePath) || !statSync(filePath).isFile()) {
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end('Not found')
          return
        }
        next()
      })
    },
  }
}

export default defineConfig(({ command }) => ({
  // Production: custom domain root (https://grenzabgleich.osm-verkehrswende.org/). Dev: '/'.
  base: command === 'build' ? '/' : '/',
  plugins: [
    tailwindcss(),
    viteReact({ compiler: true }),
    spaGithubPages404(),
    staticRuntimeNoSpaFallback(),
  ],
  // 127.0.0.1 and a fixed, project-specific port (5174 is taken by other Vite projects on this
  // machine), like the sibling OSM projects; an OSM OAuth redirect will need a stable origin.
  server: {
    port: 5185,
    strictPort: true,
    host: '127.0.0.1',
    // A compare run rewrites tens of thousands of files here; watching them hangs the dev server.
    // They are static data fetched at runtime, so a reload picks them up without HMR.
    watch: { ignored: ['**/public/datasets/**', '**/public/data/**'] },
    fs: {
      // Bun globalStore realpaths packages into ~/.bun/install/cache/links (Fontsource woff2).
      // Extend defaults — do not replace the workspace root.
      // @see https://github.com/vitejs/vite/issues/22662
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        resolve(homedir(), '.bun/install/cache/links'),
      ],
    },
  },
  preview: {
    port: 5186,
    strictPort: true,
    host: '127.0.0.1',
  },
  build: {
    target: browserslistToEsbuild(),
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@compare-metrics': fileURLToPath(new URL('../scripts/compare/lib/metrics', import.meta.url)),
    },
  },
}))
