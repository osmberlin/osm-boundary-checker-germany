import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import {
  overpassLiveQueryOptions,
  type OverpassLiveQueryData,
  type OverpassLiveQueryInput,
} from '../data/load'

export function useFeatureDetailOverpass(featureKey: string) {
  const queryClient = useQueryClient()
  const [overpassInput, setOverpassInput] = useState<OverpassLiveQueryInput | null>(null)

  const activeOverpassInput = useMemo(
    () => (overpassInput != null && overpassInput.featureKey === featureKey ? overpassInput : null),
    [featureKey, overpassInput],
  )

  const overpassQuery = useQuery({
    ...(activeOverpassInput != null
      ? overpassLiveQueryOptions(activeOverpassInput)
      : overpassLiveQueryOptions({
          featureKey,
          query: '',
          interpreterUrl: '',
        })),
    enabled: activeOverpassInput != null,
    retry: false,
  })

  const cachedOverpassData = useMemo(() => {
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
  }, [featureKey, queryClient])

  const overpassData = overpassQuery.data ?? cachedOverpassData

  const runOverpass = useCallback(
    async (query: string, interpreterUrl: string) => {
      const input: OverpassLiveQueryInput = {
        featureKey,
        query,
        interpreterUrl,
      }
      setOverpassInput(input)
      await queryClient.fetchQuery({
        ...overpassLiveQueryOptions(input),
        retry: false,
      })
    },
    [featureKey, queryClient],
  )

  const resetOverpass = useCallback(() => {
    setOverpassInput(null)
    queryClient.removeQueries({ queryKey: ['overpass-live', featureKey], exact: false })
  }, [featureKey, queryClient])

  return {
    hasData: overpassData != null,
    hits: overpassData?.hits ?? [],
    geojson: overpassData?.geojson ?? null,
    runOverpass,
    resetOverpass,
  }
}
