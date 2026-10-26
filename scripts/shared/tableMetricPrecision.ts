/**
 * Precision of the metrics in `comparison_table.json` (feature shards keep full precision).
 * The baseline anomaly check compares a run with the previous table, so it rounds the current
 * metrics the same way: unchanged geometries then give a delta of exactly 0.
 */
export const TABLE_METRIC_SIGNIFICANT_DIGITS = 4

export function roundTableMetric(value: number): number {
  return Number.isFinite(value) ? Number(value.toPrecision(TABLE_METRIC_SIGNIFICANT_DIGITS)) : value
}

/** Rounds every finite number of a metrics object; other fields (e.g. `issueIndicator`) stay. */
export function roundTableMetrics<T extends object | null | undefined>(metrics: T): T {
  if (!metrics) return metrics
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(metrics)) {
    out[key] = typeof value === 'number' ? roundTableMetric(value) : value
  }
  return out as T
}
