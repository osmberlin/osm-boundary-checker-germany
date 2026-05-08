import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import {
  overpassLiveQueryOptions,
  type OverpassLiveQueryData,
  type OverpassLiveQueryInput,
} from '../data/load'

function pickLatestOverpassLiveFromCache(
  queryClient: QueryClient,
  featureKey: string,
): OverpassLiveQueryData | null {
  const cachedQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['overpass-live', featureKey], exact: false })

  let latest: { data: OverpassLiveQueryData; updatedAt: number } | null = null

  for (const query of cachedQueries) {
    const key = query.queryKey
    if (!Array.isArray(key) || key.length !== 4) continue
    if (key[0] !== 'overpass-live' || key[1] !== featureKey) continue
    const data = query.state.data
    if (!data) continue
    const updatedAt = query.state.dataUpdatedAt ?? 0
    if (!latest || updatedAt > latest.updatedAt) {
      latest = { data: data as OverpassLiveQueryData, updatedAt }
    }
  }

  return latest?.data ?? null
}

function subscribeOverpassLiveCache(queryClient: QueryClient, onStoreChange: () => void) {
  return queryClient.getQueryCache().subscribe(onStoreChange)
}

export function useFeatureDetailOverpass(featureKey: string) {
  const queryClient = useQueryClient()

  const liveData = useSyncExternalStore(
    (onStoreChange) => subscribeOverpassLiveCache(queryClient, onStoreChange),
    () => pickLatestOverpassLiveFromCache(queryClient, featureKey),
    () => pickLatestOverpassLiveFromCache(queryClient, featureKey),
  )

  const mutation = useMutation({
    mutationFn: (input: OverpassLiveQueryInput) =>
      queryClient.fetchQuery({
        ...overpassLiveQueryOptions(input),
        retry: false,
      }),
    retry: false,
  })

  const runLiveOverpass = useCallback(
    async (query: string, interpreterUrl: string) => {
      await mutation.mutateAsync({
        featureKey,
        query: query.trim(),
        interpreterUrl,
      })
    },
    [featureKey, mutation],
  )

  const resetLiveOverpass = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['overpass-live', featureKey], exact: false })
    mutation.reset()
  }, [featureKey, queryClient, mutation])

  const resetRunMutation = useCallback(() => {
    mutation.reset()
  }, [mutation])

  return {
    hits: liveData?.hits ?? [],
    geojson: liveData?.geojson ?? null,
    hasCachedData: liveData != null,
    isRunPending: mutation.isPending,
    runError: mutation.error,
    runLiveOverpass,
    resetLiveOverpass,
    resetRunMutation,
  }
}
