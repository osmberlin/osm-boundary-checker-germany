import { buildResolvedOsmSourceSide } from '../../../../scripts/shared/osmGermanyProvenance.ts'
import { categoryLabelDe, de, issueLevelLabelDe } from '../../i18n/de'
import { isOlderThanDays } from '../../lib/dataAge'
import { EM_DASH } from '../../lib/formatDe'
import { reviewIssueAmpelTextClasses } from '../../lib/issueAmpelStyles'
import { officialAreaSummaryFreshness } from '../../lib/officialAreaSummaryFreshness'
import { kpiFreshnessLinesFromIso } from '../../lib/reportFreshnessLines'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { KpiRow } from '../FeatureStatBlocks'
import { IssueIndicatorInfoButton } from '../HausdorffInfoModal'
import { OfficialDatasetAgeInfoButton } from '../OfficialDatasetAgeInfoModal'
import { SummaryStatColumn } from '../SummaryStatColumn'

const summaryKpiRowClassName =
  'mt-0 grid min-w-0 grid-cols-2 gap-x-0 gap-y-4 ' +
  '[&>*]:min-w-0 [&>*]:border-l [&>*]:border-white/15 [&>*]:pl-3 ' +
  'max-md:[&>*:nth-child(2n+1)]:border-l-0 max-md:[&>*:nth-child(2n+1)]:pl-0 ' +
  'md:grid-cols-4 md:gap-y-0 md:[&>*]:pl-6 md:[&>*:nth-child(4n+1)]:border-l-0 md:[&>*:nth-child(4n+1)]:pl-0'

function isNonMatchedCategory(c: ReportRow['category']): c is 'official_only' | 'unmatched_osm' {
  return c === 'official_only' || c === 'unmatched_osm'
}

export function FeatureDetailStatsSummarySection({
  row,
  data,
}: {
  row: ReportRow
  data: ComparisonForReport
}) {
  const m = row.metrics
  const s = de.feature.stats
  const reportFresh = kpiFreshnessLinesFromIso(data.generatedAt)
  const officialSide = data.sourceMetadata?.official
  const osmResolved = buildResolvedOsmSourceSide(data.sourceMetadata?.osm)
  const osmRaw = osmResolved.downloadedAt
  const officialFresh = officialAreaSummaryFreshness(officialSide)
  const osmFresh = kpiFreshnessLinesFromIso(osmRaw)
  const reportIsOld = isOlderThanDays(data.generatedAt, 5)
  const officialIsOld = officialFresh.isOld
  const osmCheckRawForRose =
    osmResolved.sourceDateSource === 'osm_pbf_header'
      ? osmResolved.extractedAt?.trim() || osmRaw
      : osmRaw
  const osmIsOld = isOlderThanDays(osmCheckRawForRose, 5)

  return (
    <section className="mb-6" aria-label={de.areaReport.stats.summaryStatRowAria}>
      <KpiRow narrowLayout="none" className={summaryKpiRowClassName}>
        {m ? (
          <IssueIndicatorStatColumn
            label={s.issueIndicator}
            level={m.issueIndicator?.level}
            reasons={m.issueIndicator?.reasons}
          />
        ) : isNonMatchedCategory(row.category) ? (
          <NoMatchCategoryStatColumn label={s.unmatchedCompareLabel} category={row.category} />
        ) : null}
        <SummaryStatColumn
          heading={de.areaReport.freshnessHeadingReport}
          relativeLine={reportFresh.relativeLine ?? EM_DASH}
          absoluteLine={reportFresh.absoluteLine || EM_DASH}
          isOld={reportIsOld}
        />
        <SummaryStatColumn
          heading={de.areaReport.freshnessHeadingOfficial}
          relativeLine={officialFresh.relativeLine ?? EM_DASH}
          absoluteLine={officialFresh.pairedAbsoluteLine}
          isOld={officialIsOld}
          headingAdornment={<OfficialDatasetAgeInfoButton side={officialSide} />}
          hideDetailLine
        />
        <SummaryStatColumn
          heading={de.areaReport.freshnessHeadingOsm}
          relativeLine={osmFresh.relativeLine}
          absoluteLine={osmFresh.absoluteLine}
          isOld={osmIsOld}
        />
      </KpiRow>
    </section>
  )
}

