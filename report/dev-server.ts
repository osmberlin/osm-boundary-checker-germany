/**
 * Dev: Bun bundles React via HTML import + HMR.
 * Serves `/datasets/*` and `/data/*` from DATA_ROOT.
 * @see https://bun.sh/docs/bundler/fullstack
 */
import { join, resolve } from 'node:path'
import homepage from './index.html'
import { resolveRuntimeRoot } from './runtimeDataRoot.ts'
import { repoDataFileResponse } from './serveRepoDataResponse.ts'

const dataRoot = resolveRuntimeRoot()
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
    '/datasets/*': serveDatasets,
    '/data/*': serveProcessingData,
    '/*': homepage,
  },
  development: {
    hmr: true,
  },
})

console.log(`Report dev → ${server.url} (DATA_ROOT=${dataRoot})`)
