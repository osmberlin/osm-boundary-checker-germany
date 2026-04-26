import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { overpassLiveQueryOptions, type OverpassLiveQueryInput } from '../data/load'

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
  }, [])

  return {
    hits: overpassQuery.data?.hits ?? [],
    geojson: overpassQuery.data?.geojson ?? null,
    runOverpass,
    resetOverpass,
  }
}
