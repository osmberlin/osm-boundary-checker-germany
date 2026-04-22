import path from 'node:path'

/**
 * WHAT: Serves `report/dist` with Bun and verifies PMTiles responds to both HEAD and byte-range requests.
 * WHY: PMTiles clients rely on HTTP range semantics, so deploys should fail fast if static hosting cannot serve ranges correctly.
 */
const pmtilesPath = 'datasets/de-gemeinden/output/comparison.pmtiles'

const port = 4173
const reportDistRoot = path.resolve('report/dist')

const server = Bun.serve({
  port,
  fetch(request) {
    const url = new URL(request.url)
    const requestPath = decodeURIComponent(url.pathname)
    const normalizedPath = requestPath.replace(/^\/+/, '')
    const fullPath = path.resolve(reportDistRoot, normalizedPath)

    if (!fullPath.startsWith(reportDistRoot)) {
      return new Response('Not found', { status: 404 })
    }

    const file = Bun.file(fullPath)
    return new Response(file)
  },
})

async function waitForServer(url: string): Promise<void> {
  const attempts = 20
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (response.ok) {
        return
      }
    } catch {
      // Server might not be ready yet.
    }
    await Bun.sleep(250)
  }
  throw new Error('Timed out waiting for local HTTP server.')
}

async function runSmokeTest(): Promise<void> {
  const baseUrl = `http://127.0.0.1:${port}/`
  const fileUrl = new URL(pmtilesPath, baseUrl).toString()

  await waitForServer(baseUrl)

  const headResponse = await fetch(fileUrl, { method: 'HEAD' })
  if (!headResponse.ok) {
    throw new Error(`HEAD request failed with status ${headResponse.status} for ${fileUrl}`)
  }
  if (!headResponse.headers.has('content-length')) {
    throw new Error(`Missing Content-Length header for ${fileUrl}`)
  }

  const rangeResponse = await fetch(fileUrl, { headers: { Range: 'bytes=0-15' } })
  if (!rangeResponse.ok) {
    throw new Error(`Range request failed with status ${rangeResponse.status} for ${fileUrl}`)
  }
  const contentRange = rangeResponse.headers.get('content-range')
  if (!contentRange || !contentRange.startsWith('bytes ')) {
    throw new Error(`Missing or invalid Content-Range header for ${fileUrl}`)
  }
}

try {
  await runSmokeTest()
} finally {
  server.stop(true)
}
