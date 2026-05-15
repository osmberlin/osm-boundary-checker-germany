import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { type OverpassOsmTagsQueryInput, overpassOsmTagsQueryOptions } from '../data/load'
import { parseReportRowOsmRef } from '../lib/osmObjectRef'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'

type Status = 'idle' | 'loading' | 'done' | 'error'

/** Placeholder when `osmRelationIdRaw` is not a relation id — query stays disabled. */
const UNPARSED_INPUT: OverpassOsmTagsQueryInput = {
  id: 0,
  interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
}

/**
 * Observes the per-relation Overpass tags cache. Same pattern as
 * `useFeatureDetailOverpass`/`useFeatureDetailWfs`: the query is always
 * mounted with `enabled: false` and reads the shared TanStack cache, so
 * navigating back to a previously-loaded relation shows the result without
 * a second click. `run()` triggers the fetch via `queryClient.fetchQuery`.
 */
export function useOverpassRelationTags(osmRelationIdRaw: string) {
  const queryClient = useQueryClient()
  const trimmed = osmRelationIdRaw.trim()
  const parsed = parseReportRowOsmRef(trimmed)
  const queryInput: OverpassOsmTagsQueryInput = parsed
    ? {
        id: parsed.numericId,
        interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
      }
    : UNPARSED_INPUT

  const query = useQuery({
    ...overpassOsmTagsQueryOptions(queryInput),
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const run = useCallback(async () => {
    if (parsed == null) return
    await queryClient.fetchQuery({
      ...overpassOsmTagsQueryOptions({
        id: parsed.numericId,
        interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
      }),
      staleTime: Number.POSITIVE_INFINITY,
      retry: false,
    })
  }, [queryClient, parsed])

  const reset = useCallback(() => {
    if (parsed == null) return
    const queryKey = overpassOsmTagsQueryOptions({
      id: parsed.numericId,
      interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
    }).queryKey
    queryClient.removeQueries({ queryKey, exact: true })
  }, [queryClient, parsed])

  const status: Status =
    parsed == null
      ? 'idle'
      : query.data
        ? 'done'
        : query.isFetching
          ? 'loading'
          : query.isError
            ? 'error'
            : 'idle'

  return {
    canRun: parsed != null,
    status,
    tags: query.data?.tags ?? null,
    replicationDate: query.data?.replicationDate ?? null,
    error: query.isError ? query.error : null,
    run,
    reset,
  }
}
