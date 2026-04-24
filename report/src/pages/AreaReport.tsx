import { computeMeanIou } from '@compare-metrics/mean-iou/compute.ts'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import {
  lazy,
  type CSSProperties,
  type ReactNode,
  Suspense,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { LayerToggleStatBlock, StatBlocksRow } from '../components/FeatureStatBlocks'
import {
  AreaDeltaInfoButton,
  HausdorffInfoButton,
  IouInfoButton,
  MeanIouInfoButton,
} from '../components/HausdorffInfoModal'
import { ReportCategoryPill, ReportCategorySquareSwatch } from '../components/reportCategoryStyles'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { areasIndex } from '../data/areasIndex'
import { comparisonQueryOptions, snapshotsQueryOptions } from '../data/load'
import { comparisonPmtilesMaplibreUrl, comparisonUnmatchedPmtilesMaplibreUrl } from '../data/paths'
import { useAreaReportCategoryFilter } from '../hooks/useAreaReportCategoryFilter'
import { type AreaTableSortKey, useAreaReportTableSort } from '../hooks/useAreaReportTableSort'
import { useComparisonMapLayers } from '../hooks/useComparisonMapLayers'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { categoryLabelDe, de } from '../i18n/de'
import {
  EM_DASH,
  formatDeFixed,
  formatDeInteger,
  formatDeIou,
  formatDeMeters,
  formatDeOrDash,
  formatDePercentPoints,
} from '../lib/formatDe'
import { formatFreshnessDisplayDe } from '../lib/formatSourceDownloadedAt'
import { optionalSourceStatLines, sourceStatLines } from '../lib/reportFreshnessLines'
import { selectSourceDateForFreshness } from '../lib/sourceFreshnessSelection'
import type { AreaReportRow, ComparisonForReport, SnapshotsJson } from '../types/report'

const ComparisonMapShell = lazy(() => import('../components/map/ComparisonMapShell'))

function unionMapBboxes(rows: AreaReportRow[]): [number, number, number, number] | null {
  const boxes = rows
    .map((r) => r.mapBbox)
    .filter((b): b is [number, number, number, number] => b != null)
  if (boxes.length === 0) return null
  const first = boxes[0]
  if (!first) return null
  let w = first[0]
  let s = first[1]
  let e = first[2]
  let n = first[3]
  for (let i = 1; i < boxes.length; i++) {
    const b = boxes[i]
    if (!b) continue
    w = Math.min(w, b[0])
    s = Math.min(s, b[1])
    e = Math.max(e, b[2])
    n = Math.max(n, b[3])
  }
  if (!(w < e && s < n)) return null
  return [w, s, e, n]
}

function normalizeUnmatchedRows(data: ComparisonForReport): AreaReportRow[] {
  return data.unmatchedOsm.map((row) => ({
    canonicalMatchKey: row.canonicalMatchKey,
    nameLabel: row.nameLabel,
    category: 'unmatched_osm',
    osmRelationId: row.osmRelationId,
    metrics: null,
    mapBbox: row.mapBbox,
    officialForEditPath: null,
    officialProperties: null,
    osmProperties: null,
  }))
}

export function AreaReport() {
  const { areaId } = useParams({ strict: false })
  const areaKey = areaId ?? ''
  const navigate = useNavigate()
  const statsInputId = useId()
  const { enabledSet, enabledCategories, setCategoryEnabled, isCategoryEnabled } =
    useAreaReportCategoryFilter()
  const mapLayers = useComparisonMapLayers()
  const mapViewParam = useMapViewParam()
  const { ref: chartRef, size: chartSize } = useMeasuredElementSize<HTMLDivElement>()
  const comparisonQuery = useQuery({
    ...comparisonQueryOptions(areaKey),
    enabled: areaId != null,
  })
  const snapshotsQuery = useQuery({
    ...snapshotsQueryOptions(areaKey),
    enabled: areaId != null,
  })
  const data: ComparisonForReport | null = comparisonQuery.data ?? null
  const snapIndex: SnapshotsJson | null = snapshotsQuery.data ?? null
  const areaDisplayName =
    areasIndex.summaries.find((summary) => summary.area === areaKey)?.displayName ??
    data?.area ??
    areaKey
  const pageSourceHref = data?.sourceMetadata?.official?.sourceUrl?.trim() || null
  const pageSourceName = formatHeadlineSourceLabel(
    pageSourceHref,
    data?.sourceMetadata?.official?.layer?.trim() || null,
    data?.sourceMetadata?.official?.dataset?.trim() || null,
  )

  /** Main table rows from comparison payload. */
  const mainRows =
    data?.rows.filter((r) => r.category === 'matched' || r.category === 'official_only') ?? []
  const unmatchedRows = data ? normalizeUnmatchedRows(data) : []
  const visibleMainRows = mainRows.filter((r) => enabledCategories.includes(r.category))
  const visibleUnmatchedRows = unmatchedRows.filter((r) => enabledCategories.includes(r.category))
  const visibleRows = [...visibleMainRows, ...visibleUnmatchedRows]

  const { sortedRows, sortBy, sortDir, setColumn } = useAreaReportTableSort(visibleRows)

  const catCounts = {
    matched: mainRows.filter((r) => r.category === 'matched').length,
    official_only: mainRows.filter((r) => r.category === 'official_only').length,
    unmatched_osm: unmatchedRows.length,
  }

  const allMainOn = enabledSet.has('matched') && enabledSet.has('official_only')
  const mapAllowlist = !data || allMainOn ? null : visibleMainRows.map((r) => r.canonicalMatchKey)
  const unmatchedMapAllowlist = !data || enabledSet.has('unmatched_osm') ? null : []
  const overviewMapBbox = unionMapBboxes(visibleRows)

  const chartData = !data
    ? []
    : (() => {
        const fromSnapshots =
          snapIndex?.runs
            .map((r) => ({
              id: r.id,
              meanIou: r.summary.meanIou,
            }))
            .filter((run) => Number.isFinite(run.meanIou)) ?? []
        if (fromSnapshots.length > 0) return fromSnapshots
        return [{ id: 'current', meanIou: computeMeanIou(data.rows) }]
      })()
  const chartIsReady = chartSize.width > 0 && chartSize.height > 0

  if (comparisonQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
        {areaDisplayName ? (
          <AreaHeadlineRow
            title={areaDisplayName}
            sourceName={pageSourceName}
            sourceHref={pageSourceHref}
          />
        ) : null}
        <div className="text-red-400">
          {String(comparisonQuery.error)}
          <p className="mt-2 text-sm text-slate-400">
            {de.areaReport.errorRunCompare}{' '}
            <code className="rounded bg-slate-800 px-1 text-slate-200">bun run compare</code>{' '}
            {de.areaReport.errorRunCompareExists}
          </p>
        </div>
      </div>
    )
  }
  if (comparisonQuery.isPending || !data) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
        {areaDisplayName ? (
          <AreaHeadlineRow
            title={areaDisplayName}
            sourceName={pageSourceName}
            sourceHref={pageSourceHref}
          />
        ) : null}
        <p className="text-slate-400">{de.areaReport.loading}</p>
      </div>
    )
  }

  const chartTick = '#d4d4d8'
  const chartAxisLine = '#71717a'
  const chartGrid = '#3f3f46'
  const tooltipStyles = {
    backgroundColor: 'rgb(39 39 42)',
    border: '1px solid rgb(63 63 70)',
    borderRadius: '6px',
    color: 'rgb(244 244 245)',
  }

  const st = de.areaReport.stats
  const reportFresh = formatFreshnessDisplayDe(data.generatedAt.trim())
  const officialRaw = data.sourceMetadata?.official?.downloadedAt
  const osmRaw = data.sourceMetadata?.osm?.downloadedAt
  const hasOfficialMetadata = data.sourceMetadata?.official != null
  const officialDateChoice = selectSourceDateForFreshness(data.sourceMetadata?.official)
  const officialUpdatedFresh = optionalSourceStatLines(officialDateChoice.primaryRaw)
  const officialDownloadedFresh = sourceStatLines(officialRaw, hasOfficialMetadata)
  const officialFresh = officialUpdatedFresh ?? officialDownloadedFresh
  const officialSecondaryLine =
    officialDateChoice.secondaryDownloadedRaw && hasOfficialMetadata
      ? `${de.areaReport.freshnessSecondaryDownloadedPrefix}: ${officialDownloadedFresh.absoluteLine}`
      : null
  const osmFresh = sourceStatLines(osmRaw, data.sourceMetadata?.osm != null)
  const iouMax = maxFiniteValue(sortedRows.map((row) => row.metrics?.iou))
  const areaDiffAbsMax = maxFiniteValue(
    sortedRows.map((row) => absOrNull(row.metrics?.areaDiffPct)),
  )
  const hausdorffMax = maxFiniteValue(sortedRows.map((row) => row.metrics?.hausdorffM))

  return (
    <div className="mx-auto max-w-5xl px-4 py-4 text-left sm:px-6 lg:px-8">
      {areaDisplayName ? (
        <AreaHeadlineRow
          title={areaDisplayName}
          sourceName={pageSourceName}
          sourceHref={pageSourceHref}
        />
      ) : null}
      <section className="mb-6" aria-label={st.summaryStatRowAria}>
        <StatBlocksRow className="mt-0">
          <SummaryStatColumn
            heading={de.areaReport.freshnessHeadingReport}
            relativeLine={reportFresh.relativeLine ?? EM_DASH}
            absoluteLine={reportFresh.absoluteLine || EM_DASH}
          />
          <SummaryStatColumn
            heading={de.areaReport.freshnessHeadingOfficial}
            relativeLine={officialFresh.relativeLine}
            absoluteLine={officialFresh.absoluteLine}
            detailLine={officialSecondaryLine}
          />
          <SummaryStatColumn
            heading={de.areaReport.freshnessHeadingOsm}
            relativeLine={osmFresh.relativeLine}
            absoluteLine={osmFresh.absoluteLine}
          />
        </StatBlocksRow>
      </section>

      <section
        className="mb-6 rounded border border-slate-700 bg-slate-900 p-4"
        aria-label={st.summaryLegendRowAria}
      >
        <StatBlocksRow className="mt-0">
          <LayerToggleStatBlock
            inputId={`${statsInputId}-matched`}
            checked={catCounts.matched === 0 ? false : isCategoryEnabled('matched')}
            disabled={catCounts.matched === 0}
            onChange={(on) => setCategoryEnabled('matched', on)}
            label={categoryLabelDe('matched')}
            value={formatDeInteger(catCounts.matched)}
            swatch={<ReportCategorySquareSwatch category="matched" />}
          />
          <LayerToggleStatBlock
            inputId={`${statsInputId}-official`}
            checked={catCounts.official_only === 0 ? false : isCategoryEnabled('official_only')}
            disabled={catCounts.official_only === 0}
            onChange={(on) => setCategoryEnabled('official_only', on)}
            label={categoryLabelDe('official_only')}
            value={formatDeInteger(catCounts.official_only)}
            swatch={<ReportCategorySquareSwatch category="official_only" />}
          />
          <LayerToggleStatBlock
            inputId={`${statsInputId}-unmatched`}
            checked={catCounts.unmatched_osm === 0 ? false : isCategoryEnabled('unmatched_osm')}
            disabled={catCounts.unmatched_osm === 0}
            onChange={(on) => setCategoryEnabled('unmatched_osm', on)}
            label={categoryLabelDe('unmatched_osm')}
            value={formatDeInteger(catCounts.unmatched_osm)}
            swatch={<ReportCategorySquareSwatch category="unmatched_osm" />}
          />
        </StatBlocksRow>
      </section>

      <div className="mb-8">
        <div className="w-full overflow-hidden rounded border border-slate-700">
          <div className="h-[420px] w-full">
            {visibleRows.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                {st.mapNoVisibleCategories}
              </div>
            ) : data.hasPmtiles ? (
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-slate-500">
                    {st.mapLoading}
                  </div>
                }
              >
                <MapProvider>
                  <ComparisonMapShell
                    sources={{
                      primary: {
                        pmtilesUrl: comparisonPmtilesMaplibreUrl(areaKey),
                        sourceLayer: data.tippecanoeLayer,
                        allowedFeatureIds: mapAllowlist,
                      },
                      unmatched: data.hasUnmatchedPmtiles
                        ? {
                            pmtilesUrl: comparisonUnmatchedPmtilesMaplibreUrl(areaKey),
                            sourceLayer: data.tippecanoeLayer,
                            allowedFeatureIds: unmatchedMapAllowlist,
                            visible: enabledSet.has('unmatched_osm') && mapLayers.showOsm,
                          }
                        : undefined,
                    }}
                    view={{
                      featureId: null,
                      mapBbox: overviewMapBbox,
                      urlMapView: mapViewParam.mapView,
                      onMoveEndCommitUrl: mapViewParam.commitMapViewFromMap,
                    }}
                    layers={{
                      showOfficial: mapLayers.showOfficial,
                      showOsm: mapLayers.showOsm,
                      showDiff: mapLayers.showDiff,
                    }}
                    interaction={{
                      onFeatureClick: (featureKey) => {
                        void navigate({
                          to: '/$areaId/feature/$featureKey',
                          params: { areaId: areaKey, featureKey },
                        })
                      },
                    }}
                  />
                </MapProvider>
              </Suspense>
            ) : (
              <div className="flex h-full items-center justify-center p-4">
                <div className="max-w-xl rounded border border-slate-700 bg-slate-900/50 p-4 text-sm text-slate-300">
                  {de.feature.noPmtiles}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-8 flex h-64 min-w-0 flex-col rounded border border-slate-700 bg-slate-900 p-2">
        <h2 className="mb-2 flex flex-wrap items-center gap-1 text-sm font-medium text-slate-300">
          <span>{de.areaReport.chartTitle}</span>
          <MeanIouInfoButton className="-ml-0.5" iconClassName="size-[0.95rem]" />
        </h2>
        <div ref={chartRef} className="min-h-0 min-w-0 flex-1">
          {chartIsReady ? (
            <LineChart
              width={chartSize.width}
              height={chartSize.height}
              data={chartData}
              margin={{ left: 8, right: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
              <XAxis dataKey="id" tick={{ fontSize: 11, fill: chartTick }} stroke={chartAxisLine} />
              <YAxis
                domain={[0, 1]}
                tick={{ fontSize: 11, fill: chartTick }}
                stroke={chartAxisLine}
                tickFormatter={(v) => formatDeFixed(v, 2)}
              />
              <Tooltip
                contentStyle={tooltipStyles}
                formatter={(value) => [
                  formatDeIou(Number(value ?? 0)),
                  de.areaReport.chartTooltipIou,
                ]}
              />
              <Line type="monotone" dataKey="meanIou" stroke="#7c3aed" dot />
            </LineChart>
          ) : (
            <div className="h-full w-full" aria-hidden />
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded border border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900">
            <tr>
              <SortableTh
                column="name"
                label={de.areaReport.table.name}
                align="left"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setColumn}
              />
              <SortableTh
                column="key"
                label={de.areaReport.table.key}
                align="left"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setColumn}
              />
              <SortableTh
                column="category"
                label={de.areaReport.table.category}
                align="left"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setColumn}
              />
              <SortableTh
                column="iou"
                label={de.areaReport.table.iou}
                align="right"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setColumn}
                labelEnd={<IouInfoButton className="-mr-0.5" iconClassName="size-[0.95rem]" />}
              />
              <SortableTh
                column="area"
                label={de.areaReport.table.areaDelta}
                align="right"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setColumn}
                labelEnd={
                  <AreaDeltaInfoButton className="-mr-0.5" iconClassName="size-[0.95rem]" />
                }
              />
              <SortableTh
                column="haus"
                label={de.areaReport.table.hausdorff}
                align="right"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={setColumn}
                labelEnd={
                  <HausdorffInfoButton className="-mr-0.5" iconClassName="size-[0.95rem]" />
                }
              />
              <th className="px-3 py-2 text-left text-slate-100">{de.areaReport.table.map}</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr key={row.canonicalMatchKey} className="border-t border-slate-800">
                <td className="px-3 py-2 text-slate-100">{row.nameLabel}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-100">
                  {row.canonicalMatchKey}
                </td>
                <td className="px-3 py-2">
                  <ReportCategoryPill category={row.category}>
                    {categoryLabelDe(row.category)}
                  </ReportCategoryPill>
                </td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">
                  <MetricCellBar
                    ratio={normalizedRatio(row.metrics?.iou, iouMax)}
                    value={row.metrics ? formatDeIou(row.metrics.iou) : EM_DASH}
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">
                  <MetricCellBar
                    ratio={normalizedRatio(absOrNull(row.metrics?.areaDiffPct), areaDiffAbsMax)}
                    value={row.metrics ? formatDePercentPoints(row.metrics.areaDiffPct) : EM_DASH}
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">
                  <MetricCellBar
                    ratio={normalizedRatio(row.metrics?.hausdorffM, hausdorffMax)}
                    value={
                      row.metrics ? formatDeOrDash(row.metrics.hausdorffM, formatDeMeters) : EM_DASH
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Link
                    className="text-sky-400 underline"
                    to="/$areaId/feature/$featureKey"
                    params={{
                      areaId: areaKey,
                      featureKey: row.canonicalMatchKey,
                    }}
                  >
                    {de.areaReport.table.view}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReportDataProvenanceFooter data={data} />
    </div>
  )
}

