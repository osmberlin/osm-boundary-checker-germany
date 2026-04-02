import * as turf from '@turf/turf'
import type { Geometry } from 'geojson'
import { computeAreaDeltaPct } from './area-delta/compute.ts'
import { computeDiscreteHausdorffM } from './hausdorff/compute.ts'
import { computeIou } from './iou/compute.ts'
import { isPoly, jstsAreaM2 } from './sharedGeom.ts'
import { computeSymmetricDiffPct } from './symmetric-difference/compute.ts'
import type { MetricResult } from './types.ts'

export type { MetricResult } from './types.ts'

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

  const iou = computeIou(interArea, unionArea)
  const areaDiffPct = computeAreaDeltaPct(a1, a2)
  const symmetricDiffPct = computeSymmetricDiffPct(a1, a2, interArea)

  let hausdorffM = Number.NaN
  try {
    hausdorffM = computeDiscreteHausdorffM(officialProjected, osmProjected)
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
