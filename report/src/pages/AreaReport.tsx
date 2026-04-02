import { computeMeanIou } from '@compare-metrics/mean-iou/compute.ts'
import { format, isValid, parseISO } from 'date-fns'
import { parseAsString, useQueryState } from 'nuqs'
import {
  lazy,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { LayerToggleStatBlock, StatBlocksRow } from '../components/FeatureStatBlocks'
import {
  AreaDeltaInfoButton,
  HausdorffInfoButton,
  IouInfoButton,
  MeanIouInfoButton,
} from '../components/HausdorffInfoModal'
import { InfoNotice } from '../components/InfoNotice'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { ReportCategoryPill, ReportCategorySwatch } from '../components/reportCategoryStyles'
import { loadComparison, loadSnapshots } from '../data/load'
import { comparisonPmtilesMaplibreUrl } from '../data/paths'
import {
  ALL_MATCH_CATEGORIES,
  useAreaReportCategoryFilter,
} from '../hooks/useAreaReportCategoryFilter'
import { type AreaTableSortKey, useAreaReportTableSort } from '../hooks/useAreaReportTableSort'
import { useComparisonMapLayers } from '../hooks/useComparisonMapLayers'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { categoryLabelDe, de } from '../i18n/de'
import { countMatchCategories } from '../lib/countMatchCategories'
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
import { sourceStatLines } from '../lib/reportFreshnessLines'
import type { ComparisonForReport, ReportRow, SnapshotsJson } from '../types/report'

const ComparisonMapShell = lazy(() => import('../components/map/ComparisonMapShell'))

function unionMapBboxes(rows: ReportRow[]): [number, number, number, number] | null {
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

export function AreaReport() {
  const { areaId } = useParams<{ areaId: string }>()
  const navigate = useNavigate()
  const statsInputId = useId()
  const [snapshot, setSnapshot] = useQueryState('snapshot', parseAsString.withDefault(''))
  const [data, setData] = useState<ComparisonForReport | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [snapIndex, setSnapIndex] = useState<SnapshotsJson | null>(null)
  const { enabledSet, enabledCategories, setCategoryEnabled, isCategoryEnabled } =
    useAreaReportCategoryFilter()
  const mapLayers = useComparisonMapLayers()
  const mapViewParam = useMapViewParam()

  const snapParam = snapshot || null

  /** Main table: BKG-export rows only (excludes legacy `osm_only` if present in old JSON). */
  const mainRows = useMemo(() => {
    if (!data) return []
    return data.rows.filter((r) => r.category === 'matched' || r.category === 'official_only')
  }, [data])

  const visibleRows = useMemo(() => {
    return mainRows.filter((r) => enabledCategories.includes(r.category))
  }, [mainRows, enabledCategories])

  const { sortedRows, sortBy, sortDir, setColumn } = useAreaReportTableSort(visibleRows)

  const catCounts = useMemo(() => countMatchCategories(mainRows), [mainRows])

  const currentSnapshotSelectLabel = useMemo(() => {
    if (!data) return de.areaReport.snapshotLatest
    const d = parseISO(data.generatedAt.trim())
    return isValid(d) ? format(d, 'yyyy-MM-dd') : de.areaReport.snapshotLatest
  }, [data])

  const unmatchedCount = (data?.unmatchedOsm ?? []).length

  const mapAllowlist = useMemo(() => {
    if (!data) return null
    const allOn =
      enabledSet.size === ALL_MATCH_CATEGORIES.length &&
      ALL_MATCH_CATEGORIES.every((c) => enabledSet.has(c))
    if (allOn) return null
    return visibleRows.map((r) => r.canonicalMatchKey)
  }, [data, enabledSet, visibleRows])

  const overviewMapBbox = useMemo(() => unionMapBboxes(visibleRows), [visibleRows])

  const goToFeature = useCallback(
    (featureKey: string) => {
      const q = snapParam ? `?snapshot=${encodeURIComponent(snapParam)}` : ''
      void navigate(`/${areaId}/feature/${encodeURIComponent(featureKey)}${q}`)
    },
    [navigate, areaId, snapParam],
  )

  useEffect(() => {
    if (!areaId) return
    let cancelled = false
    ;(async () => {
      try {
        const [json, snap] = await Promise.all([
          loadComparison(areaId, snapParam || undefined),
          loadSnapshots(areaId),
        ])
        if (cancelled) return
        setData(json)
        setErr(null)
        setSnapIndex(snap)
      } catch (e) {
        if (!cancelled) setErr(String(e))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [areaId, snapParam])

  if (!areaId) return null

  if (err) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <div className="text-red-400">
          {err}
          <p className="mt-2 text-sm text-slate-400">
            {de.areaReport.errorRunCompare}{' '}
            <code className="rounded bg-slate-800 px-1 text-slate-200">
              output/comparison_table.json
            </code>{' '}
            {de.areaReport.errorRunCompareExists}
          </p>
        </div>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-4 text-left sm:px-6 lg:px-8">
        <p className="text-slate-400">{de.areaReport.loading}</p>
      </div>
    )
  }

  const chartData = snapIndex?.runs?.map((r) => ({
    id: r.id,
    meanIou: r.summary.meanIou,
  })) ?? [{ id: 'current', meanIou: computeMeanIou(data.rows) }]

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
  const officialFresh = sourceStatLines(officialRaw, data.sourceMetadata?.official != null)
  const osmFresh = sourceStatLines(osmRaw, data.sourceMetadata?.osm != null)

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 text-left sm:px-6 lg:px-8">
      {snapIndex && snapIndex.runs.length > 0 ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <label className="flex shrink-0 flex-wrap items-center gap-2 text-sm">
            <span className="text-slate-400">{de.areaReport.snapshot}</span>
            <select
              className="rounded border border-slate-600 bg-slate-800 px-2 py-1 text-slate-100"
              value={snapshot}
              onChange={(e) => void setSnapshot(e.target.value || '')}
            >
              <option value="">{currentSnapshotSelectLabel}</option>
              {snapIndex.runs.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <section
        className="mb-6 rounded border border-slate-700 bg-slate-900 p-4"
        aria-label={st.summaryRowAria}
      >
        <StatBlocksRow className="mt-0" aria-label={st.summaryStatRowAria}>
          <SummaryStatColumn
            heading={de.areaReport.freshnessHeadingReport}
            relativeLine={reportFresh.relativeLine ?? EM_DASH}
            absoluteLine={reportFresh.absoluteLine || EM_DASH}
          />
          <SummaryStatColumn
            heading={de.areaReport.freshnessHeadingOfficial}
            relativeLine={officialFresh.relativeLine}
            absoluteLine={officialFresh.absoluteLine}
          />
          <SummaryStatColumn
            heading={de.areaReport.freshnessHeadingOsm}
            relativeLine={osmFresh.relativeLine}
            absoluteLine={osmFresh.absoluteLine}
          />
        </StatBlocksRow>

        <StatBlocksRow className="mt-10 sm:mt-12 lg:mt-14" aria-label={st.summaryLegendRowAria}>
          <LayerToggleStatBlock
            inputId={`${statsInputId}-matched`}
            checked={catCounts.matched === 0 ? false : isCategoryEnabled('matched')}
            disabled={catCounts.matched === 0}
            onChange={(on) => setCategoryEnabled('matched', on)}
            label={categoryLabelDe('matched')}
            value={formatDeInteger(catCounts.matched)}
            swatch={<ReportCategorySwatch category="matched" />}
          />
          <LayerToggleStatBlock
            inputId={`${statsInputId}-official`}
            checked={catCounts.official_only === 0 ? false : isCategoryEnabled('official_only')}
            disabled={catCounts.official_only === 0}
            onChange={(on) => setCategoryEnabled('official_only', on)}
            label={categoryLabelDe('official_only')}
            value={formatDeInteger(catCounts.official_only)}
            swatch={<ReportCategorySwatch category="official_only" />}
          />
        </StatBlocksRow>
        <p className="mt-4 text-sm text-slate-300">
          {de.areaReport.unmatchedCountLabel}: {formatDeInteger(unmatchedCount)}
          {unmatchedCount > 0 ? (
            <>
              {' '}
              <Link
                className="text-sky-400 underline"
                to={`/${areaId}/unmatched${snapParam ? `?snapshot=${encodeURIComponent(snapParam)}` : ''}`}
              >
                {de.areaReport.unmatchedPageLink}
              </Link>
            </>
          ) : null}
        </p>
      </section>

      <div className="mb-8">
        {snapParam && !data.hasPmtiles ? (
          <InfoNotice>{de.map.historicSnapshotNoTiles}</InfoNotice>
        ) : (
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
                  <ComparisonMapShell
                    pmtilesUrl={comparisonPmtilesMaplibreUrl(areaId, snapParam)}
                    sourceLayer={data.tippecanoeLayer}
                    featureId={null}
                    allowedFeatureIds={mapAllowlist}
                    mapBbox={overviewMapBbox}
                    urlMapView={mapViewParam.mapView}
                    onMoveEndCommitUrl={mapViewParam.commitMapViewFromMap}
                    showOfficial={mapLayers.showOfficial}
                    showOsm={mapLayers.showOsm}
                    showDiff={mapLayers.showDiff}
                    onFeatureClick={goToFeature}
                  />
                </Suspense>
              ) : (
                <div className="flex h-full items-center justify-center p-4">
                  <InfoNotice className="max-w-xl">{de.feature.noPmtiles}</InfoNotice>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mb-8 h-64 rounded border border-slate-700 bg-slate-900 p-2">
        <h2 className="mb-2 flex flex-wrap items-center gap-1 font-medium text-sm text-slate-300">
          <span>{de.areaReport.chartTitle}</span>
          <MeanIouInfoButton className="-ml-0.5" iconClassName="size-[0.95rem]" />
        </h2>
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={chartData} margin={{ left: 8, right: 8 }}>
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
        </ResponsiveContainer>
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
              <tr key={row.canonicalMatchKey} className="border-slate-800 border-t">
                <td className="px-3 py-2 text-slate-100">{row.nameLabel}</td>
                <td className="px-3 py-2 font-mono text-xs text-slate-100">
                  {row.canonicalMatchKey}
                </td>
                <td className="px-3 py-2">
                  <ReportCategoryPill category={row.category}>
                    {categoryLabelDe(row.category)}
                  </ReportCategoryPill>
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                  {row.metrics ? formatDeIou(row.metrics.iou) : EM_DASH}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                  {row.metrics ? formatDePercentPoints(row.metrics.areaDiffPct) : EM_DASH}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-100">
                  {row.metrics ? formatDeOrDash(row.metrics.hausdorffM, formatDeMeters) : EM_DASH}
                </td>
                <td className="px-3 py-2">
                  <Link
                    className="text-sky-400 underline"
                    to={`/${areaId}/feature/${encodeURIComponent(row.canonicalMatchKey)}${snapParam ? `?snapshot=${encodeURIComponent(snapParam)}` : ''}`}
                  >
                    {de.areaReport.table.view}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ReportDataProvenanceFooter data={data} areaId={areaId} snapshot={snapParam} />
    </div>
  )
}

/** Row 1: heading, relative age (large), absolute datetime (small). */
function SummaryStatColumn({
  heading,
  relativeLine,
  absoluteLine,
}: {
  heading: string
  relativeLine: string
  absoluteLine: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-y-1">
      <dt className="font-medium text-sm text-slate-300">{heading}</dt>
      <dd className="m-0 text-pretty font-semibold text-2xl text-slate-100 tabular-nums tracking-tight sm:text-3xl">
        {relativeLine}
      </dd>
      <dd className="m-0 text-sm text-slate-400">{absoluteLine}</dd>
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
