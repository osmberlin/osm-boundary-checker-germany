/**
 * Machine-readable `download.official` in area `config.jsonc` (HTTP → GeoJSON → FlatGeobuf).
 */

export type DownloadOfficialHttp = {
  kind: 'http'
  url: string
  format: 'geojson'
  /** Declared / requested CRS (for logs; GeoJSON from WFS follows srsName in URL). */
  crs?: string
}

export function parseDownloadOfficial(doc: unknown): DownloadOfficialHttp | null {
  if (!doc || typeof doc !== 'object') return null
  const root = doc as Record<string, unknown>
  const download = root.download
  if (!download || typeof download !== 'object') return null
  const d = download as Record<string, unknown>
  const official = d.official
  if (!official || typeof official !== 'object') return null
  const o = official as Record<string, unknown>

  const url = typeof o.url === 'string' ? o.url.trim() : ''
  if (!url) return null

  const kind = typeof o.kind === 'string' ? o.kind.trim().toLowerCase() : 'http'
  if (kind !== 'http') {
    throw new Error(`Unsupported download.official.kind: "${kind}" (only "http" is supported)`)
  }

  const formatRaw = typeof o.format === 'string' ? o.format.trim().toLowerCase() : 'geojson'
  if (formatRaw !== 'geojson') {
    throw new Error(
      `Unsupported download.official.format: "${formatRaw}" (only "geojson" is supported)`,
    )
  }

  const crs = typeof o.crs === 'string' ? o.crs.trim() : undefined
  return { kind: 'http', url, format: 'geojson', crs }
}
