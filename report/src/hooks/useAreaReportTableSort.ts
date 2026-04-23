import { useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import type { AreaReportRow, ReportCategory } from '../types/report'

export const AREA_TABLE_SORT_KEYS = ['name', 'key', 'category', 'iou', 'area', 'haus'] as const

export type AreaTableSortKey = (typeof AREA_TABLE_SORT_KEYS)[number]

const sortKeySchema = z.enum(AREA_TABLE_SORT_KEYS)
const sortDirSchema = z.enum(['asc', 'desc'])

function parseSortKey(value: unknown): AreaTableSortKey {
  const parsed = sortKeySchema.safeParse(value)
  return parsed.success ? parsed.data : 'haus'
}

function parseSortDir(value: unknown): 'asc' | 'desc' {
  const parsed = sortDirSchema.safeParse(value)
  return parsed.success ? parsed.data : 'desc'
}

function hausdorffValue(m: AreaReportRow['metrics']): number | null {
  if (!m) return null
  const v = m.hausdorffM
  return Number.isNaN(v) ? null : v
}

const CATEGORY_ORDER: ReportCategory[] = ['matched', 'official_only', 'unmatched_osm']

function compareRows(
  a: AreaReportRow,
  b: AreaReportRow,
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
      return inv * (CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category))
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

export function useAreaReportTableSort(rows: AreaReportRow[]) {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const sortBy = parseSortKey(search.sort)
  const sortDir = parseSortDir(search.dir)

  const sortedRows = [...rows].sort((a, b) => compareRows(a, b, sortBy, sortDir))

  const setColumn = (column: AreaTableSortKey) => {
    void navigate({
      search: ((prev: Record<string, unknown>) => {
        const prevSort = parseSortKey(prev.sort)
        const prevDir = parseSortDir(prev.dir)
        if (prevSort === column) {
          const nextDir = prevDir === 'asc' ? 'desc' : 'asc'
          return {
            ...prev,
            sort: column === 'haus' ? undefined : column,
            dir: nextDir === 'desc' ? undefined : nextDir,
          }
        }
        return {
          ...prev,
          sort: column === 'haus' ? undefined : column,
          dir: 'asc',
        }
      }) as never,
      replace: true,
    })
  }

  return {
    sortBy,
    sortDir,
    setColumn,
    sortedRows,
  }
}
