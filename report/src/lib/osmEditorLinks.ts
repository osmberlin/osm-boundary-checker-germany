import type { ReportRow } from '../types/report'
import { parseReportRowOsmRef } from './osmObjectRef'

const OSM_ID_EDITOR = 'https://ideditor.netlify.app/'

/** Hide most clutter; keep boundaries, water, and main roads visible (negative list). */
export const ID_DISABLE_FEATURES =
  'address_points,points,service_roads,paths,buildings,building_parts,indoor,landuse,rail,pistes,aerialways,power,past_future'

/** Preset OSM changeset hashtag for iD (`hashtags`) and JOSM (`changeset_hashtags`). */
export const CHANGESET_HASHTAG_GRENZABGLEICH = 'grenzabgleich'

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

/** iD standalone: pass API params in the hash portion of the URL. */
export function buildOpenStreetMapIdEditUrl(
  row: ReportRow,
  officialGeojsonAbsoluteUrl: string | null,
): string {
  const url = new URL(OSM_ID_EDITOR)
  const hash = new URLSearchParams()

  if (row.mapBbox) {
    const { zoom, lat, lon } = bboxToView(row.mapBbox)
    hash.set('map', `${zoom}/${lat.toFixed(6)}/${lon.toFixed(6)}`)
  }

  const osmRef = parseReportRowOsmRef(row.osmRelationId)
  if (osmRef) {
    hash.set('id', `r${osmRef.numericId}`)
  }

  hash.set('disable_features', ID_DISABLE_FEATURES)
  if (officialGeojsonAbsoluteUrl) {
    hash.set('gpx', officialGeojsonAbsoluteUrl)
  }

  hash.set('hashtags', CHANGESET_HASHTAG_GRENZABGLEICH)

  url.hash = hash.toString()
  return url.toString()
}

/** Browse URL for the matched OSM object on openstreetmap.org (read-only). */
export function buildOpenStreetMapBrowseRelationUrl(row: ReportRow): string | null {
  const ref = parseReportRowOsmRef(row.osmRelationId)
  if (!ref) return null
  return `https://www.openstreetmap.org/relation/${encodeURIComponent(String(ref.numericId))}`
}

export type JosmEditorLinks = {
  loadObject: string | null
  importGeojson: string | null
}

export function buildJosmEditorLinks(
  row: ReportRow,
  officialGeojsonAbsoluteUrl: string | null,
): JosmEditorLinks {
  const hashtagQs = `changeset_hashtags=${encodeURIComponent(CHANGESET_HASHTAG_GRENZABGLEICH)}`
  const ref = parseReportRowOsmRef(row.osmRelationId)
  const loadObject =
    ref != null
      ? `${JOSM_REMOTE}/load_object?relation_members=true&objects=r${ref.numericId}&${hashtagQs}`
      : null
  const importGeojson = officialGeojsonAbsoluteUrl
    ? `${JOSM_REMOTE}/import?new_layer=true&${hashtagQs}&url=${encodeURIComponent(officialGeojsonAbsoluteUrl)}`
    : null
  return { loadObject, importGeojson }
}