function issueReasonLabelDe(
  reason:
    | 'STRONG_OVERLAP_LOW_DIFF'
    | 'BOUNDARY_OUTLIER_BUT_OVERLAP_STABLE'
    | 'LOW_IOU_HIGH_SYM_DIFF'
    | 'HIGH_AREA_DELTA'
    | 'BASELINE_ANOMALY_IOU_DELTA'
    | 'BASELINE_ANOMALY_SYMDIFF_DELTA'
    | 'BASELINE_ANOMALY_AREA_DELTA'
    | 'BASELINE_ANOMALY_HAUSDORFF_NORM_DELTA',
): string {
  switch (reason) {
    case 'STRONG_OVERLAP_LOW_DIFF':
      return 'starke Ueberlappung bei kleiner Flaechendifferenz'
    case 'BOUNDARY_OUTLIER_BUT_OVERLAP_STABLE':
      return 'hohe Randabweichung, aber stabile Ueberlappung'
    case 'LOW_IOU_HIGH_SYM_DIFF':
      return 'niedrige IoU mit hoher symmetrischer Differenz'
    case 'HIGH_AREA_DELTA':
      return 'hohe Flaechenabweichung'
    case 'BASELINE_ANOMALY_IOU_DELTA':
      return 'ungewoehnlicher IoU-Sprung ggü. letztem Lauf'
    case 'BASELINE_ANOMALY_SYMDIFF_DELTA':
      return 'ungewoehnlicher SymDiff-Sprung ggü. letztem Lauf'
    case 'BASELINE_ANOMALY_AREA_DELTA':
      return 'ungewoehnlicher Flaechen-Sprung ggü. letztem Lauf'
    case 'BASELINE_ANOMALY_HAUSDORFF_NORM_DELTA':
      return 'ungewoehnlicher Hausdorff-Norm-Sprung ggü. letztem Lauf'
  }
}

type IssueReasonCode = Parameters<typeof issueReasonLabelDe>[0]

function NoMatchCategoryStatColumn({
  label,
  category,
}: {
  label: string
  category: 'official_only' | 'unmatched_osm'
}) {
  const primaryText = categoryLabelDe(category)
  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <dt className="text-sm font-medium text-slate-400">{label}</dt>
      <dd className="m-0 text-2xl font-semibold tracking-tight text-pretty text-rose-300 tabular-nums sm:text-3xl">
        {primaryText}
      </dd>
    </div>
  )
}

function IssueIndicatorStatColumn({
  label,
  level,
  reasons,
}: {
  label: string
  level: 'ok' | 'review' | 'issue' | undefined
  reasons: IssueReasonCode[] | undefined
}) {
  const primaryClass =
    level === 'ok'
      ? 'text-emerald-200'
      : level === 'review' || level === 'issue'
        ? reviewIssueAmpelTextClasses
        : 'text-slate-400'
  const primaryText = level ? issueLevelLabelDe(level) : EM_DASH
  const reasonsLine = reasons?.length
    ? capitalizeFirstDe(reasons.map(issueReasonLabelDe).join(' · '))
    : null

  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <dt className="text-sm font-medium text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span>{label}</span>
          <IssueIndicatorInfoButton />
        </span>
      </dt>
      <dd
        className={`m-0 text-2xl font-semibold tracking-tight text-pretty tabular-nums sm:text-3xl ${primaryClass}`}
      >
        <span className="sm:hidden">{primaryText}</span>
        <span className="hidden sm:inline">{primaryText}</span>
      </dd>
      {reasonsLine ? (
        <dd className="m-0 text-sm text-slate-400">
          <span className="sm:hidden">{reasonsLine}</span>
          <span className="hidden sm:inline">{reasonsLine}</span>
        </dd>
      ) : null}
    </div>
  )
}

function capitalizeFirstDe(value: string): string {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1)
}
