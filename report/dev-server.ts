/**
 * Dev: Bun bundles React via HTML import + HMR.
 * Serves `/datasets/*`, `/data/*`, and generated areas index JSON from DATA_ROOT.
 * @see https://bun.sh/docs/bundler/fullstack
 */
import { join, resolve } from 'node:path'
import homepage from './index.html'
import { AREAS_GEN_URL_PATH } from './generatedAssets.ts'
import { listComparisonAreas } from './listComparisonAreas.ts'
import { repoDataFileResponse } from './serveRepoDataResponse.ts'

const repoRoot = resolve(import.meta.dir, '..')
const dataRoot = resolve(process.env.DATA_ROOT?.trim() || repoRoot)
const datasetsRoot = resolve(join(dataRoot, 'datasets'))
const processingRoot = resolve(join(dataRoot, 'data'))

async function serveDatasets(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const rel = decodeURIComponent(url.pathname.slice('/datasets/'.length))
  const filePath = resolve(join(datasetsRoot, rel))
  if (!filePath.startsWith(datasetsRoot)) {
    return new Response('Forbidden', { status: 403 })
  }
  return repoDataFileResponse(req, filePath)
}

async function serveAreasJson(req: Request): Promise<Response> {
  const areas = listComparisonAreas(dataRoot)
  return new Response(`${JSON.stringify({ areas }, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

async function serveProcessingData(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const rel = decodeURIComponent(url.pathname.slice('/data/'.length))
  const filePath = resolve(join(processingRoot, rel))
  if (!filePath.startsWith(processingRoot)) {
    return new Response('Forbidden', { status: 403 })
  }
  return repoDataFileResponse(req, filePath)
}

const server = Bun.serve({
  port: Number(process.env.PORT) || 3000,
  routes: {
    '/': homepage,
    [AREAS_GEN_URL_PATH]: serveAreasJson,
    '/datasets/*': serveDatasets,
    '/data/*': serveProcessingData,
    '/*': homepage,
  },
  development: {
    hmr: true,
  },
})

console.log(`Report dev → ${server.url} (DATA_ROOT=${dataRoot})`)
