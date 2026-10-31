import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { readLiveOsmCache, writeLiveOsmCache } from '../lib/liveOsmCache'

/**
 * A search in the map view, one per page. The query only restores the stored answer; a request
 * starts from `run`, because the answer depends on the view at that moment. The mutation lives in
 * the component that calls this, so pass its result down instead of calling this twice for `run`.
 */
export function useLiveBboxSearch<TResult, TInput>(
  cacheKey: string,
  search: (input: TInput) => Promise<TResult>,
) {
  const queryClient = useQueryClient()
  const queryKey = ['live-osm-search', cacheKey]

  const { data } = useQuery({
    queryKey,
    queryFn: async () => (await readLiveOsmCache<TResult>(cacheKey))?.value ?? null,
    networkMode: 'always',
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const mutation = useMutation({
    mutationFn: search,
    onSuccess: (result) => {
      writeLiveOsmCache(cacheKey, result)
      queryClient.setQueryData(queryKey, result)
    },
  })

  return {
    data: data ?? null,
    isRunPending: mutation.isPending,
    runError: mutation.error,
    /** Errors land in `runError`. */
    run: (input: TInput) => mutation.mutate(input),
  }
}
