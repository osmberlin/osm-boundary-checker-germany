import * as turf from '@turf/turf'
import type { BBox, Feature, MultiPolygon, Point, Polygon } from 'geojson'
import { featureBBox } from './featureBBox.ts'
import { isPoly, jstsAreaM2 } from './metrics/sharedGeom.ts'
import { projectGeometry } from './projectGeometry.ts'

/**
 * Minimum intersection area (m² in metricsCrs) when the representative-point test fails: only
 * substantive overlaps pass (not configurable per dataset—keeps configs simple).
 */
export const MERGED_SCOPE_FALLBACK_MIN_INTERSECTION_M2 = 100_000

/**
 * Minimum share of the OSM polygon’s area (metricsCrs) in that intersection. Border ribbons can
 * satisfy a large absolute m² while covering almost none of the OSM polygon; this rejects them.
 */
export const MERGED_SCOPE_FALLBACK_MIN_OVERLAP_RATIO = 0.08

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
    if (interArea < MERGED_SCOPE_FALLBACK_MIN_INTERSECTION_M2) return false
    const osmArea = jstsAreaM2(go)
    if (osmArea <= 0) return false
    if (interArea / osmArea < MERGED_SCOPE_FALLBACK_MIN_OVERLAP_RATIO) return false
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
): boolean {
  const g = osmFeature.geometry
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return false
  const osmPoly = osmFeature as Feature<Polygon | MultiPolygon>

  const osmBbox = featureBBox(osmFeature)
  if (!osmBbox) return false
  if (!bboxesOverlap(osmBbox, mergedBbox)) return false

  try {
    const rep = turf.pointOnFeature(osmPoly) as Feature<Point>
    if (turf.booleanPointInPolygon(rep, mergedOfficial)) return true
  } catch {
    /* fallback below */
  }

  try {
    if (!turf.booleanIntersects(osmPoly, mergedOfficial)) return false
  } catch {
    return false
  }

  return substantiveOverlapWithMerged(osmPoly, mergedOfficial, metricsCrs)
}

export function filterOsmByMergedOfficialScope(
  osmFeatures: Feature[],
  mergedOfficial: Feature<Polygon | MultiPolygon>,
  mergedBbox: BBox,
  metricsCrs: string,
): Feature[] {
  return osmFeatures.filter((f) =>
    passesMergedOfficialScope(f, mergedOfficial, mergedBbox, metricsCrs),
  )
}
