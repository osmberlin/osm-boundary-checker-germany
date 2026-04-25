/**
 * Machine-readable `official.download` in area `config.jsonc`.
 */

export type DownloadOfficialHttp = {
  kind: 'http'
  url: string
  format: 'geojson' | 'gml'
  /** Declared / requested CRS (for logs; GeoJSON from WFS follows srsName in URL). */
  crs?: string
}

export function parseDownloadOfficial(doc: unknown): DownloadOfficialHttp | null {
  if (!doc || typeof doc !== 'object') return null
  const root = doc as Record<string, unknown>
  const official = root.official
  if (!official || typeof official !== 'object') return null
  const o = official as Record<string, unknown>
  const download = o.download
  if (!download || typeof download !== 'object') return null
  const d = download as Record<string, unknown>

  const url = typeof d.url === 'string' ? d.url.trim() : ''
  if (!url) return null

  const kind = typeof d.kind === 'string' ? d.kind.trim().toLowerCase() : 'http'
  if (kind !== 'http') {
    throw new Error(`Unsupported official.download.kind: "${kind}" (only "http" is supported)`)
  }

  const formatRaw = typeof d.format === 'string' ? d.format.trim().toLowerCase() : 'geojson'
  if (formatRaw !== 'geojson' && formatRaw !== 'gml') {
    throw new Error(
      `Unsupported official.download.format: "${formatRaw}" (only "geojson" or "gml" is supported)`,
    )
  }

  const crs = typeof d.crs === 'string' ? d.crs.trim() : undefined
  return { kind: 'http', url, format: formatRaw, crs }
}
