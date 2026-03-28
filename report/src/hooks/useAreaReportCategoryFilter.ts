import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'

const MATCH_CATEGORIES = ['matched', 'official_only'] as const

export type MatchCategory = (typeof MATCH_CATEGORIES)[number]

export const ALL_MATCH_CATEGORIES: MatchCategory[] = [...MATCH_CATEGORIES]

const categoryItemParser = parseAsStringLiteral(MATCH_CATEGORIES)

const catsParser = parseAsArrayOf(categoryItemParser)
  .withDefault(ALL_MATCH_CATEGORIES)
  .withOptions({ history: 'replace' })

export function useAreaReportCategoryFilter() {
  const [cats, setCats] = useQueryState('cats', catsParser)

  const enabledSet = useMemo(() => new Set(cats), [cats])

  const setCategoryEnabled = useCallback(
    (c: MatchCategory, enabled: boolean) => {
      void setCats((prev) => {
        const cur = prev ?? ALL_MATCH_CATEGORIES
        const next = new Set(cur)
        if (enabled) next.add(c)
        else next.delete(c)
        const arr = ALL_MATCH_CATEGORIES.filter((x) => next.has(x))
        return arr.length === ALL_MATCH_CATEGORIES.length ? ALL_MATCH_CATEGORIES : arr
      })
    },
    [setCats],
  )

  return {
    /** Same categories as `enabledSet`; prefer for row filtering so URL state stays in sync with the table. */
    enabledCategories: cats,
    enabledSet,
    setCategoryEnabled,
    isCategoryEnabled: (c: MatchCategory) => enabledSet.has(c),
  }
}
