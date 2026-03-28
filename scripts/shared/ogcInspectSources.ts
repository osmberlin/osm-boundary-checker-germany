/**
 * Optional WFS endpoints embedded in comparison_table.json for live property inspection.
 */

export type OgcWfsInspectSource = {
  id: string
  label: string
  type: 'wfs'
  /** Service root, e.g. https://sgx.geodatenzentrum.de/wfs_vg25 */
  baseUrl: string
  /** WFS 1.1 `typeName` / 2.0 `typeNames` (single layer). */
  typeName: string
  /** Default 1.1.0. Use 2.0.0 for services that require WFS 2 params (`typeNames`, `count`, …). */
  wfsVersion?: '1.1.0' | '2.0.0'
  /**
   * BBOX axis order for [west, south, east, north] from the report.
   * BKG WFS 1.1: lon,lat. Some WFS 2 + EPSG:4326 endpoints expect lat,lon.
   */
  bboxAxisOrder?: 'lonlat' | 'latlon'
  srsName?: string
  outputFormat?: string
  /** WFS 1.1 `maxFeatures` / 2.0 `count` */
  maxFeatures?: number
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

function asWfsSource(raw: Record<string, unknown>): OgcWfsInspectSource | null {
  if (raw.type !== 'wfs') return null
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.label)) return null
  if (!isNonEmptyString(raw.baseUrl) || !isNonEmptyString(raw.typeName)) return null
  const baseUrl = raw.baseUrl.trim().replace(/\/$/, '')
  let wfsVersion: '1.1.0' | '2.0.0' | undefined
  if (raw.wfsVersion === '1.1.0' || raw.wfsVersion === '2.0.0') {
    wfsVersion = raw.wfsVersion
  }
  let bboxAxisOrder: 'lonlat' | 'latlon' | undefined
  if (raw.bboxAxisOrder === 'lonlat' || raw.bboxAxisOrder === 'latlon') {
    bboxAxisOrder = raw.bboxAxisOrder
  }
  return {
    id: raw.id.trim(),
    label: raw.label.trim(),
    type: 'wfs',
    baseUrl,
    typeName: raw.typeName.trim(),
    wfsVersion,
    bboxAxisOrder,
    srsName: isNonEmptyString(raw.srsName) ? raw.srsName.trim() : undefined,
    outputFormat: isNonEmptyString(raw.outputFormat) ? raw.outputFormat.trim() : undefined,
    maxFeatures:
      typeof raw.maxFeatures === 'number' && Number.isFinite(raw.maxFeatures) && raw.maxFeatures > 0
        ? Math.min(500, Math.floor(raw.maxFeatures))
        : undefined,
  }
}

/** Parse `ogcInspectSources` from area config (JSONC root). */
export function parseOgcInspectSourcesFromConfig(configRoot: unknown): OgcWfsInspectSource[] {
  if (configRoot == null || typeof configRoot !== 'object') return []
  const raw = (configRoot as Record<string, unknown>).ogcInspectSources
  if (!Array.isArray(raw)) return []
  const out: OgcWfsInspectSource[] = []
  for (const item of raw) {
    if (item == null || typeof item !== 'object') continue
    const s = asWfsSource(item as Record<string, unknown>)
    if (s) out.push(s)
  }
  return out
}
