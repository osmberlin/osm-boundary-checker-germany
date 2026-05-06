import { useId } from 'react'
import { buildResolvedOsmSourceSide } from '../../../../scripts/shared/osmGermanyProvenance.ts'
import { categoryLabelDe, de, issueLevelLabelDe } from '../../i18n/de'
import { isOlderThanDays } from '../../lib/dataAge'
import {
  EM_DASH,
  formatDeIou,
  formatDeMeters,
  formatDeOrDash,
  formatDePercentPoints,
  formatDeSquareKilometersFromM2,
} from '../../lib/formatDe'
import { formatFreshnessDisplayDe } from '../../lib/formatSourceDownloadedAt'
import { officialAreaSummaryFreshness } from '../../lib/officialAreaSummaryFreshness'
import { sourceStatLines } from '../../lib/reportFreshnessLines'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { KpiCell, KpiRow, KpiSection, KpiToggleCell } from '../FeatureStatBlocks'
import {
  AreaDeltaInfoButton,
  HausdorffInfoButton,
  IouInfoButton,
  IssueIndicatorInfoButton,
  SymDiffInfoButton,
} from '../HausdorffInfoModal'
import { mapLayerColors } from '../mapLayerColors'
import { hexToRgba } from '../MapLegend'

type MapLayerControls = {
  showOfficial: boolean
  setShowOfficial: (v: boolean) => void
  showOsm: boolean
  setShowOsm: (v: boolean) => void
  showDiff: boolean
  setShowDiff: (v: boolean) => void
}

function symmetricDiffAreaM2(m: NonNullable<ReportRow['metrics']>): number {
  return m.officialAreaM2 * (m.symmetricDiffPct / 100)
}

function isNonMatchedCategory(c: ReportRow['category']): c is 'official_only' | 'unmatched_osm' {
  return c === 'official_only' || c === 'unmatched_osm'
}

