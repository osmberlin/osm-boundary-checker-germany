import type { ReportRow } from '../types/report'

const OSM_ID_EDITOR = 'https://www.openstreetmap.org/edit'

/** Hide most clutter; keep boundaries, water, and main roads visible (negative list). */
export const ID_DISABLE_FEATURES =
  'points,service_roads,paths,buildings,building_parts,indoor,landuse,rail,pistes,aerialways,power,past_future,others'

const JOSM_REMOTE = 'http://127.0.0.1:8111'

export function absoluteUrlFromPath(pathnameWithLeadingSlash: string): string {
  return new URL(pathnameWithLeadingSlash, window.location.origin).href
}

function bboxToView(bbox: [number, number, number, number]): {
  zoom: number
  lat: number
  lon: number
} {
  const [w, s, e, n] = bbox
  const lat = (s + n) / 2
  const lon = (w + e) / 2
  const latSpan = Math.max(1e-6, n - s)
  const lonSpan = Math.max(1e-6, e - w)
  const span = Math.max(latSpan, lonSpan)
  const zoom = Math.min(18, Math.max(11, Math.round(14 - Math.log2(span * 45))))
  return { zoom, lat, lon }
}

/**
 * openstreetmap.org iD: query selects relation; hash carries gpx URL + disable_features.
 * Custom GeoJSON URL must be in the hash (not query `gpx` — that is for trace IDs).
 */
export function buildOpenStreetMapIdEditUrl(
  row: ReportRow,
  officialGeojsonAbsoluteUrl: string | null,
): string {
  const url = new URL(OSM_ID_EDITOR)
  url.searchParams.set('editor', 'id')

  if (row.mapBbox) {
    const { zoom, lat, lon } = bboxToView(row.mapBbox)
    url.searchParams.set('lat', lat.toFixed(6))
    url.searchParams.set('lon', lon.toFixed(6))
    url.searchParams.set('zoom', String(zoom))
  }

  if (row.osmRelationId.trim() !== '') {
    url.searchParams.set('relation', row.osmRelationId.trim())
  }

  const hash = new URLSearchParams()
  hash.set('disable_features', ID_DISABLE_FEATURES)
  if (officialGeojsonAbsoluteUrl) {
    hash.set('gpx', officialGeojsonAbsoluteUrl)
  }

  return `${url.pathname}${url.search}#${hash.toString()}`
}

export type JosmEditorLinks = {
  loadObject: string | null
  importGeojson: string | null
  loadAndZoom: string | null
}

export function buildJosmEditorLinks(
  row: ReportRow,
  officialGeojsonAbsoluteUrl: string | null,
): JosmEditorLinks {
  const id = row.osmRelationId.trim()
  const loadObject =
    id !== '' ? `${JOSM_REMOTE}/load_object?relation_members=true&objects=r${id}` : null
  const importGeojson = officialGeojsonAbsoluteUrl
    ? `${JOSM_REMOTE}/import?new_layer=true&url=${encodeURIComponent(officialGeojsonAbsoluteUrl)}`
    : null
  let loadAndZoom: string | null = null
  if (row.mapBbox && id !== '') {
    const [w, s, e, n] = row.mapBbox
    const params = new URLSearchParams({
      left: String(w),
      right: String(e),
      bottom: String(s),
      top: String(n),
      select: `r${id}`,
    })
    loadAndZoom = `${JOSM_REMOTE}/load_and_zoom?${params.toString()}`
  }
  return { loadObject, importGeojson, loadAndZoom }
}
