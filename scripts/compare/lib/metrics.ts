import * as turf from '@turf/turf'
import type { Geometry, MultiPolygon, Polygon } from 'geojson'
import DiscreteHausdorffDistance from 'jsts/org/locationtech/jts/algorithm/distance/DiscreteHausdorffDistance.js'
import GeometryFactory from 'jsts/org/locationtech/jts/geom/GeometryFactory.js'
import GeoJSONReader from 'jsts/org/locationtech/jts/io/GeoJSONReader.js'

export type MetricResult = {
  iou: number
  areaDiffPct: number
  symmetricDiffPct: number
  hausdorffM: number
  officialAreaM2: number
  osmAreaM2: number
}

const geoReader = new GeoJSONReader(new GeometryFactory())

function isPoly(g: Geometry): g is Polygon | MultiPolygon {
  return g.type === 'Polygon' || g.type === 'MultiPolygon'
}

function jstsAreaM2(g: Geometry): number {
  const geom = geoReader.read(g) as { getArea: () => number }
  return geom.getArea()
}

export function calculateMetrics(
  officialProjected: Geometry,
  osmProjected: Geometry,
): MetricResult | null {
  if (!isPoly(officialProjected) || !isPoly(osmProjected)) return null

  const fo = turf.feature(officialProjected)
  const fOsm = turf.feature(osmProjected)

  const a1 = jstsAreaM2(officialProjected)
  const a2 = jstsAreaM2(osmProjected)
  if (a1 <= 0 || a2 <= 0) return null

  let inter: Geometry | null = null
  try {
    const i = turf.intersect(turf.featureCollection([fo, fOsm]))
    inter = i?.geometry ?? null
  } catch {
    return null
  }
  const interArea = inter ? jstsAreaM2(inter) : 0

  let uni: Geometry | null = null
  try {
    const u = turf.union(turf.featureCollection([fo, fOsm]))
    uni = u?.geometry ?? null
  } catch {
    return null
  }
  const unionArea = uni ? jstsAreaM2(uni) : 0
  const iou = unionArea > 0 ? interArea / unionArea : 0

  const areaDiffPct = a1 > 0 ? (Math.abs(a1 - a2) / a1) * 100 : 0

  const symDiffArea = a1 + a2 - 2 * interArea
  const symmetricDiffPct = a1 > 0 ? (symDiffArea / a1) * 100 : 0

  let hausdorffM = Number.NaN
  try {
    const g0 = geoReader.read(officialProjected)
    const g1 = geoReader.read(osmProjected)
    hausdorffM = DiscreteHausdorffDistance.distance(g0, g1)
  } catch {
    hausdorffM = Number.NaN
  }

  return {
    iou,
    areaDiffPct,
    symmetricDiffPct,
    hausdorffM,
    officialAreaM2: a1,
    osmAreaM2: a2,
  }
}
