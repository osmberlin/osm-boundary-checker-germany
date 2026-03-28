/**
 * PMTiles uses HTTP Range (`FetchSource`); responses need `Content-Length` and
 * `206` + `Content-Range` for ranged requests. Implemented with Node `fs` only
 * (works under Bun or a future Node dev server — no `Bun.file`).
 * Static hosts (Netlify, GitHub Pages, …) usually do this for uploaded files.
 * @see https://github.com/protomaps/PMTiles#maplibre-gl-js
 */
import { createReadStream } from 'node:fs'
import { open, stat } from 'node:fs/promises'
import { extname } from 'node:path'
import { Readable } from 'node:stream'

const MIME: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.pmtiles': 'application/vnd.pmtiles',
  '.geojson': 'application/geo+json',
  '.csv': 'text/csv; charset=utf-8',
}

function mimeForPath(filePath: string): string {
  return MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

export async function repoDataFileResponse(req: Request, filePath: string): Promise<Response> {
  let st: Awaited<ReturnType<typeof stat>>
  try {
    st = await stat(filePath)
  } catch {
    return new Response('Not found', { status: 404 })
  }
  if (!st.isFile()) {
    return new Response('Not found', { status: 404 })
  }

  const size = st.size
  const contentType = mimeForPath(filePath)
  const baseHeaders: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=0',
  }

  if (size === 0) {
    return new Response(null, {
      headers: {
        ...baseHeaders,
        'Content-Type': contentType,
        'Content-Length': '0',
      },
    })
  }

  const range = req.headers.get('range')
  if (range?.trim().toLowerCase().startsWith('bytes=')) {
    const raw = range.slice('bytes='.length).trim()
    const [startPart, endPart] = raw.split('-', 2)
    let start = startPart === '' ? NaN : Number.parseInt(startPart, 10)
    let end = endPart === '' || endPart === undefined ? NaN : Number.parseInt(endPart, 10)
    if (Number.isNaN(start)) start = 0
    if (Number.isNaN(end)) end = size - 1
    start = Math.min(Math.max(0, start), size - 1)
    end = Math.min(Math.max(start, end), size - 1)
    const length = end - start + 1

    const fh = await open(filePath, 'r')
    try {
      const buf = Buffer.alloc(length)
      await fh.read(buf, 0, length, start)
      return new Response(buf, {
        status: 206,
        headers: {
          ...baseHeaders,
          'Content-Type': contentType,
          'Content-Length': String(length),
          'Content-Range': `bytes ${start}-${end}/${size}`,
        },
      })
    } finally {
      await fh.close()
    }
  }

  const nodeStream = createReadStream(filePath)
  const body = Readable.toWeb(nodeStream) as unknown as ReadableStream
  return new Response(body, {
    headers: {
      ...baseHeaders,
      'Content-Type': contentType,
      'Content-Length': String(size),
    },
  })
}
