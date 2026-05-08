import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
  overpassLiveQueryOptions,
  type OverpassLiveQueryData,
  type OverpassLiveQueryInput,
} from '../data/load'

const LIVE_STALE_TIME_MS = Number.POSITIVE_INFINITY

function pickLatestCommittedInputFromCache(
  queryClient: QueryClient,
  featureKey: string,
): OverpassLiveQueryInput | null {
  const cachedQueries = queryClient
    .getQueryCache()
    .findAll({ queryKey: ['overpass-live', featureKey], exact: false })

  let latest: { input: OverpassLiveQueryInput; updatedAt: number } | null = null

  for (const query of cachedQueries) {
    const key = query.queryKey
    if (!Array.isArray(key) || key.length !== 4) continue
    if (key[0] !== 'overpass-live' || key[1] !== featureKey) continue
    if (query.state.status !== 'success') continue
    const data = query.state.data as OverpassLiveQueryData | undefined
    if (data == null) continue
    const updatedAt = query.state.dataUpdatedAt ?? 0
    if (!latest || updatedAt > latest.updatedAt) {
      latest = {
        input: {
          featureKey: key[1] as string,
          interpreterUrl: key[2] as string,
          query: key[3] as string,
        },
        updatedAt,
      }
    }
  }

  return latest?.input ?? null
}

export function useFeatureDetailOverpass(featureKey: string) {
  const queryClient = useQueryClient()
  const [committedInput, setCommittedInput] = useState<OverpassLiveQueryInput | null>(() =>
    pickLatestCommittedInputFromCache(queryClient, featureKey),
  )

  const placeholderInput: OverpassLiveQueryInput = {
    featureKey,
    query: '',
    interpreterUrl: '',
  }

  const activeInput = committedInput ?? placeholderInput

  const overpassQuery = useQuery({
    ...overpassLiveQueryOptions(activeInput),
    enabled: committedInput != null,
    staleTime: LIVE_STALE_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const runLiveOverpass = useCallback(
    async (query: string, interpreterUrl: string) => {
      const input: OverpassLiveQueryInput = {
        featureKey,
        query: query.trim(),
        interpreterUrl,
      }
      setCommittedInput(input)
      try {
        await queryClient.fetchQuery({
          ...overpassLiveQueryOptions(input),
          staleTime: LIVE_STALE_TIME_MS,
          retry: false,
        })
      } catch {
        /* overpassQuery.error + LiveSourceProperties draft UI */
      }
    },
    [featureKey, queryClient],
  )

  const resetLiveOverpass = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['overpass-live', featureKey], exact: false })
    setCommittedInput(null)
  }, [featureKey, queryClient])

  const resetRunMutation = useCallback(() => {
    if (committedInput == null) return
    const queryKey = overpassLiveQueryOptions(committedInput).queryKey
    if (queryClient.getQueryState(queryKey)?.status === 'error') {
      queryClient.removeQueries({ queryKey, exact: true })
      setCommittedInput(null)
    }
  }, [committedInput, queryClient])

  return {
    hits: overpassQuery.data?.hits ?? [],
    geojson: overpassQuery.data?.geojson ?? null,
    hasCachedData: overpassQuery.isSuccess,
    isRunPending: overpassQuery.isPending,
    runError: overpassQuery.error,
    runLiveOverpass,
    resetLiveOverpass,
    resetRunMutation,
  }
}
