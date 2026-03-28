import { createParser } from 'nuqs'

/**
 * OSM-style map fragment: `zoom/latitude/longitude` (e.g. `14/47.30799/8.53252`).
 * Coordinates are rounded to 6 decimal places in the serialized URL; the map keeps
 * full precision while interacting.
 */
export type MapViewQueryValue = {
  zoom: number
  latitude: number
  longitude: number
}

export const MAP_VIEW_QUERY_KEY = 'map'

const COORD_DECIMALS = 6
const ZOOM_DECIMALS = 1

export function roundMapViewForUrl(
  v: Pick<MapViewQueryValue, 'zoom' | 'latitude' | 'longitude'>,
): MapViewQueryValue {
  const z = 10 ** COORD_DECIMALS
  return {
    zoom: Math.round(v.zoom * 10 ** ZOOM_DECIMALS) / 10 ** ZOOM_DECIMALS,
    latitude: Math.round(v.latitude * z) / z,
    longitude: Math.round(v.longitude * z) / z,
  }
}

export function serializeMapViewQueryString(
  v: Pick<MapViewQueryValue, 'zoom' | 'latitude' | 'longitude'>,
): string {
  const r = roundMapViewForUrl(v)
  return `${r.zoom}/${r.latitude}/${r.longitude}`
}

export const mapViewQueryParamParser = createParser({
  parse: (query: string) => {
    const parts = query.split('/')
    if (parts.length !== 3) return null
    const [zStr, latStr, lngStr] = parts
    if (zStr === undefined || latStr === undefined || lngStr === undefined) return null

    const zoom = Number.parseFloat(zStr)
    const lat = Number.parseFloat(latStr)
    const lng = Number.parseFloat(lngStr)

    if (Number.isNaN(zoom) || Number.isNaN(lat) || Number.isNaN(lng)) {
      return null
    }
    if (zoom < 0 || zoom > 24) return null
    if (lat < -90 || lat > 90) return null
    if (lng < -180 || lng > 180) return null

    return { zoom, latitude: lat, longitude: lng } satisfies MapViewQueryValue
  },
  serialize: (value: MapViewQueryValue) => serializeMapViewQueryString(value),
}).withOptions({ history: 'replace' })
