import type { OgcWfsInspectSource } from '../types/report'

/** Pad WGS84 bbox [west, south, east, north] for WFS queries. */
export function padMapBbox(
  bbox: [number, number, number, number],
  ratio = 0.06,
): [number, number, number, number] {
  const [w, s, e, n] = bbox
  const dw = (e - w) * ratio
  const dh = (n - s) * ratio
  return [w - dw, s - dh, e + dw, n + dh]
}

function bboxAxis(bbox: [number, number, number, number], order: 'lonlat' | 'latlon'): string {
  const [west, south, east, north] = bbox
  return order === 'lonlat'
    ? `${west},${south},${east},${north}`
    : `${south},${west},${north},${east}`
}

/**
 * Build a WFS GetFeature URL. `bbox` is always WGS84 [west, south, east, north].
 */
export function buildWfsGetFeatureUrl(
  src: OgcWfsInspectSource,
  bbox: [number, number, number, number],
): string {
  const ver = src.wfsVersion ?? '1.1.0'
  const max = src.maxFeatures ?? 50
  const fmt = src.outputFormat ?? 'application/json'
  const axis =
    src.bboxAxisOrder ??
    (ver === '2.0.0' && (src.srsName ?? 'EPSG:4326') === 'EPSG:4326' ? 'latlon' : 'lonlat')

  if (ver === '2.0.0') {
    const srs = src.srsName ?? 'EPSG:4326'
    const crsParam = srs === 'EPSG:4326' ? 'urn:ogc:def:crs:EPSG::4326' : srs
    const params = new URLSearchParams({
      service: 'wfs',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: src.typeName,
      bbox: `${bboxAxis(bbox, axis)},${crsParam}`,
      count: String(max),
      outputFormat: fmt,
    })
    return `${src.baseUrl}?${params.toString()}`
  }

  const srs = src.srsName ?? 'EPSG:4326'
  const params = new URLSearchParams({
    service: 'wfs',
    version: '1.1.0',
    request: 'GetFeature',
    typeName: src.typeName,
    bbox: `${bboxAxis(bbox, axis)},${srs}`,
    maxFeatures: String(max),
    outputFormat: fmt,
  })
  return `${src.baseUrl}?${params.toString()}`
}

/** Direct GET to the WFS URL (services used by this app send CORS headers). */
export async function fetchWfsGetFeature(url: string): Promise<Response> {
  return fetch(url)
}
