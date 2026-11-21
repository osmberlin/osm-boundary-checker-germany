import { useNavigate, useSearch } from '@tanstack/react-router'
import type { GermanStateCode } from '../../../scripts/shared/germanStates.ts'
import { MAP_VIEW_QUERY_KEY } from '../lib/mapViewQueryParam'
import { STATE_SEARCH_KEY, validateStateSearch } from '../lib/stateFilter'

/**
 * `?state=BB` of the current page. The root route keeps the param on every link
 * (`retainSearchParams`), so the choice follows the user from the home page into a dataset and back.
 */
export function useStateFilter() {
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as Record<string, unknown>
  const state = validateStateSearch(search).state ?? null

  const setState = (next: GermanStateCode | null) => {
    void navigate({
      search: ((prev: Record<string, unknown>) => ({
        ...prev,
        [STATE_SEARCH_KEY]: next ?? undefined,
        // A saved map view would win over the zoom to the new state.
        [MAP_VIEW_QUERY_KEY]: undefined,
      })) as never,
      replace: true,
      resetScroll: false,
    })
  }

  return { state, setState }
}
