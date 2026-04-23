import { useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

const MATCH_CATEGORIES = ['matched', 'official_only', 'unmatched_osm'] as const

export type MatchCategory = (typeof MATCH_CATEGORIES)[number]

export const ALL_MATCH_CATEGORIES: MatchCategory[] = [...MATCH_CATEGORIES]

const categorySchema = z.enum(MATCH_CATEGORIES)

function parseCategoriesFromSearch(value: unknown): MatchCategory[] {
  if (typeof value !== 'string' || value.trim() === '') return ALL_MATCH_CATEGORIES
  const raw = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const out = raw
    .map((entry) => categorySchema.safeParse(entry))
    .filter((result): result is { success: true; data: MatchCategory } => result.success)
    .map((result) => result.data)
  const deduped = ALL_MATCH_CATEGORIES.filter((category) => out.includes(category))
  return deduped.length === 0 ? ALL_MATCH_CATEGORIES : deduped
}

export function useAreaReportCategoryFilter() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const cats = parseCategoriesFromSearch(search.cats)
  const enabledSet = new Set(cats)

  const setCategoryEnabled = (c: MatchCategory, enabled: boolean) => {
    void navigate({
      search: ((prev: Record<string, unknown>) => {
        const cur = parseCategoriesFromSearch(prev.cats)
        const next = new Set(cur)
        if (enabled) next.add(c)
        else next.delete(c)
        const arr = ALL_MATCH_CATEGORIES.filter((x) => next.has(x))
        return {
          ...prev,
          cats: arr.length === ALL_MATCH_CATEGORIES.length ? undefined : arr.join(','),
        }
      }) as never,
      replace: true,
    })
  }

  return {
    /** Same categories as `enabledSet`; prefer for row filtering so URL state stays in sync with the table. */
    enabledCategories: cats,
    enabledSet,
    setCategoryEnabled,
    isCategoryEnabled: (c: MatchCategory) => enabledSet.has(c),
  }
}
