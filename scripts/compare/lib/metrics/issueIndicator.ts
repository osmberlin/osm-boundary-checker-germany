import type { Geometry, MultiPolygon, Polygon } from 'geojson'
import DistanceOp from 'jsts/org/locationtech/jts/operation/distance/DistanceOp.js'
import { geoReader, jstsBoundaryLengthM } from './sharedGeom.ts'
import type { IssueIndicator, IssueIndicatorReason, MetricResult } from './types.ts'

const MAX_BOUNDARY_SAMPLE_POINTS = 600
const EPS = 1e-9
const MODIFIED_Z_OUTLIER = 3.5
const MIN_BASELINE_SAMPLES = 8

type PointXY = readonly [number, number]

type BaselineDeltaRow = {
  key: string
  current: MetricResult
  previous: MetricResult
}

function collectBoundaryPoints(g: Polygon | MultiPolygon): PointXY[] {
  const out: PointXY[] = []
  const pushRing = (ring: number[][]) => {
    const ringLen = ring.length
    const max = ringLen > 1 ? ringLen - 1 : ringLen
    for (let i = 0; i < max; i++) {
      const p = ring[i]
      if (!p || p.length < 2) continue
      out.push([p[0]!, p[1]!])
    }
  }
  if (g.type === 'Polygon') {
    for (const ring of g.coordinates) pushRing(ring)
    return out
  }
  for (const polygon of g.coordinates) {
    for (const ring of polygon) pushRing(ring)
  }
  return out
}

function sampleBoundaryPoints(points: PointXY[]): PointXY[] {
  if (points.length <= MAX_BOUNDARY_SAMPLE_POINTS) return points
  const sampled: PointXY[] = []
  const step = points.length / MAX_BOUNDARY_SAMPLE_POINTS
  for (let i = 0; i < MAX_BOUNDARY_SAMPLE_POINTS; i++) {
    const idx = Math.floor(i * step)
    const point = points[idx]
    if (point) sampled.push(point)
  }
  return sampled
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]!
  const clamped = Math.max(0, Math.min(100, p))
  const index = (clamped / 100) * (sorted.length - 1)
  const lo = Math.floor(index)
  const hi = Math.ceil(index)
  if (lo === hi) return sorted[lo]!
  const frac = index - lo
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac
}

function median(values: number[]): number {
  return percentile(values, 50)
}

function modifiedZScore(value: number, med: number, mad: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(med)) return 0
  if (!(mad > 0)) return value === med ? 0 : Number.POSITIVE_INFINITY
  return (0.6745 * (value - med)) / mad
}

function directedBoundaryDistances(source: PointXY[], target: Geometry): number[] {
  if (source.length === 0) return []
  const targetGeom = geoReader.read(target) as { getBoundary: () => unknown }
  const targetBoundary = targetGeom.getBoundary()
  const out: number[] = []
  for (const [x, y] of source) {
    const p = geoReader.read({ type: 'Point', coordinates: [x, y] })
    const d = DistanceOp.distance(targetBoundary as never, p as never)
    if (Number.isFinite(d)) out.push(d)
  }
  return out
}

export function computeRobustHausdorffP95M(
  officialProjected: Polygon | MultiPolygon,
  osmProjected: Polygon | MultiPolygon,
): number {
  const officialPoints = sampleBoundaryPoints(collectBoundaryPoints(officialProjected))
  const osmPoints = sampleBoundaryPoints(collectBoundaryPoints(osmProjected))
  const dOfficialToOsm = directedBoundaryDistances(officialPoints, osmProjected)
  const dOsmToOfficial = directedBoundaryDistances(osmPoints, officialProjected)
  const p95OfficialToOsm = percentile(dOfficialToOsm, 95)
  const p95OsmToOfficial = percentile(dOsmToOfficial, 95)
  if (!Number.isFinite(p95OfficialToOsm) && !Number.isFinite(p95OsmToOfficial)) return Number.NaN
  if (!Number.isFinite(p95OfficialToOsm)) return p95OsmToOfficial
  if (!Number.isFinite(p95OsmToOfficial)) return p95OfficialToOsm
  return Math.max(p95OfficialToOsm, p95OsmToOfficial)
}

export function computeHausdorffNorm(
  hausdorffP95M: number,
  officialProjected: Polygon | MultiPolygon,
  officialAreaM2: number,
): number {
  if (!Number.isFinite(hausdorffP95M)) return Number.NaN
  const perimeter = jstsBoundaryLengthM(officialProjected)
  if (Number.isFinite(perimeter) && perimeter > EPS) return hausdorffP95M / perimeter
  if (officialAreaM2 > EPS) return hausdorffP95M / Math.sqrt(officialAreaM2)
  return Number.NaN
}

export function withRobustBoundaryMetrics(
  metrics: MetricResult,
  officialProjected: Polygon | MultiPolygon,
  osmProjected: Polygon | MultiPolygon,
): MetricResult {
  const hausdorffP95M = computeRobustHausdorffP95M(officialProjected, osmProjected)
  const hausdorffNorm = computeHausdorffNorm(
    hausdorffP95M,
    officialProjected,
    metrics.officialAreaM2,
  )
  return {
    ...metrics,
    hausdorffP95M,
    hausdorffNorm,
  }
}

