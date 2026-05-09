import * as turf from '@turf/turf'
import type { BBox, Feature } from 'geojson'

/** GDAL-style bbox columns on FGB features (optional); falls back to {@link turf.bbox}. */
export function featureBBox(f: Feature): BBox {
  const p = f.properties as Record<string, unknown> | null | undefined
  if (p) {
    const minx = p['_bbox_minx']
    const miny = p['_bbox_miny']
    const maxx = p['_bbox_maxx']
    const maxy = p['_bbox_maxy']
    if (
      typeof minx === 'number' &&
      typeof miny === 'number' &&
      typeof maxx === 'number' &&
      typeof maxy === 'number' &&
      Number.isFinite(minx) &&
      Number.isFinite(miny) &&
      Number.isFinite(maxx) &&
      Number.isFinite(maxy)
    ) {
      return [minx, miny, maxx, maxy]
    }
  }
  return turf.bbox(f) as BBox
}
