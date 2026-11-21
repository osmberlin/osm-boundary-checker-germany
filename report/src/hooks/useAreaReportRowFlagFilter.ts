import { useNavigate, useSearch } from '@tanstack/react-router'
import type { AreaReportRow } from '../types/report'

/** Per row flag: all rows (default), only flagged rows, or only rows without the flag. */
export type RowFlagFilter = 'all' | 'only' | 'hide'

const ROW_FLAGS_SEARCH_KEY = 'rowFlags'

/** `?rowFlags=managed:only,other:hide` → `{ managed: 'only', other: 'hide' }`; unknown parts are dropped. */
export function parseRowFlagFilters(value: unknown): Record<string, RowFlagFilter> {
  if (typeof value !== 'string') return {}
  const out: Record<string, RowFlagFilter> = {}
  for (const part of value.split(',')) {
    const [id, mode] = part.split(':')
    if (id && (mode === 'only' || mode === 'hide')) out[id] = mode
  }
  return out
}

function serializeRowFlagFilters(filters: Record<string, RowFlagFilter>) {
  const parts = Object.entries(filters)
    .filter(([, mode]) => mode !== 'all')
    .map(([id, mode]) => `${id}:${mode}`)
  return parts.length > 0 ? parts.join(',') : undefined
}

export function matchesRowFlagFilters(
  row: AreaReportRow,
  filters: Record<string, RowFlagFilter>,
): boolean {
  for (const [id, mode] of Object.entries(filters)) {
    const flagged = row.flags?.includes(id) ?? false
    if (mode === 'only' && !flagged) return false
    if (mode === 'hide' && flagged) return false
  }
  return true
}

export function useAreaReportRowFlagFilter() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const filters = parseRowFlagFilters(search[ROW_FLAGS_SEARCH_KEY])

  const setRowFlagFilter = (id: string, mode: RowFlagFilter) => {
    void navigate({
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        [ROW_FLAGS_SEARCH_KEY]: serializeRowFlagFilters({
          ...parseRowFlagFilters(prev[ROW_FLAGS_SEARCH_KEY]),
          [id]: mode,
        }),
      })) as never,
      replace: true,
      resetScroll: false,
    })
  }

  return { rowFlagFilters: filters, setRowFlagFilter }
}
