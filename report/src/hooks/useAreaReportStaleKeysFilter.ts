import { useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

export const STALE_KEYS_FILTERS = ['all', 'only', 'hide'] as const
export type StaleKeysFilter = (typeof STALE_KEYS_FILTERS)[number]

const staleKeysSchema = z.enum(STALE_KEYS_FILTERS)

export function parseStaleKeysFilter(value: unknown): StaleKeysFilter {
  const parsed = staleKeysSchema.safeParse(value)
  return parsed.success ? parsed.data : 'all'
}

export function useAreaReportStaleKeysFilter() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const staleKeys = parseStaleKeysFilter(search.staleKeys)

  const setStaleKeys = (next: StaleKeysFilter) => {
    void navigate({
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        staleKeys: next === 'all' ? undefined : next,
      })) as never,
      replace: true,
      resetScroll: false,
    })
  }

  return { staleKeys, setStaleKeys }
}
