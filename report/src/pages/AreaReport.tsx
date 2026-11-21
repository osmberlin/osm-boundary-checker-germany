import { computeMeanIou } from '@compare-metrics/mean-iou/compute.ts'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { MapProvider } from 'react-map-gl/maplibre'
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import { germanStateName } from '../../../scripts/shared/germanStates.ts'
import { AreaReportHeader } from '../components/AreaReportHeader'
import { AreaReportTable } from '../components/AreaReportTable'
import { DatasetDiscussionAlerts } from '../components/discussion/DatasetDiscussionAlerts'
import {
  KPI_FILTER_ROW_LAYOUT,
  KpiRow,
  KpiSectionRow,
  KpiSelectCell,
  KpiToggleCell,
} from '../components/FeatureStatBlocks'
import { COMPARISON_MAP_ID } from '../components/map/comparisonMapConstants'
import { ComparisonMapZoomHintOverlay } from '../components/map/ComparisonMapZoomHintOverlay'
import { MapOverlapPickDialog } from '../components/map/MapOverlapPickDialog'
import { MeanIouInfoButton } from '../components/MetricInfoModal'
import { OfficialDatasetAgeInfoButton } from '../components/OfficialDatasetAgeInfoModal'
import { ReportCategoryLabel } from '../components/ReportCategoryLabel'
import { ReportCategorySquareSwatch } from '../components/reportCategoryStyles'
import { ReportDataProvenanceFooter } from '../components/ReportDataProvenanceFooter'
import { ReportLicenseCompatibilitySection } from '../components/ReportLicenseCompatibilitySection'
import { RouteLoadingPane } from '../components/RouteLoadingPane'
import { StateFilterSelect, StateFilterStatic } from '../components/stateFilter/StateFilterSelect'
import { SummaryStatColumn } from '../components/SummaryStatColumn'
import {
  comparisonQueryOptions,
  runStatusQueryOptions,
  snapshotsQueryOptions,
  stateOutlineQueryOptions,
} from '../data/load'
import { comparisonPmtilesMaplibreUrl, comparisonUnmatchedPmtilesMaplibreUrl } from '../data/paths'
import { useAreaReportCategoryFilter } from '../hooks/useAreaReportCategoryFilter'
import {
  matchesRowFlagFilters,
  useAreaReportRowFlagFilter,
} from '../hooks/useAreaReportRowFlagFilter'
import { isStaleKeyRow, useAreaReportStaleKeysFilter } from '../hooks/useAreaReportStaleKeysFilter'
import { useAreaReportTableSort } from '../hooks/useAreaReportTableSort'
import { useComparisonMapLayers } from '../hooks/useComparisonMapLayers'
import { useMapViewParam } from '../hooks/useMapViewParam'
import { useStateFilter } from '../hooks/useStateFilter'
import { categoryLabelDe, de } from '../i18n/de'
import { SourceTerm } from '../i18n/sourceVocabulary'
import { handleComparisonMapFeatureClick } from '../lib/comparisonMapFeatureClick'
import { isOlderThanDays } from '../lib/dataAge'
import { normalizeUnmatchedRows } from '../lib/findFeatureDetailRow'
import { EM_DASH, formatDeFixed, formatDeInteger, formatDeIou } from '../lib/formatDe'
import { isSchluesselExplorerPreset } from '../lib/germanKeyExplorer'
import { officialAreaSummaryFreshness } from '../lib/officialAreaSummaryFreshness'
import { osmAreaSummaryFreshness } from '../lib/osmAreaSummaryFreshness'
import { kpiFreshnessLinesFromIso } from '../lib/reportFreshnessLines'
import { areaDisplayNameForId } from '../lib/reportLookups'
import { countRowsByState, outlineBbox, rowIsInState, stateFilterOptions } from '../lib/stateFilter'
import type { AreaReportRow, ComparisonForReport, SnapshotsJson } from '../types/report'

const MapPane = lazy(() => import('../components/MapPane'))

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

