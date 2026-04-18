/** Serves `dist/` + `/datasets/*` + `/data/*` + generated areas index JSON from DATA_ROOT. */
import { join, resolve } from 'node:path'
import { AREAS_GEN_URL_PATH } from './generatedAssets.ts'
import { listComparisonAreaSummaries } from './listComparisonAreas.ts'
import {
  loadComparisonForArea,
  loadFeatureForArea,
  loadSnapshotsForArea,
  loadUnmatchedForArea,
} from './runtimeDataStore.ts'
import { repoDataFileResponse } from './serveRepoDataResponse.ts'

const repoRoot = resolve(import.meta.dir, '..')
const distDir = join(import.meta.dir, 'dist')
const dataRoot = resolve(process.env.DATA_ROOT?.trim() || repoRoot)
const datasetsRoot = resolve(join(dataRoot, 'datasets'))
const processingRoot = resolve(join(dataRoot, 'data'))

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(body, null, 2)}\n`, {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

function serveApi(url: URL): Response {
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length < 2 || parts[0] !== 'api' || parts[1] !== 'areas') {
    return new Response('Not found', { status: 404 })
  }
  if (parts.length === 2) {
    const summaries = listComparisonAreaSummaries(dataRoot)
    const areas = summaries.map((s) => s.area)
    return jsonResponse({ areas, summaries })
  }
  const areaId = decodeURIComponent(parts[2] ?? '')
  if (!areaId) return new Response('Not found', { status: 404 })
  if (parts.length === 3) {
    const data = loadComparisonForArea(dataRoot, areaId)
    return data ? jsonResponse(data) : new Response('Not found', { status: 404 })
  }
  if (parts.length === 4 && parts[3] === 'runs') {
    const data = loadSnapshotsForArea(dataRoot, areaId)
    return data ? jsonResponse(data) : new Response('Not found', { status: 404 })
  }
  if (parts.length === 4 && parts[3] === 'unmatched') {
    const data = loadUnmatchedForArea(dataRoot, areaId)
    return data ? jsonResponse(data) : new Response('Not found', { status: 404 })
  }
  if (parts.length === 5 && parts[3] === 'features') {
    const featureKey = decodeURIComponent(parts[4] ?? '')
    if (!featureKey) return new Response('Not found', { status: 404 })
    const data = loadFeatureForArea(dataRoot, areaId, featureKey)
    return data ? jsonResponse(data) : new Response('Not found', { status: 404 })
  }
  return new Response('Not found', { status: 404 })
}

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
    if (url.pathname === '/api/areas' || url.pathname.startsWith('/api/areas/')) {
      return serveApi(url)
    }

    const path = url.pathname === '/' ? join(distDir, 'index.html') : join(distDir, url.pathname)
    let file = Bun.file(path)
    if (await file.exists()) return new Response(file)
    file = Bun.file(join(distDir, 'index.html'))
    return new Response(file)
  },
})

console.log(`Preview → ${preview.url} (DATA_ROOT=${dataRoot})`)
