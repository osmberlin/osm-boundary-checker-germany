/**
 * Unweighted mean IoU over rows that have non-null metrics (area-report chart / snapshots).
 */
export function computeMeanIou(rows: readonly { metrics: { iou: number } | null }[]): number {
  const withMetrics = rows.filter((r) => r.metrics != null)
  if (withMetrics.length === 0) return 0
  return withMetrics.reduce((sum, r) => sum + (r.metrics?.iou ?? 0), 0) / withMetrics.length
}
