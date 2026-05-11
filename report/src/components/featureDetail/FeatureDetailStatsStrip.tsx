import type { ComparisonForReport, ReportRow } from '../../types/report'
import { FeatureDetailStatsDiffMetricsSection } from './FeatureDetailStatsDiffMetricsSection'
import { FeatureDetailStatsSummarySection } from './FeatureDetailStatsSummarySection'

export function FeatureDetailStatsStrip({
  row,
  data,
}: {
  row: ReportRow
  data: ComparisonForReport
}) {
  const m = row.metrics

  return (
    <div className="flex w-full flex-col">
      <FeatureDetailStatsSummarySection row={row} data={data} />
      {m ? <FeatureDetailStatsDiffMetricsSection metrics={m} /> : null}
    </div>
  )
}