function MetricCellBar({ ratio, value }: { ratio: number | null; value: string }) {
  return (
    <div className="relative overflow-hidden rounded-sm px-1" style={metricBarStyle(ratio)}>
      <span className="relative z-10">{value}</span>
    </div>
  )
}

function metricBarStyle(ratio: number | null): CSSProperties | undefined {
  if (ratio === null) return undefined
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 10
  if (pct <= 0) return undefined
  const stop = `${pct}%`
  return {
    backgroundImage: `linear-gradient(90deg, rgba(14, 116, 144, 0.35) 0%, rgba(14, 116, 144, 0.35) ${stop}, transparent ${stop}, transparent 100%)`,
  }
}

function normalizedRatio(value: number | null | undefined, max: number): number | null {
  if (value == null) return null
  if (!Number.isFinite(value)) return null
  if (!(max > 0)) return null
  return value / max
}

function maxFiniteValue(values: Array<number | null | undefined>): number {
  let max = 0
  for (const value of values) {
    if (value == null) continue
    if (!Number.isFinite(value)) continue
    if (value > max) max = value
  }
  return max
}

function absOrNull(value: number | null | undefined): number | null {
  if (value == null) return null
  return Number.isFinite(value) ? Math.abs(value) : null
}

/** Row 1: heading, relative age (large), absolute datetime (small). */
function SummaryStatColumn({
  heading,
  relativeLine,
  absoluteLine,
  detailLine,
}: {
  heading: string
  relativeLine: string
  absoluteLine: string
  detailLine?: string | null
}) {
  const compactRelativeLine = relativeLine.replace(/\bStunden?\b/g, 'Std.')
  const mobileAbsoluteLine = toNumericMonthAbsoluteDe(absoluteLine)

  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <dt className="text-sm font-medium text-slate-400">{heading}</dt>
      <dd className="m-0 text-2xl font-semibold tracking-tight text-pretty text-slate-400 tabular-nums sm:text-3xl">
        <span className="sm:hidden">{compactRelativeLine}</span>
        <span className="hidden sm:inline">{compactRelativeLine}</span>
      </dd>
      <dd className="m-0 text-sm text-slate-400">
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

function formatHeadlineSourceLabel(
  sourceUrl: string | null,
  layer: string | null,
  dataset: string | null,
): string | null {
  const suffix = layer || dataset
  if (sourceUrl) {
    try {
      const host = new URL(sourceUrl).hostname
      if (host) return suffix ? `${host} (${suffix})` : host
    } catch {
      // Fallback to original URL text below.
    }
    return suffix ? `${sourceUrl} (${suffix})` : sourceUrl
  }
  return suffix
}

function AreaHeadlineRow({
  title,
  sourceName,
  sourceHref,
}: {
  title: string
  sourceName: string | null
  sourceHref: string | null
}) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <h1 className="min-w-0 text-2xl font-semibold text-slate-100">{title}</h1>
      {sourceName ? (
        <p className="text-xs text-slate-500 sm:text-right">
          {de.footer.geoDataLine}
          {sourceHref ? (
            <a
              href={sourceHref}
              className="underline decoration-slate-500/60 underline-offset-2 transition-colors hover:text-slate-300"
              target="_blank"
              rel="noreferrer"
            >
              {sourceName}
            </a>
          ) : (
            sourceName
          )}
          {de.footer.geoDataSuffix}
        </p>
      ) : null}
    </div>
  )
}

