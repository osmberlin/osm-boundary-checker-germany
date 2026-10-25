import { Link, useNavigate } from '@tanstack/react-router'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import {
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { isStaleKeyRow } from '../hooks/useAreaReportStaleKeysFilter'
import type { AreaTableSortKey } from '../hooks/useAreaReportTableSort'
import { categoryLabelDe, de } from '../i18n/de'
import {
  EM_DASH,
  formatDeIou,
  formatDeMeters,
  formatDeOrDash,
  formatDePercentPoints,
} from '../lib/formatDe'
import type { AreaReportRow } from '../types/report'
import { IssueBadge } from './IssueBadge'
import {
  AreaDeltaInfoButton,
  HausdorffInfoButton,
  IouInfoButton,
  IssueIndicatorInfoButton,
} from './MetricInfoModal'
import { ReportCategoryPill } from './reportCategoryStyles'

/** Typical height of a one-line row; rows are measured after they render. */
const ESTIMATED_ROW_HEIGHT_PX = 53
const ROW_OVERSCAN = 12

/**
 * Area table. Window-scrolled and virtualized: only the rows near the viewport are in the DOM; two
 * spacer rows keep the semantic `<table>` and the total height of the page correct.
 */
export function AreaReportTable({
  rows,
  areaKey,
  metricsCrs,
  sortBy,
  sortDir,
  onSort,
}: {
  rows: AreaReportRow[]
  areaKey: string
  metricsCrs: string
  sortBy: AreaTableSortKey
  sortDir: 'asc' | 'desc'
  onSort: (column: AreaTableSortKey) => void
}) {
  // The virtualizer returns functions that React Compiler would memoize into stale values.
  'use no memo'
  const navigate = useNavigate()
  const st = de.areaReport.stats
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null)
  const [scrollMargin, setScrollMargin] = useState(0)

  useLayoutEffect(function trackTableOffsetInDocument() {
    const measure = () => {
      const tbody = tbodyRef.current
      if (!tbody) return
      const offset = Math.round(tbody.getBoundingClientRect().top + window.scrollY)
      setScrollMargin((prev) => (prev === offset ? prev : offset))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    // Content above the table (map, chart, notices) can change height after the first paint.
    const observer = new ResizeObserver(measure)
    observer.observe(document.body)
    return function stopTrackingTableOffset() {
      observer.disconnect()
    }
  }, [])

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    overscan: ROW_OVERSCAN,
    scrollMargin,
    getItemKey: (index) => rows[index]?.canonicalMatchKey ?? index,
  })

  const maxima = useMemo(
    () => ({
      iou: maxFiniteValue(rows.map((row) => row.metrics?.iou)),
      areaDiff: maxFiniteValue(rows.map((row) => absOrNull(row.metrics?.areaDiffPct))),
      hausdorff: maxFiniteValue(rows.map((row) => row.metrics?.hausdorffM)),
      hausdorffP95: maxFiniteValue(rows.map((row) => row.metrics?.hausdorffP95M)),
    }),
    [rows],
  )

  const virtualRows = virtualizer.getVirtualItems()
  const firstRow = virtualRows[0]
  const lastRow = virtualRows[virtualRows.length - 1]
  const spacerTop = firstRow ? firstRow.start - scrollMargin : 0
  const spacerBottom = lastRow ? virtualizer.getTotalSize() - (lastRow.end - scrollMargin) : 0
  const columnCount = 8

  return (
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
              onSort={onSort}
            />
            <SortableTh
              column="category"
              label={de.areaReport.table.category}
              align="left"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              column="iou"
              label={de.areaReport.table.iou}
              align="right"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
              labelEnd={
                <IouInfoButton
                  className="-mr-0.5"
                  iconClassName="size-[0.95rem]"
                  bandContext={{ metricsCrs }}
                />
              }
            />
            <SortableTh
              column="area"
              label={de.areaReport.table.areaDelta}
              align="right"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
              labelEnd={
                <AreaDeltaInfoButton
                  className="-mr-0.5"
                  iconClassName="size-[0.95rem]"
                  bandContext={{ metricsCrs }}
                />
              }
            />
            <SortableTh
              column="haus"
              label={de.areaReport.table.hausdorff}
              align="right"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
              labelEnd={
                <HausdorffInfoButton
                  className="-mr-0.5"
                  iconClassName="size-[0.95rem]"
                  bandContext={{ metricsCrs }}
                />
              }
            />
            <SortableTh
              column="haus95"
              label={de.areaReport.table.hausdorffP95}
              align="right"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
              labelEnd={
                <HausdorffInfoButton
                  className="-mr-0.5"
                  iconClassName="size-[0.95rem]"
                  bandContext={{ metricsCrs }}
                />
              }
            />
            <SortableTh
              column="issue"
              label={de.areaReport.table.issueIndicator}
              align="left"
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={onSort}
              labelEnd={
                <IssueIndicatorInfoButton className="-mr-0.5" iconClassName="size-[0.95rem]" />
              }
            />
            <th
              className="px-3 py-2 text-right text-slate-100"
              aria-label={de.areaReport.table.view}
            />
          </tr>
        </thead>
        <tbody ref={tbodyRef}>
          {spacerTop > 0 ? <SpacerRow height={spacerTop} columnCount={columnCount} /> : null}
          {virtualRows.map((virtualRow) => {
            const row = rows[virtualRow.index]
            if (!row) return null
            const detailParams = {
              areaId: areaKey,
              featureKey: row.canonicalMatchKey,
            } as const
            const navigateToFeature = () =>
              navigate({
                to: '/$areaId/feature/$featureKey',
                params: detailParams,
              })
            return (
              <tr
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                className="group cursor-pointer border-t border-slate-800 transition-colors focus-within:bg-slate-800/55 hover:bg-slate-800/55"
                tabIndex={0}
                onClick={() => {
                  void navigateToFeature()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    void navigateToFeature()
                  }
                }}
              >
                <td className="px-3 py-2 text-slate-100">{row.nameLabel}</td>
                <td className="px-3 py-2">
                  <ReportCategoryPill category={row.category}>
                    {categoryLabelDe(row.category)}
                  </ReportCategoryPill>
                  {isStaleKeyRow(row) ? (
                    <span className="mt-1 block text-xs font-medium text-amber-300">
                      {st.staleKeyBadge}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">
                  <MetricCellBar
                    ratio={normalizedRatio(row.metrics?.iou, maxima.iou)}
                    value={row.metrics ? formatDeIou(row.metrics.iou) : EM_DASH}
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">
                  <MetricCellBar
                    ratio={normalizedRatio(absOrNull(row.metrics?.areaDiffPct), maxima.areaDiff)}
                    value={row.metrics ? formatDePercentPoints(row.metrics.areaDiffPct) : EM_DASH}
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">
                  <MetricCellBar
                    ratio={normalizedRatio(row.metrics?.hausdorffM, maxima.hausdorff)}
                    value={
                      row.metrics ? formatDeOrDash(row.metrics.hausdorffM, formatDeMeters) : EM_DASH
                    }
                  />
                </td>
                <td className="px-3 py-2 text-right text-slate-100 tabular-nums">
                  <MetricCellBar
                    ratio={normalizedRatio(row.metrics?.hausdorffP95M, maxima.hausdorffP95)}
                    value={
                      row.metrics
                        ? formatDeOrDash(row.metrics.hausdorffP95M, formatDeMeters)
                        : EM_DASH
                    }
                  />
                </td>
                <td className="px-3 py-2 text-left text-slate-100">
                  <IssueBadge level={row.metrics?.issueIndicator?.level} />
                </td>
                <td className="px-3 py-2 text-right">
                  <Link
                    className="inline-flex items-center text-slate-500 transition-colors group-hover:text-sky-300 focus-visible:text-sky-300"
                    to="/$areaId/feature/$featureKey"
                    params={detailParams}
                    onClick={(event: MouseEvent<HTMLAnchorElement>) => event.stopPropagation()}
                    aria-label={`${de.areaReport.table.view}: ${row.nameLabel}`}
                  >
                    <span className="sr-only">{de.areaReport.table.view}</span>
                    <span aria-hidden>→</span>
                  </Link>
                </td>
              </tr>
            )
          })}
          {spacerBottom > 0 ? <SpacerRow height={spacerBottom} columnCount={columnCount} /> : null}
        </tbody>
      </table>
    </div>
  )
}

function SpacerRow({ height, columnCount }: { height: number; columnCount: number }) {
  return (
    <tr aria-hidden style={{ height }}>
      <td colSpan={columnCount} className="p-0" />
    </tr>
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
          className="inline-flex items-center gap-1 font-medium text-slate-100 hover:text-sky-400"
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