function addReason(reasons: Set<IssueIndicatorReason>, reason: IssueIndicatorReason, when = true) {
  if (when) reasons.add(reason)
}

export function classifyIssueIndicator(
  metrics: MetricResult,
  baselineReasons: readonly IssueIndicatorReason[] = [],
): IssueIndicator {
  const reasons = new Set<IssueIndicatorReason>(baselineReasons)
  const iou = metrics.iou
  const areaDelta = Math.abs(metrics.areaDiffPct)
  const symDiff = Math.abs(metrics.symmetricDiffPct)
  const hausNorm = Number.isFinite(metrics.hausdorffNorm ?? Number.NaN)
    ? Math.abs(metrics.hausdorffNorm!)
    : Number.NaN

  const overlapVeryStrong = iou >= 0.995 && symDiff <= 0.35 && areaDelta <= 0.35
  const overlapGood = iou >= 0.99 && symDiff <= 0.75
  const boundaryOutlier = Number.isFinite(hausNorm) && hausNorm >= 0.02
  const severeBoundaryOutlier = Number.isFinite(hausNorm) && hausNorm >= 0.04
  const lowIouAndHighSymDiff = iou < 0.985 && symDiff > 1.5
  const highAreaDelta = areaDelta > 1.2

  addReason(reasons, 'STRONG_OVERLAP_LOW_DIFF', overlapVeryStrong)
  addReason(reasons, 'BOUNDARY_OUTLIER_BUT_OVERLAP_STABLE', boundaryOutlier && overlapGood)
  addReason(reasons, 'LOW_IOU_HIGH_SYM_DIFF', lowIouAndHighSymDiff)
  addReason(reasons, 'HIGH_AREA_DELTA', highAreaDelta)

  let level: IssueIndicator['level'] = 'ok'
  if (lowIouAndHighSymDiff || (highAreaDelta && severeBoundaryOutlier)) {
    level = 'issue'
  } else if (
    boundaryOutlier ||
    highAreaDelta ||
    baselineReasons.length > 0 ||
    (!overlapVeryStrong && iou < 0.99)
  ) {
    level = 'review'
  }
  if (
    overlapVeryStrong &&
    !lowIouAndHighSymDiff &&
    !highAreaDelta &&
    baselineReasons.length === 0
  ) {
    level = 'ok'
  }

  return {
    level,
    reasons: Array.from(reasons),
  }
}

function finiteValues(values: Array<number | null>): number[] {
  return values.filter((v): v is number => v != null && Number.isFinite(v))
}

function computeDeltaAnomalyReasons(
  rows: BaselineDeltaRow[],
  getDelta: (row: BaselineDeltaRow) => number | null,
  _reason: IssueIndicatorReason,
): Set<string> {
  const deltas = rows.map((row) => getDelta(row))
  const finite = finiteValues(deltas)
  if (finite.length < MIN_BASELINE_SAMPLES) return new Set()
  const med = median(finite)
  const absDev = finite.map((v) => Math.abs(v - med))
  const mad = median(absDev)
  const out = new Set<string>()
  for (const row of rows) {
    const delta = getDelta(row)
    if (delta == null || !Number.isFinite(delta)) continue
    const mz = Math.abs(modifiedZScore(delta, med, mad))
    if (mz > MODIFIED_Z_OUTLIER) out.add(row.key)
  }
  return out
}

export function computeBaselineAnomalies(
  rows: BaselineDeltaRow[],
): Map<string, IssueIndicatorReason[]> {
  const iouOutliers = computeDeltaAnomalyReasons(
    rows,
    (row) => Math.abs(row.current.iou - row.previous.iou),
    'BASELINE_ANOMALY_IOU_DELTA',
  )
  const symOutliers = computeDeltaAnomalyReasons(
    rows,
    (row) => Math.abs(row.current.symmetricDiffPct - row.previous.symmetricDiffPct),
    'BASELINE_ANOMALY_SYMDIFF_DELTA',
  )
  const areaOutliers = computeDeltaAnomalyReasons(
    rows,
    (row) => Math.abs(row.current.areaDiffPct - row.previous.areaDiffPct),
    'BASELINE_ANOMALY_AREA_DELTA',
  )
  const hdNormOutliers = computeDeltaAnomalyReasons(
    rows,
    (row) => {
      const cur = row.current.hausdorffNorm
      const prev = row.previous.hausdorffNorm
      if (!Number.isFinite(cur ?? Number.NaN) || !Number.isFinite(prev ?? Number.NaN)) return null
      return Math.abs((cur ?? 0) - (prev ?? 0))
    },
    'BASELINE_ANOMALY_HAUSDORFF_NORM_DELTA',
  )
  const byKey = new Map<string, IssueIndicatorReason[]>()
  for (const row of rows) {
    const reasons: IssueIndicatorReason[] = []
    if (iouOutliers.has(row.key)) reasons.push('BASELINE_ANOMALY_IOU_DELTA')
    if (symOutliers.has(row.key)) reasons.push('BASELINE_ANOMALY_SYMDIFF_DELTA')
    if (areaOutliers.has(row.key)) reasons.push('BASELINE_ANOMALY_AREA_DELTA')
    if (hdNormOutliers.has(row.key)) reasons.push('BASELINE_ANOMALY_HAUSDORFF_NORM_DELTA')
    if (reasons.length > 0) byKey.set(row.key, reasons)
  }
  return byKey
}
