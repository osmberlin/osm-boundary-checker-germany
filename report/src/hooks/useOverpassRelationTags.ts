import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { type OverpassOsmTagsQueryInput, overpassOsmTagsQueryOptions } from '../data/load'
import { parseReportRowOsmRef } from '../lib/osmObjectRef'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'

type Status = 'idle' | 'loading' | 'done' | 'error'

/** Placeholder input when `osmRelationIdRaw` is not a relation or way id — query stays disabled. */
const UNPARSED_INPUT: OverpassOsmTagsQueryInput = {
  kind: 'relation',
  id: 0,
  interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
}

/**
 * Observes the per-object Overpass tags cache (relation or way). Same pattern as
 * `useFeatureDetailOverpass`/`useFeatureDetailWfs`: the query is always
 * mounted with `enabled: false` and reads the shared TanStack cache, so
 * navigating back to a previously-loaded object shows the result without
 * a second click. `run()` triggers the fetch via `queryClient.fetchQuery`.
 *
 * Status derives from cache state alone — no external React state.
 */
export function useOverpassRelationTags(osmRelationIdRaw: string) {
  const queryClient = useQueryClient()
  const trimmed = osmRelationIdRaw.trim()
  const parsed = parseReportRowOsmRef(trimmed)
  const queryInput: OverpassOsmTagsQueryInput = parsed
    ? {
        kind: parsed.kind,
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
        kind: parsed.kind,
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
      kind: parsed.kind,
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
