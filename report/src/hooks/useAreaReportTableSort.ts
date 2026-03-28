import { parseAsStringLiteral, useQueryStates } from 'nuqs'
import { useCallback, useMemo } from 'react'
import type { ReportRow } from '../types/report'

export const AREA_TABLE_SORT_KEYS = ['name', 'key', 'category', 'iou', 'area', 'haus'] as const

export type AreaTableSortKey = (typeof AREA_TABLE_SORT_KEYS)[number]

const areaTableSortParsers = {
  sort: parseAsStringLiteral(AREA_TABLE_SORT_KEYS).withDefault('haus'),
  dir: parseAsStringLiteral(['asc', 'desc'] as const).withDefault('desc'),
}

function hausdorffValue(m: ReportRow['metrics']): number | null {
  if (!m) return null
  const v = m.hausdorffM
  return Number.isNaN(v) ? null : v
}

function compareRows(
  a: ReportRow,
  b: ReportRow,
  sort: AreaTableSortKey,
  dir: 'asc' | 'desc',
): number {
  const inv = dir === 'asc' ? 1 : -1

  const str = (x: string, y: string) => inv * x.localeCompare(y, 'de', { sensitivity: 'base' })

  switch (sort) {
    case 'name':
      return str(a.nameLabel, b.nameLabel)
    case 'key':
      return str(a.canonicalMatchKey, b.canonicalMatchKey)
    case 'category':
      return str(a.category, b.category)
    case 'iou': {
      const va = a.metrics?.iou ?? null
      const vb = b.metrics?.iou ?? null
      return compareNullableNum(va, vb, inv)
    }
    case 'area': {
      const va = a.metrics?.areaDiffPct ?? null
      const vb = b.metrics?.areaDiffPct ?? null
      return compareNullableNum(va, vb, inv)
    }
    case 'haus': {
      const va = hausdorffValue(a.metrics)
      const vb = hausdorffValue(b.metrics)
      return compareNullableNum(va, vb, inv)
    }
    default:
      return 0
  }
}

/** Null / missing metrics sort after finite values */
function compareNullableNum(a: number | null, b: number | null, inv: 1 | -1): number {
  if (a === null && b === null) return 0
  if (a === null) return 1
  if (b === null) return -1
  return inv * (a - b)
}

export function useAreaReportTableSort(rows: ReportRow[]) {
  const [{ sort: sortBy, dir: sortDir }, setSort] = useQueryStates(areaTableSortParsers, {
    history: 'replace',
  })

  const sortedRows = useMemo(() => {
    const next = [...rows]
    next.sort((a, b) => compareRows(a, b, sortBy, sortDir))
    return next
  }, [rows, sortBy, sortDir])

  const setColumn = useCallback(
    (column: AreaTableSortKey) => {
      void setSort((prev) => {
        if (prev.sort === column) {
          return { dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        }
        return { sort: column, dir: 'asc' }
      })
    },
    [setSort],
  )

  return {
    sortBy,
    sortDir,
    setColumn,
    sortedRows,
  }
}
