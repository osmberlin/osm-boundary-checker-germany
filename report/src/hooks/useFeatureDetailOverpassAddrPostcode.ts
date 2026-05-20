import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  overpassAddrPostcodeLiveQueryOptions,
  type OverpassAddrPostcodeLiveQueryInput,
} from '../data/load'

const LIVE_STALE_TIME_MS = Number.POSITIVE_INFINITY

export function useFeatureDetailOverpassAddrPostcode(featureKey: string) {
  const queryClient = useQueryClient()

  const overpassQuery = useQuery({
    ...overpassAddrPostcodeLiveQueryOptions({
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
    const input: OverpassAddrPostcodeLiveQueryInput = {
      featureKey,
      query: query.trim(),
      interpreterUrl,
    }
    await queryClient.fetchQuery({
      ...overpassAddrPostcodeLiveQueryOptions(input),
      staleTime: LIVE_STALE_TIME_MS,
      retry: false,
    })
  }

  function resetLiveOverpass() {
    queryClient.removeQueries({
      queryKey: ['overpass-live-addr-postcode', featureKey],
      exact: true,
    })
  }

  function resetRunMutation() {
    const queryKey = overpassAddrPostcodeLiveQueryOptions({
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
    isRunPending: overpassQuery.isFetching,
    runError: overpassQuery.error,
    runLiveOverpass,
    resetLiveOverpass,
    resetRunMutation,
  }
}
