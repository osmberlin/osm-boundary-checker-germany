import { useQuery, useQueryClient } from '@tanstack/react-query'
import { overpassLiveQueryOptions, type OverpassLiveQueryInput } from '../data/load'

const LIVE_STALE_TIME_MS = Number.POSITIVE_INFINITY

export function useFeatureDetailOverpass(featureKey: string) {
  const queryClient = useQueryClient()

  // Single cache entry per feature: if it has data, live query ran once.
  const overpassQuery = useQuery({
    ...overpassLiveQueryOptions({
      featureKey,
      query: '',
      interpreterUrl: '',
    }),
    enabled: false,
    staleTime: LIVE_STALE_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  })

  async function runLiveOverpass(query: string, interpreterUrl: string) {
    const input: OverpassLiveQueryInput = {
      featureKey,
      query: query.trim(),
      interpreterUrl,
    }
    await queryClient.fetchQuery({
      ...overpassLiveQueryOptions(input),
      staleTime: LIVE_STALE_TIME_MS,
      retry: false,
    })
  }

  function resetLiveOverpass() {
    queryClient.removeQueries({ queryKey: ['overpass-live', featureKey], exact: true })
  }

  function resetRunMutation() {
    const queryKey = overpassLiveQueryOptions({
      featureKey,
      query: '',
      interpreterUrl: '',
    }).queryKey
    const state = queryClient.getQueryState(queryKey)
    if (state?.status === 'error' && state.data == null) {
      queryClient.removeQueries({ queryKey, exact: true })
    }
  }

  return {
    hits: overpassQuery.data?.hits ?? [],
    geojson: overpassQuery.data?.geojson ?? null,
    hasCachedData: overpassQuery.data != null,
    isRunPending: overpassQuery.isPending,
    runError: overpassQuery.error,
    runLiveOverpass,
    resetLiveOverpass,
    resetRunMutation,
  }
}
