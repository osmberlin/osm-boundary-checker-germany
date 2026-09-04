import { useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

export const STALE_KEYS_FILTERS = ['all', 'only', 'hide'] as const
export type StaleKeysFilter = (typeof STALE_KEYS_FILTERS)[number]

const staleKeysSchema = z.enum(STALE_KEYS_FILTERS)

export function parseStaleKeysFilter(value: unknown) {
  const parsed = staleKeysSchema.safeParse(value)
  return parsed.success ? parsed.data : 'all'
}

export function validateAreaReportSearch(search: Record<string, unknown>): {
  staleKeys?: StaleKeysFilter
} {
  const parsed = staleKeysSchema.safeParse(search.staleKeys)
  return {
    ...search,
    staleKeys: parsed.success && parsed.data !== 'all' ? parsed.data : undefined,
  }
}

export function useAreaReportStaleKeysFilter() {
  const navigate = useNavigate({ from: '/$areaId' })
  const search = useSearch({ from: '/$areaId' })
  const staleKeys = parseStaleKeysFilter(search.staleKeys)

  const setStaleKeys = (next: StaleKeysFilter) => {
    void navigate({
      search: (prev) => ({
        ...prev,
        staleKeys: next === 'all' ? undefined : next,
      }),
      replace: true,
      resetScroll: false,
    })
  }

  return { staleKeys, setStaleKeys }
}
