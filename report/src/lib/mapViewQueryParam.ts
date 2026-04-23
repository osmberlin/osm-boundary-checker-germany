import { z } from 'zod'

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function roundMapViewForUrl(
  v: Pick<MapViewQueryValue, 'zoom' | 'latitude' | 'longitude'>,
): MapViewQueryValue {
  const z = 10 ** COORD_DECIMALS
  return {
    zoom: clamp(Math.round(v.zoom * 10 ** ZOOM_DECIMALS) / 10 ** ZOOM_DECIMALS, 0, 24),
    latitude: clamp(Math.round(v.latitude * z) / z, -90, 90),
    longitude: clamp(Math.round(v.longitude * z) / z, -180, 180),
  }
}

export function serializeMapViewQueryString(
  v: Pick<MapViewQueryValue, 'zoom' | 'latitude' | 'longitude'>,
): string {
  const r = roundMapViewForUrl(v)
  return `${r.zoom}/${r.latitude}/${r.longitude}`
}

const mapViewSchema = z.object({
  zoom: z.number().min(0).max(24),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
})

export function parseMapViewQueryValue(query: unknown): MapViewQueryValue | null {
  if (typeof query !== 'string') return null
  const parts = query.split('/')
  if (parts.length !== 3) return null
  const [zStr, latStr, lngStr] = parts
  if (zStr === undefined || latStr === undefined || lngStr === undefined) return null
  const parsed = mapViewSchema.safeParse({
    zoom: Number.parseFloat(zStr),
    latitude: Number.parseFloat(latStr),
    longitude: Number.parseFloat(lngStr),
  })
  if (!parsed.success) return null
  return parsed.data
}
