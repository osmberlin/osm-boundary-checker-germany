/** Serves `dist/` + `/datasets/*` + `/data/*` + generated areas index JSON from DATA_ROOT. */
import { join, resolve } from 'node:path'
import { AREAS_GEN_URL_PATH } from './generatedAssets.ts'
import { listComparisonAreaSummaries } from './listComparisonAreas.ts'
import { resolveRuntimeRoot } from './runtimeDataRoot.ts'
import { repoDataFileResponse } from './serveRepoDataResponse.ts'

const distDir = join(import.meta.dir, 'dist')
const dataRoot = resolveRuntimeRoot()
const datasetsRoot = resolve(join(dataRoot, 'datasets'))
const processingRoot = resolve(join(dataRoot, 'data'))

const preview = Bun.serve({
  port: Number(process.env.PORT) || 4173,
  async fetch(req) {
    const url = new URL(req.url)
    if (url.pathname === AREAS_GEN_URL_PATH) {
      const summaries = listComparisonAreaSummaries(dataRoot)
      const areas = summaries.map((s) => s.area)
      return new Response(`${JSON.stringify({ areas, summaries }, null, 2)}\n`, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      })
    }
    if (url.pathname.startsWith('/datasets/')) {
      const rel = decodeURIComponent(url.pathname.slice('/datasets/'.length))
      const filePath = resolve(join(datasetsRoot, rel))
      if (!filePath.startsWith(datasetsRoot)) {
        return new Response('Forbidden', { status: 403 })
      }
      return repoDataFileResponse(req, filePath)
    }
    if (url.pathname.startsWith('/data/')) {
      const rel = decodeURIComponent(url.pathname.slice('/data/'.length))
      const filePath = resolve(join(processingRoot, rel))
      if (!filePath.startsWith(processingRoot)) {
        return new Response('Forbidden', { status: 403 })
      }
      return repoDataFileResponse(req, filePath)
    }
    const path = url.pathname === '/' ? join(distDir, 'index.html') : join(distDir, url.pathname)
    let file = Bun.file(path)
    if (await file.exists()) return new Response(file)
    file = Bun.file(join(distDir, 'index.html'))
    return new Response(file)
  },
})

console.log(`Preview → ${preview.url} (DATA_ROOT=${dataRoot})`)
