import { de } from '../../i18n/de'
import {
  formatDeIou,
  formatDeMeters,
  formatDeOrDash,
  formatDePercentPoints,
} from '../../lib/formatDe'
import {
  KPI_TIER_INFO_BUTTON_CLASS,
  tierAreaDeltaAbs,
  tierIou,
  tierSymmetricDiffPct,
} from '../../lib/kpiTier'
import type { ReportRow } from '../../types/report'
import { KpiCell, KpiRow, KpiSection } from '../FeatureStatBlocks'
import {
  AreaDeltaInfoButton,
  HausdorffInfoButton,
  IouInfoButton,
  SymDiffInfoButton,
} from '../HausdorffInfoModal'

const diffMetricsKpiRowClassName =
  'mt-0 grid min-w-0 grid-cols-2 gap-x-0 gap-y-4 ' +
  '[&>*]:min-w-0 [&>*]:border-l [&>*]:border-white/15 [&>*]:pl-3 ' +
  'max-md:[&>*:nth-child(2n+1)]:border-l-0 max-md:[&>*:nth-child(2n+1)]:pl-0 ' +
  'md:max-lg:[&>*:nth-child(3n+1)]:border-l-0 md:max-lg:[&>*:nth-child(3n+1)]:pl-0 ' +
  'md:grid-cols-3 ' +
  'lg:flex lg:flex-row lg:flex-nowrap lg:gap-x-0 lg:gap-y-0 ' +
  'lg:[&>*]:min-w-0 lg:[&>*]:flex-1 lg:[&>*]:basis-0 ' +
  'lg:[&>*]:border-l lg:[&>*]:border-white/15 lg:[&>*]:pl-6 ' +
  'lg:[&>*:nth-child(5n+1)]:border-l-0 lg:[&>*:nth-child(5n+1)]:pl-0'

export function FeatureDetailStatsDiffMetricsSection({
  metrics: m,
  metricsCrs,
}: {
  metrics: NonNullable<ReportRow['metrics']>
  metricsCrs: string
}) {
  const s = de.feature.stats

  return (
    <KpiSection className="w-full" aria-label={s.diffMetricsRowAria}>
      <KpiRow narrowLayout="none" className={diffMetricsKpiRowClassName}>
        <KpiCell
          label={
            <span className="inline-flex items-center gap-1">
              <span>{s.iou}</span>
              <IouInfoButton
                bandContext={{ iou: m.iou, metricsCrs }}
                className={KPI_TIER_INFO_BUTTON_CLASS[tierIou(m.iou)]}
              />
            </span>
          }
          value={formatDeIou(m.iou)}
        />
        <KpiCell
          label={
            <span className="inline-flex items-center gap-1">
              <span>{s.areaDelta}</span>
              <AreaDeltaInfoButton
                bandContext={{ areaDiffPct: m.areaDiffPct, metricsCrs }}
                className={KPI_TIER_INFO_BUTTON_CLASS[tierAreaDeltaAbs(Math.abs(m.areaDiffPct))]}
              />
            </span>
          }
          value={formatDePercentPoints(m.areaDiffPct)}
        />
        <KpiCell
          label={
            <span className="inline-flex items-center gap-1">
              <span className="lg:hidden">{s.symDiff}</span>
              <span className="hidden lg:inline">{s.symDiffShort}</span>
              <SymDiffInfoButton
                bandContext={{ symmetricDiffPct: m.symmetricDiffPct, metricsCrs }}
                className={
                  KPI_TIER_INFO_BUTTON_CLASS[tierSymmetricDiffPct(Math.abs(m.symmetricDiffPct))]
                }
              />
            </span>
          }
          value={formatDePercentPoints(m.symmetricDiffPct)}
        />
        <KpiCell
          label={
            <span className="inline-flex items-center gap-1">
              <span>{s.hausdorff}</span>
              <HausdorffInfoButton
                bandContext={{
                  hausdorffM: m.hausdorffM,
                  hausdorffNorm: m.hausdorffNorm,
                  hausdorffP95M: m.hausdorffP95M,
                  metricsCrs,
                }}
              />
            </span>
          }
          value={formatDeOrDash(m.hausdorffM, formatDeMeters)}
        />
        <KpiCell
          label={
            <span className="inline-flex items-center gap-1">
              <span>{s.hausdorffP95}</span>
              <HausdorffInfoButton
                bandContext={{
                  hausdorffP95M: m.hausdorffP95M,
                  hausdorffNorm: m.hausdorffNorm,
                  metricsCrs,
                }}
              />
            </span>
          }
          value={formatDeOrDash(m.hausdorffP95M, formatDeMeters)}
        />
      </KpiRow>
    </KpiSection>
  )
}