export function FeatureDetailStatsStrip({
  row,
  mapLayers,
  data,
}: {
  row: ReportRow
  mapLayers: MapLayerControls
  data: ComparisonForReport
}) {
  const m = row.metrics
  const s = de.feature.stats
  const layerId = useId()
  const o = mapLayerColors.official
  const osmC = mapLayerColors.osm
  const d = mapLayerColors.diff
  const reportFresh = formatFreshnessDisplayDe(data.generatedAt.trim())
  const officialSide = data.sourceMetadata?.official
  const osmResolved = buildResolvedOsmSourceSide(data.sourceMetadata?.osm)
  const osmRaw = osmResolved.downloadedAt
  const officialFresh = officialAreaSummaryFreshness(officialSide)
  const officialSecondaryLine = officialFresh.detailLine
  const osmFresh = sourceStatLines(osmRaw, true)
  const reportIsOld = isOlderThanDays(data.generatedAt, 5)
  const officialIsOld = officialFresh.isOld
  const osmCheckRawForRose =
    osmResolved.sourceDateSource === 'osm_pbf_header'
      ? osmResolved.extractedAt?.trim() || osmRaw
      : osmRaw
  const osmIsOld = isOlderThanDays(osmCheckRawForRose, 5)
  const titlePrefix = data.titlePrefix

  return (
    <>
      <div className="mb-6 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-slate-100">
          {`${titlePrefix} ${row.nameLabel}`.trim()}
        </h1>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-slate-500 sm:justify-end">
          <span>{categoryLabelDe(row.category)}</span>
          {row.osmRelationId && (
            <>
              <span className="text-slate-600" aria-hidden>
                ·
              </span>
              <a
                className="text-slate-400 underline decoration-slate-500/60 underline-offset-2 hover:text-slate-300"
                href={`https://www.openstreetmap.org/relation/${row.osmRelationId}`}
                target="_blank"
                rel="noreferrer"
              >
                {de.feature.osmRelation} {row.osmRelationId}
              </a>
            </>
          )}
        </div>
      </div>

      <section className="mb-6" aria-label={de.areaReport.stats.summaryStatRowAria}>
        <KpiRow
          narrowLayout="none"
          className={
            'mt-0 grid min-w-0 grid-cols-2 gap-x-0 gap-y-4 ' +
            '[&>*]:min-w-0 [&>*]:border-l [&>*]:border-white/15 [&>*]:pl-3 ' +
            /* 2 columns: row starts 1,3 */
            'max-md:[&>*:nth-child(2n+1)]:border-l-0 max-md:[&>*:nth-child(2n+1)]:pl-0 ' +
            /* 4 columns (desktop): row starts 1 */
            'md:grid-cols-4 md:gap-y-0 md:[&>*]:pl-6 md:[&>*:nth-child(4n+1)]:border-l-0 md:[&>*:nth-child(4n+1)]:pl-0'
          }
        >
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
            absoluteLine={officialFresh.absoluteLine || EM_DASH}
            detailLine={officialSecondaryLine}
            isOld={officialIsOld}
          />
          <SummaryStatColumn
            heading={de.areaReport.freshnessHeadingOsm}
            relativeLine={osmFresh.relativeLine}
            absoluteLine={osmFresh.absoluteLine}
            isOld={osmIsOld}
          />
        </KpiRow>
      </section>

      {m && (
        <>
          <KpiRow
            narrowLayout="none"
            className={
              'mt-0 grid min-w-0 grid-cols-2 gap-x-0 gap-y-4 ' +
              '[&>*]:min-w-0 [&>*]:border-l [&>*]:border-white/15 [&>*]:pl-3 ' +
              /* 2 columns: row starts 1,3,5 */
              'max-md:[&>*:nth-child(2n+1)]:border-l-0 max-md:[&>*:nth-child(2n+1)]:pl-0 ' +
              /* 3 columns (md–lg): row starts 1,4 */
              'md:max-lg:[&>*:nth-child(3n+1)]:border-l-0 md:max-lg:[&>*:nth-child(3n+1)]:pl-0 ' +
              'md:grid-cols-3 ' +
              /* 1 row × 5 flex cells: only first has no left border */
              'lg:flex lg:flex-row lg:flex-nowrap lg:gap-x-0 lg:gap-y-0 ' +
              'lg:[&>*]:min-w-0 lg:[&>*]:flex-1 lg:[&>*]:basis-0 ' +
              'lg:[&>*]:border-l lg:[&>*]:border-white/15 lg:[&>*]:pl-6 ' +
              'lg:[&>*:nth-child(5n+1)]:border-l-0 lg:[&>*:nth-child(5n+1)]:pl-0'
            }
            aria-label={s.diffMetricsRowAria}
          >
            <KpiCell
              label={
                <span className="inline-flex items-center gap-1">
                  <span>{s.iou}</span>
                  <IouInfoButton />
                </span>
              }
              value={formatDeIou(m.iou)}
            />
            <KpiCell
              label={
                <span className="inline-flex items-center gap-1">
                  <span>{s.areaDelta}</span>
                  <AreaDeltaInfoButton />
                </span>
              }
              value={formatDePercentPoints(m.areaDiffPct)}
            />
            <KpiCell
              label={
                <span className="inline-flex items-center gap-1">
                  <span className="lg:hidden">{s.symDiff}</span>
                  <span className="hidden lg:inline">{s.symDiffShort}</span>
                  <SymDiffInfoButton />
                </span>
              }
              value={formatDePercentPoints(m.symmetricDiffPct)}
            />
            <KpiCell
              label={
                <span className="inline-flex items-center gap-1">
                  <span>{s.hausdorff}</span>
                  <HausdorffInfoButton />
                </span>
              }
              value={formatDeOrDash(m.hausdorffM, formatDeMeters)}
            />
            <KpiCell
              label={
                <span className="inline-flex items-center gap-1">
                  <span>{s.hausdorffP95}</span>
                  <HausdorffInfoButton />
                </span>
              }
              value={formatDeOrDash(m.hausdorffP95M, formatDeMeters)}
            />
          </KpiRow>

          <KpiSection className="mt-6" aria-label={s.layersRowAria}>
            <KpiRow className="mt-0">
              <KpiToggleCell
                inputId={`${layerId}-official`}
                checked={mapLayers.showOfficial}
                onChange={mapLayers.setShowOfficial}
                label={s.areaOfficial}
                value={formatDeSquareKilometersFromM2(m.officialAreaM2)}
                swatch={
                  <div
                    className="h-full w-full shrink-0 rounded-[2px] border border-solid"
                    style={{
                      borderColor: o.line,
                      backgroundColor: hexToRgba(o.fill, o.fillOpacity),
                    }}
                    aria-hidden
                  />
                }
              />
              <KpiToggleCell
                inputId={`${layerId}-osm`}
                checked={mapLayers.showOsm}
                onChange={mapLayers.setShowOsm}
                label={s.areaOsm}
                value={formatDeSquareKilometersFromM2(m.osmAreaM2)}
                swatch={
                  <div
                    className="h-full w-full shrink-0 rounded-[2px] border border-solid"
                    style={{
                      borderColor: osmC.line,
                      backgroundColor: hexToRgba(osmC.fill, osmC.fillOpacity),
                    }}
                    aria-hidden
                  />
                }
              />
              <KpiToggleCell
                inputId={`${layerId}-diff`}
                checked={mapLayers.showDiff}
                onChange={mapLayers.setShowDiff}
                label={de.map.diff}
                value={formatDeSquareKilometersFromM2(symmetricDiffAreaM2(m))}
                swatch={
                  <div
                    className="h-full w-full shrink-0 rounded-[2px] border border-solid border-slate-500"
                    style={{
                      background: `linear-gradient(90deg, ${hexToRgba(d.official.fill, d.official.fillOpacity)} 50%, ${hexToRgba(d.osm.fill, d.osm.fillOpacity)} 50%)`,
                    }}
                    aria-hidden
                  />
                }
              />
            </KpiRow>
          </KpiSection>
        </>
      )}
    </>
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
      : level === 'review'
        ? 'text-amber-200'
        : level === 'issue'
          ? 'text-rose-300'
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

function SummaryStatColumn({
  heading,
  relativeLine,
  absoluteLine,
  detailLine,
  isOld = false,
}: {
  heading: string
  relativeLine: string
  absoluteLine: string
  detailLine?: string | null
  isOld?: boolean
}) {
  const compactRelativeLine = relativeLine.replace(/\bStunden?\b/g, 'Std.')
  const mobileAbsoluteLine = toNumericMonthAbsoluteDe(absoluteLine)

  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <dt className="text-sm font-medium text-slate-400">{heading}</dt>
      <dd
        className={`m-0 text-2xl font-semibold tracking-tight text-pretty tabular-nums sm:text-3xl ${isOld ? 'text-rose-300' : 'text-slate-400'}`}
      >
        <span className="sm:hidden">{compactRelativeLine}</span>
        <span className="hidden sm:inline">{compactRelativeLine}</span>
      </dd>
      <dd className={`m-0 text-sm ${isOld ? 'text-rose-300' : 'text-slate-400'}`}>
        <span className="sm:hidden">{mobileAbsoluteLine}</span>
        <span className="hidden sm:inline">{absoluteLine}</span>
      </dd>
      {detailLine ? <dd className="m-0 text-xs text-slate-500">{detailLine}</dd> : null}
    </div>
  )
}

function toNumericMonthAbsoluteDe(value: string): string {
  const monthByName: Record<string, string> = {
    Januar: '01',
    Februar: '02',
    März: '03',
    April: '04',
    Mai: '05',
    Juni: '06',
    Juli: '07',
    August: '08',
    September: '09',
    Oktober: '10',
    November: '11',
    Dezember: '12',
  }
  const m = value.match(/^(\d{1,2})\.\s+([A-Za-zÄÖÜäöüß]+)\s+(\d{4})\s+(\d{2}:\d{2})$/)
  if (!m) return value
  const day = m[1]?.padStart(2, '0')
  const monthName = m[2]
  const year = m[3]
  const time = m[4]
  const month = monthName ? monthByName[monthName] : null
  if (!day || !month || !year || !time) return value
  return `${day}.${month}.${year} ${time}`
}