function SortableTh({
  column,
  label,
  align,
  sortBy,
  sortDir,
  onSort,
  labelEnd,
}: {
  column: AreaTableSortKey
  label: string
  align: 'left' | 'right'
  sortBy: AreaTableSortKey
  sortDir: 'asc' | 'desc'
  onSort: (c: AreaTableSortKey) => void
  labelEnd?: ReactNode
}) {
  const active = sortBy === column
  return (
    <th
      scope="col"
      className={
        align === 'right'
          ? 'px-3 py-2 text-right text-slate-100'
          : 'px-3 py-2 text-left text-slate-100'
      }
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      <div
        className={
          align === 'right'
            ? 'flex w-full items-center justify-end gap-0.5'
            : 'flex w-full items-center justify-start gap-0.5'
        }
      >
        <button
          type="button"
          onClick={() => onSort(column)}
          className={
            align === 'right'
              ? 'inline-flex items-center gap-1 font-medium text-slate-100 hover:text-sky-400'
              : 'inline-flex items-center gap-1 font-medium text-slate-100 hover:text-sky-400'
          }
        >
          <span>{label}</span>
          <span className="font-mono text-xs text-slate-400" aria-hidden>
            {active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </button>
        {labelEnd}
      </div>
    </th>
  )
}

function useMeasuredElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return

    let rafId: number | null = null

    const measure = () => {
      const rect = element.getBoundingClientRect()
      const nextWidth = Math.max(0, Math.floor(rect.width))
      const nextHeight = Math.max(0, Math.floor(rect.height))
      setSize((prev) =>
        prev.width === nextWidth && prev.height === nextHeight
          ? prev
          : { width: nextWidth, height: nextHeight },
      )
    }

    const scheduleMeasure = () => {
      if (rafId != null) window.cancelAnimationFrame(rafId)
      rafId = window.requestAnimationFrame(measure)
    }

    measure()

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => scheduleMeasure())
      observer.observe(element)
      return () => {
        observer.disconnect()
        if (rafId != null) window.cancelAnimationFrame(rafId)
      }
    }

    window.addEventListener('resize', scheduleMeasure)
    return () => {
      window.removeEventListener('resize', scheduleMeasure)
      if (rafId != null) window.cancelAnimationFrame(rafId)
    }
  }, [])

  return { ref, size }
}
