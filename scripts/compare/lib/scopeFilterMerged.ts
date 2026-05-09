import * as turf from '@turf/turf'
import type { BBox, Feature, MultiPolygon, Point, Polygon } from 'geojson'
import { featureBBox } from './featureBBox.ts'
import { isPoly, jstsAreaM2 } from './metrics/sharedGeom.ts'
import { projectGeometry } from './projectGeometry.ts'

/** Default minimum intersection area (m² in metricsCrs) for scope fallback when pip fails. Rejects touch-only matches. */
export const DEFAULT_SCOPE_OVERLAP_MIN_M2 = 10_000

function toPolygonFeature(feature: Feature): Feature<Polygon | MultiPolygon> | null {
  const geometry = feature.geometry
  if (!geometry) return null
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return null
  return feature as Feature<Polygon | MultiPolygon>
}

/**
 * Union all polygonal official features into one footprint (Land / subset collective area).
 */
export function mergeOfficialFootprint(
  officialFeatures: Feature[],
): Feature<Polygon | MultiPolygon> | null {
  const polys: Feature<Polygon | MultiPolygon>[] = []
  for (const f of officialFeatures) {
    const p = toPolygonFeature(f)
    if (p?.geometry) {
      polys.push({ type: 'Feature', properties: {}, geometry: p.geometry })
    }
  }
  if (polys.length === 0) return null
  if (polys.length === 1) return polys[0]!

  let merged: Feature<Polygon | MultiPolygon> = polys[0]!
  for (let i = 1; i < polys.length; i++) {
    const next = polys[i]!
    try {
      const u = turf.union(turf.featureCollection([merged, next]))
      const g = u?.geometry
      if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) {
        console.warn(
          `[mergeOfficialFootprint] turf.union returned non-polygon at segment ${i}/${polys.length - 1}; falling back to legacy pairwise scope intersection`,
        )
        return null
      }
      merged = { type: 'Feature', properties: {}, geometry: g }
    } catch {
      console.warn(
        `[mergeOfficialFootprint] turf.union failed at segment ${i}/${polys.length - 1}; falling back to legacy pairwise scope intersection`,
      )
      return null
    }
  }
  return merged
}

function substantiveOverlapWithMerged(
  osmWgs: Feature<Polygon | MultiPolygon>,
  mergedWgs: Feature<Polygon | MultiPolygon>,
  metricsCrs: string,
  overlapMinM2: number,
  overlapMinRatio: number | undefined,
): boolean {
  try {
    const go = projectGeometry(osmWgs.geometry, metricsCrs)
    const gm = projectGeometry(mergedWgs.geometry, metricsCrs)
    if (!isPoly(go) || !isPoly(gm)) return false
    const fo = turf.feature(go)
    const fm = turf.feature(gm)
    const inter = turf.intersect(turf.featureCollection([fo, fm]))
    const ig = inter?.geometry
    if (!ig || !isPoly(ig)) return false
    const interArea = jstsAreaM2(ig)
    if (interArea < overlapMinM2) return false
    if (overlapMinRatio !== undefined && overlapMinRatio > 0) {
      const osmArea = jstsAreaM2(go)
      if (osmArea <= 0) return false
      if (interArea / osmArea < overlapMinRatio) return false
    }
    return true
  } catch {
    return false
  }
}

function bboxesOverlap(a: BBox, b: BBox): boolean {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

/**
 * Retains OSM polygons whose representative point lies inside the merged official footprint,
 * or (fallback) whose intersection with that footprint in metricsCrs has area ≥ thresholds—
 * excluding grazing line-only touches.
 */
export function passesMergedOfficialScope(
  osmFeature: Feature,
  mergedOfficial: Feature<Polygon | MultiPolygon>,
  mergedBbox: BBox,
  metricsCrs: string,
  overlapMinM2: number,
  overlapMinRatio: number | undefined,
): boolean {
  const g = osmFeature.geometry
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return false
  const osmPoly = osmFeature as Feature<Polygon | MultiPolygon>

  let osmBbox: BBox
  try {
    osmBbox = featureBBox(osmFeature)
  } catch {
    return false
  }
  if (!bboxesOverlap(osmBbox, mergedBbox)) return false

  try {
    const rep = turf.pointOnFeature(osmPoly) as Feature<Point>
    if (turf.booleanPointInPolygon(rep, mergedOfficial)) return true
  } catch {
    /* fallback below */
  }

  return substantiveOverlapWithMerged(
    osmPoly,
    mergedOfficial,
    metricsCrs,
    overlapMinM2,
    overlapMinRatio,
  )
}

export function filterOsmByMergedOfficialScope(
  osmFeatures: Feature[],
  mergedOfficial: Feature<Polygon | MultiPolygon>,
  mergedBbox: BBox,
  metricsCrs: string,
  overlapMinM2: number,
  overlapMinRatio: number | undefined,
): Feature[] {
  return osmFeatures.filter((f) =>
    passesMergedOfficialScope(
      f,
      mergedOfficial,
      mergedBbox,
      metricsCrs,
      overlapMinM2,
      overlapMinRatio,
    ),
  )
}