export function AreaReport() {
  const { areaId } = useParams({ strict: false })
  const areaKey = areaId ?? ''
  const navigate = useNavigate()
  const statsInputId = useId()
  const [overlapPickKeys, setOverlapPickKeys] = useState<string[] | null>(null)
  const { enabledSet, enabledCategories, setCategoryEnabled, isCategoryEnabled } =
    useAreaReportCategoryFilter()
  const { staleKeys, setStaleKeys } = useAreaReportStaleKeysFilter()
  const mapLayers = useComparisonMapLayers()
  const mapViewParam = useMapViewParam()
  const { state: stateParam, setState } = useStateFilter()
  const { rowFlagFilters, setRowFlagFilter } = useAreaReportRowFlagFilter()
  const { ref: chartRef, size: chartSize } = useMeasuredElementSize<HTMLDivElement>()
  const comparisonQuery = useQuery({
    ...comparisonQueryOptions(areaKey),
    enabled: areaId != null,
  })
  const snapshotsQuery = useQuery({
    ...snapshotsQueryOptions(areaKey),
    enabled: areaId != null,
  })
  const runStatusQuery = useQuery(runStatusQueryOptions())
  const data: ComparisonForReport | null = comparisonQuery.data ?? null
  const snapIndex: SnapshotsJson | null = snapshotsQuery.data ?? null
  const areaDisplayName = data?.displayName ?? areaDisplayNameForId(areaKey)

  /** Main table rows from comparison payload. */
  const allMainRows =
    data?.rows.filter((r) => r.category === 'matched' || r.category === 'official_only') ?? []
  const allUnmatchedRows = data ? normalizeUnmatchedRows(data) : []
  // The filter only works when the rows span at least two Länder; a single-Land dataset shows it as text.
  const stateCounts = countRowsByState([...allMainRows, ...allUnmatchedRows])
  const filterState = stateCounts.size >= 2 ? stateParam : null
  const singleState = stateCounts.size === 1 ? ([...stateCounts.keys()][0] ?? null) : null
  const stateOutlineQuery = useQuery({
    ...stateOutlineQueryOptions(filterState ?? 'BE'),
    enabled: filterState != null,
  })
  const stateOutline = filterState ? (stateOutlineQuery.data ?? null) : null
  const stateOutlinePending = filterState != null && stateOutlineQuery.isPending
  const mainRows = filterState
    ? allMainRows.filter((r) => rowIsInState(r, filterState))
    : allMainRows
  const unmatchedRows = filterState
    ? allUnmatchedRows.filter((r) => rowIsInState(r, filterState))
    : allUnmatchedRows
  const stateFilterControl =
    stateCounts.size >= 2 ? (
      <StateFilterSelect
        options={stateFilterOptions(stateCounts)}
        value={filterState}
        onChange={setState}
      />
    ) : singleState ? (
      <StateFilterStatic
        label={de.stateFilter.only(germanStateName(singleState))}
        hint={de.stateFilter.onlyHint(germanStateName(singleState))}
      />
    ) : null
  // Outdated keys come from the Destatis ARS successor check; other keys (PLZ, WDPA) never have them.
  const showStaleKeys = isSchluesselExplorerPreset(data?.idNormalizationPreset)
  const matchesRowFilters = (row: AreaReportRow): boolean => {
    if (!matchesRowFlagFilters(row, rowFlagFilters)) return false
    if (!showStaleKeys) return true
    const stale = isStaleKeyRow(row)
    if (staleKeys === 'hide') return !stale
    if (staleKeys === 'only') return stale
    return true
  }
  const visibleMainRows = mainRows.filter(
    (r) => enabledCategories.includes(r.category) && matchesRowFilters(r),
  )
  const visibleUnmatchedRows = unmatchedRows.filter(
    (r) => enabledCategories.includes(r.category) && matchesRowFilters(r),
  )
  const visibleRows = [...visibleMainRows, ...visibleUnmatchedRows]
  // Counts behind the „alle / nur / ohne“ dropdowns: rows of the enabled categories (and Land).
  const categoryRows = [...mainRows, ...unmatchedRows].filter((r) =>
    enabledCategories.includes(r.category),
  )
  const rowFilterOptions = (
    matches: (row: AreaReportRow) => boolean,
    labels: { all: string; only: string; hide: string },
  ) => {
    const only = categoryRows.filter(matches).length
    return [
      { value: 'all' as const, label: labels.all, count: categoryRows.length },
      { value: 'only' as const, label: labels.only, count: only },
      { value: 'hide' as const, label: labels.hide, count: categoryRows.length - only },
    ]
  }

  const { sortedRows, sortBy, sortDir, setColumn } = useAreaReportTableSort(
    visibleRows,
    data?.rowFlags?.filter((flag) => flag.sortFirst).map((flag) => flag.id),
  )

  const catCounts = {
    matched: mainRows.filter((r) => r.category === 'matched').length,
    official_only: mainRows.filter((r) => r.category === 'official_only' && !r.staleOfficialKey)
      .length,
    unmatched_osm: unmatchedRows.filter((r) => r.staleOfficialPredecessor == null).length,
    staleOfficialKey: mainRows.filter((r) => r.staleOfficialKey != null).length,
  }

  // The map ignores the state filter: it keeps every boundary and dims the other Länder instead.
  const mapMainRows = allMainRows.filter(
    (r) => enabledCategories.includes(r.category) && matchesRowFilters(r),
  )
  const mapHasRows =
    mapMainRows.length > 0 ||
    allUnmatchedRows.some((r) => enabledCategories.includes(r.category) && matchesRowFilters(r))
  const allMainOn = enabledSet.has('matched') && enabledSet.has('official_only')
  const rowFiltersActive =
    (showStaleKeys && staleKeys !== 'all') || Object.keys(rowFlagFilters).length > 0
  const mapAllowlist =
    !data || (allMainOn && !rowFiltersActive) ? null : mapMainRows.map((r) => r.canonicalMatchKey)
  const officialOnlyMapAllowlist =
    !data || !enabledSet.has('official_only')
      ? []
      : allMainRows.filter((r) => r.category === 'official_only').map((r) => r.canonicalMatchKey)
  const unmatchedMapAllowlist = !data || enabledSet.has('unmatched_osm') ? null : []
  // All rows, not the visible ones: the bbox seeds the map key, so a filter-dependent bbox
  // would remount the map on every category toggle. A state zooms to its outline.
  const overviewMapBbox =
    (stateOutline ? outlineBbox(stateOutline) : null) ??
    unionMapBboxes([...allMainRows, ...allUnmatchedRows])

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
  const latestMeanIou = chartData.length > 0 ? chartData[chartData.length - 1]?.meanIou : null
  const areaRunStatus = runStatusQuery.data?.areas?.[areaKey]
  const compareBranch = areaRunStatus?.compare
  const showCompareFallbackNotice =
    compareBranch?.status === 'compare_failed' && compareBranch.usedCache === true
  const showCompareFailedNotice =
    compareBranch?.status === 'compare_failed' && compareBranch.usedCache !== true
  const chartIsReady = chartSize.width > 0 && chartSize.height > 0

  if (comparisonQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10">
          {areaKey ? (
            <AreaReportHeader title={areaDisplayName || areaKey} filter={stateFilterControl} />
          ) : null}
          <DatasetDiscussionAlerts />
          <div className="text-red-400">
            {String(comparisonQuery.error)}
            <p className="mt-2 text-sm text-slate-400">
              {de.areaReport.errorRunCompare}{' '}
              <code className="rounded bg-slate-800 px-1 text-slate-200">bun run compare</code>{' '}
              {de.areaReport.errorRunCompareExists}
            </p>
            {showCompareFailedNotice ? (
              <p className="mt-2 text-sm text-amber-300">{de.areaReport.compareFailedNotice}</p>
            ) : null}
          </div>
        </div>
      </div>
    )
  }
  if (comparisonQuery.isPending || !data) {
    return (
      <RouteLoadingPane
        title={de.routeLoading.area(areaDisplayName, null)}
        subtitle={de.routeLoading.areaSubtitle}
      />
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
  const reportFresh = kpiFreshnessLinesFromIso(data.generatedAt.trim())
  const officialSide = data.sourceMetadata?.official
  const officialFresh = officialAreaSummaryFreshness(officialSide)
  const osmFresh = osmAreaSummaryFreshness(data.sourceMetadata?.osm)
  const reportIsOld = isOlderThanDays(data.generatedAt, 5)
  const officialIsOld = officialFresh.isOld
  const osmIsOld = osmFresh.isOld

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 text-left sm:px-6 lg:px-8">
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          {areaKey ? (
            <AreaReportHeader title={areaDisplayName || areaKey} filter={stateFilterControl} />
          ) : null}
          <DatasetDiscussionAlerts />
          {showCompareFallbackNotice ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {de.areaReport.compareFallbackNotice}
            </div>
          ) : null}
          {showCompareFailedNotice ? (
            <div className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              {de.areaReport.compareFailedNotice}
            </div>
          ) : null}
        </div>

        <section aria-label={st.summaryStatRowAria}>
          <KpiRow className="mt-0">
            <SummaryStatColumn
              heading={de.areaReport.freshnessHeadingReport}
              relativeLine={reportFresh.relativeLine ?? EM_DASH}
              absoluteLine={reportFresh.absoluteLine || EM_DASH}
              isOld={reportIsOld}
            />
            <SummaryStatColumn
              heading={<SourceTerm kind={data.sourceKind} term="dataHeading" />}
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
              detailLine={osmFresh.detailLine}
              isOld={osmIsOld}
            />
          </KpiRow>
        </section>

        <div className="flex w-full flex-col gap-0">
          <KpiSectionRow
            className="mb-0 rounded-t-md rounded-b-none border-x border-t border-b-0 border-slate-500 !bg-[#F2F3F1] text-slate-900 hover:!bg-[#eaede7]"
            rowClassName={KPI_FILTER_ROW_LAYOUT}
            narrowLayout="none"
            aria-label={st.summaryLegendRowAria}
          >
            <KpiToggleCell
              inputId={`${statsInputId}-matched`}
              checked={catCounts.matched === 0 ? false : isCategoryEnabled('matched')}
              disabled={catCounts.matched === 0}
              onChange={(on) => setCategoryEnabled('matched', on)}
              label={categoryLabelDe('matched')}
              value={formatDeInteger(catCounts.matched)}
              swatch={
                <ReportCategorySquareSwatch category="matched" sourceKind={data.sourceKind} />
              }
            />
            <KpiToggleCell
              inputId={`${statsInputId}-official`}
              checked={catCounts.official_only === 0 ? false : isCategoryEnabled('official_only')}
              disabled={catCounts.official_only === 0}
              onChange={(on) => setCategoryEnabled('official_only', on)}
              label={<ReportCategoryLabel category="official_only" sourceKind={data.sourceKind} />}
              value={formatDeInteger(catCounts.official_only)}
              swatch={<ReportCategorySquareSwatch category="official_only" />}
            />
            <KpiToggleCell
              inputId={`${statsInputId}-unmatched`}
              checked={catCounts.unmatched_osm === 0 ? false : isCategoryEnabled('unmatched_osm')}
              disabled={catCounts.unmatched_osm === 0}
              onChange={(on) => setCategoryEnabled('unmatched_osm', on)}
              label={categoryLabelDe('unmatched_osm')}
              value={formatDeInteger(catCounts.unmatched_osm)}
              swatch={<ReportCategorySquareSwatch category="unmatched_osm" />}
            />
            {showStaleKeys ? (
              <KpiSelectCell
                options={rowFilterOptions(isStaleKeyRow, {
                  all: st.rowFiltersAll,
                  only: st.staleKeysOnly,
                  hide: st.staleKeysHide,
                })}
                selected={staleKeys}
                onChange={setStaleKeys}
                hint={st.staleKeysHint}
                ariaLabel={st.staleKeysFilterLabel}
              />
            ) : (
              data.rowFlags
                ?.filter((flag) => flag.count > 0)
                .map((flag) => (
                  <KpiSelectCell
                    key={flag.id}
                    options={rowFilterOptions((r) => r.flags?.includes(flag.id) ?? false, {
                      all: st.rowFiltersAll,
                      only: st.rowFlagOnly(flag.label),
                      hide: st.rowFlagHide(flag.label),
                    })}
                    selected={rowFlagFilters[flag.id] ?? 'all'}
                    onChange={(mode) => setRowFlagFilter(flag.id, mode)}
                    hint={st.rowFlagHint(flag.hint)}
                    ariaLabel={st.rowFlagFilterAria(flag.label)}
                  />
                ))
            )}
          </KpiSectionRow>

          <div>
            <div className="h-px w-full bg-slate-500" />
            <div className="w-full overflow-hidden rounded-b-md border-x border-b border-slate-500">
              <div className="h-[420px] w-full">
                {!mapHasRows ? (
                  <div className="flex h-full items-center justify-center px-4 text-center text-sm text-slate-400">
                    {st.mapNoVisibleCategories}
                  </div>
                ) : stateOutlinePending ? (
                  // Wait for the outline: its bbox seeds the camera, so mounting early would mount twice.
                  <div className="flex h-full items-center justify-center text-slate-500">
                    {st.mapLoading}
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
                      <div className="relative h-full w-full">
                        <MapPane
                          mapId={COMPARISON_MAP_ID}
                          mapMinZoom={data.filterConfigSummary.minZoom}
                          sources={{
                            primary: {
                              pmtilesUrl: comparisonPmtilesMaplibreUrl(areaKey),
                              sourceLayer: data.tippecanoeLayer,
                              allowedFeatureIds: mapAllowlist,
                              officialOnlyFeatureIds: officialOnlyMapAllowlist,
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
                          overlays={{ stateOutline }}
                          layers={{
                            showOfficial: mapLayers.showOfficial,
                            showOsm: mapLayers.showOsm,
                            showDiff: false,
                          }}
                          interaction={{
                            onFeatureClick: (featureKeys) =>
                              handleComparisonMapFeatureClick({
                                featureKeys,
                                areaKey,
                                data,
                                navigate,
                                onOverlapPick: setOverlapPickKeys,
                              }),
                          }}
                        />
                        <ComparisonMapZoomHintOverlay />
                      </div>
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
        </div>

        <div className="flex h-64 min-w-0 flex-col rounded border border-slate-700 bg-slate-900 p-2">
          <h2 className="mb-3 border-b border-slate-700/80 pb-3 text-base font-semibold text-slate-100">
            <span className="inline-flex flex-wrap items-center gap-1">
              <span>{de.areaReport.chartTitle}</span>
              <MeanIouInfoButton
                className="-ml-0.5"
                iconClassName="size-[0.95rem]"
                bandContext={{
                  metricsCrs: data.metricsCrs,
                  ...(latestMeanIou != null && Number.isFinite(latestMeanIou)
                    ? { meanIou: latestMeanIou }
                    : {}),
                }}
              />
            </span>
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
                <XAxis
                  dataKey="id"
                  tick={{ fontSize: 11, fill: chartTick }}
                  stroke={chartAxisLine}
                />
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

        <div>
          <AreaReportTable
            rows={sortedRows}
            areaKey={areaKey}
            metricsCrs={data.metricsCrs}
            sourceKind={data.sourceKind}
            rowFlags={data.rowFlags}
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={setColumn}
          />

          <MapOverlapPickDialog
            open={overlapPickKeys !== null}
            keys={overlapPickKeys}
            areaKey={areaKey}
            data={data}
            onClose={() => setOverlapPickKeys(null)}
          />
        </div>

        <ReportLicenseCompatibilitySection data={data} />
        <ReportDataProvenanceFooter data={data} hideFreshnessSection />
      </div>
    </div>
  )
}

function useMeasuredElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(function observeElementSize() {
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
      return function stopObservingElementSize() {
        observer.disconnect()
        if (rafId != null) window.cancelAnimationFrame(rafId)
      }
    }

    window.addEventListener('resize', scheduleMeasure)
    return function stopObservingElementSize() {
      window.removeEventListener('resize', scheduleMeasure)
      if (rafId != null) window.cancelAnimationFrame(rafId)
    }
  }, [])

  return { ref, size }
}
