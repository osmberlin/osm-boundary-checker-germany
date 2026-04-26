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
  const fmt = src.outputFormat?.trim()
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
      srsName: srs,
    })
    if (fmt) params.set('outputFormat', fmt)
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
    srsName: srs,
  })
  if (fmt) params.set('outputFormat', fmt)
  return `${src.baseUrl}?${params.toString()}`
}

/** Direct GET to the WFS URL (services used by this app send CORS headers). */
export async function fetchWfsGetFeature(url: string): Promise<Response> {
  return fetch(url)
}

export type WfsFeatureProperties = Record<string, unknown> | null

export type WfsFeature = {
  id?: string | number
  properties: WfsFeatureProperties
  geometry?: GeoJSON.Geometry | null
}

type GeoJsonFeature = {
  type: 'Feature'
  id?: string | number
  properties: WfsFeatureProperties
  geometry?: GeoJSON.Geometry | null
}

type GeoJsonFeatureCollection = {
  type?: string
  features?: GeoJsonFeature[]
}

function getLocalName(name: string): string {
  const i = name.indexOf(':')
  return i >= 0 ? name.slice(i + 1) : name
}

function isGeometryLikeElement(tagName: string): boolean {
  const n = getLocalName(tagName).toLowerCase()
  return (
    n.includes('geom') ||
    n.includes('geometry') ||
    n.includes('surface') ||
    n.includes('curve') ||
    n.includes('point') ||
    n === 'boundedby' ||
    n === 'shape'
  )
}

function ringsEqual(a: number[], b: number[]): boolean {
  return a.length === 2 && b.length === 2 && a[0] === b[0] && a[1] === b[1]
}

function ensureClosedRing(ring: number[][]): number[][] {
  if (ring.length < 3) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (!first || !last) return ring
  return ringsEqual(first, last) ? ring : [...ring, [...first]]
}

function parsePosList(posListText: string): number[][] {
  const numbers = posListText
    .trim()
    .split(/\s+/)
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v))
  if (numbers.length < 6 || numbers.length % 2 !== 0) return []
  const ring: number[][] = []
  for (let i = 0; i < numbers.length; i += 2) {
    const x = numbers[i]
    const y = numbers[i + 1]
    if (x == null || y == null) continue
    ring.push([x, y])
  }
  return ensureClosedRing(ring)
}

function parseRingFromParent(parent: Element): number[][] | null {
  const posListEl = Array.from(parent.getElementsByTagName('*')).find(
    (el) => getLocalName(el.tagName).toLowerCase() === 'poslist',
  )
  if (!posListEl?.textContent) return null
  const ring = parsePosList(posListEl.textContent)
  return ring.length >= 4 ? ring : null
}

function parsePolygonElement(polygonEl: Element): GeoJSON.Polygon | null {
  const exteriorEl = Array.from(polygonEl.getElementsByTagName('*')).find(
    (el) => getLocalName(el.tagName).toLowerCase() === 'exterior',
  )
  const exteriorRing = exteriorEl ? parseRingFromParent(exteriorEl) : null
  if (!exteriorRing) return null

  const interiorEls = Array.from(polygonEl.getElementsByTagName('*')).filter(
    (el) => getLocalName(el.tagName).toLowerCase() === 'interior',
  )
  const holes = interiorEls
    .map((interiorEl) => parseRingFromParent(interiorEl))
    .filter((ring): ring is number[][] => ring != null && ring.length >= 4)

  return {
    type: 'Polygon',
    coordinates: [exteriorRing, ...holes],
  }
}

function parseMultiSurfaceElement(
  multiSurfaceEl: Element,
): GeoJSON.Polygon | GeoJSON.MultiPolygon | null {
  const polygonEls = Array.from(multiSurfaceEl.getElementsByTagName('*')).filter(
    (el) => getLocalName(el.tagName).toLowerCase() === 'polygon',
  )
  const polygons = polygonEls
    .map((polygonEl) => parsePolygonElement(polygonEl))
    .filter((polygon): polygon is GeoJSON.Polygon => polygon != null)
  if (polygons.length === 0) return null
  if (polygons.length === 1) return polygons[0]
  return {
    type: 'MultiPolygon',
    coordinates: polygons.map((polygon) => polygon.coordinates),
  }
}

function parseGeometryFromContainer(containerEl: Element): GeoJSON.Geometry | null {
  const multiSurfaceEl = Array.from(containerEl.getElementsByTagName('*')).find(
    (el) => getLocalName(el.tagName).toLowerCase() === 'multisurface',
  )
  if (multiSurfaceEl) return parseMultiSurfaceElement(multiSurfaceEl)

  const polygonEl = Array.from(containerEl.getElementsByTagName('*')).find(
    (el) => getLocalName(el.tagName).toLowerCase() === 'polygon',
  )
  if (polygonEl) return parsePolygonElement(polygonEl)
  return null
}

function parseGeoJsonFeatureCollection(text: string): WfsFeature[] | null {
  try {
    const data = JSON.parse(text) as GeoJsonFeatureCollection
    if (!data || !Array.isArray(data.features)) return null
    return data.features
      .filter((f) => f?.type === 'Feature')
      .map((feature) => ({
        id: feature.id,
        properties: feature.properties ?? null,
        geometry: feature.geometry ?? null,
      }))
  } catch {
    return null
  }
}

function extractExceptionText(xmlText: string): string | null {
  const matches = xmlText.match(/<[^>]*ExceptionText[^>]*>([\s\S]*?)<\/[^>]*ExceptionText>/i)
  if (!matches || matches[1] == null) return null
  const raw = matches[1].replace(/<[^>]+>/g, '').trim()
  return raw === '' ? null : raw
}

function parseWfsXmlFeatureCollection(xmlText: string): WfsFeature[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parserError = doc.querySelector('parsererror')
  if (parserError) {
    throw new Error('INVALID_WFS_XML')
  }
  const exceptionText = extractExceptionText(xmlText)
  if (exceptionText) {
    throw new Error(exceptionText)
  }

  const members = Array.from(doc.getElementsByTagName('*')).filter((node) => {
    const local = getLocalName(node.tagName).toLowerCase()
    return local === 'member' || local === 'featuremember'
  })

  const features: WfsFeature[] = []
  for (const member of members) {
    const root = Array.from(member.children).find((el) => el.tagName !== '')
    if (!root) continue
    const featureId =
      root.getAttribute('gml:id') ?? root.getAttribute('fid') ?? (root.id || undefined)
    const props: Record<string, unknown> = {}
    let geometry: GeoJSON.Geometry | null = null

    for (const child of Array.from(root.children)) {
      if (isGeometryLikeElement(child.tagName)) {
        geometry = parseGeometryFromContainer(child)
        continue
      }
      if (child.children.length > 0) continue
      const key = getLocalName(child.tagName)
      const value = child.textContent?.trim()
      if (!key || value == null || value === '') continue
      props[key] = value
    }

    features.push({
      id: featureId,
      properties: Object.keys(props).length > 0 ? props : null,
      geometry,
    })
  }
  return features
}

export function parseWfsFeatures(text: string): WfsFeature[] {
  const jsonFeatures = parseGeoJsonFeatureCollection(text)
  if (jsonFeatures) return jsonFeatures
  return parseWfsXmlFeatureCollection(text)
}

export function extractWfsErrorMessage(text: string): string | null {
  return extractExceptionText(text)
}
