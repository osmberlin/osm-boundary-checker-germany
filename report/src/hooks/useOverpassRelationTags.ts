import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { type OverpassRelationTagsQueryInput, overpassRelationTagsQueryOptions } from '../data/load'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'

type Status = 'idle' | 'loading' | 'done' | 'error'

const VALID_RELATION_ID = /^[0-9]+$/
const LIVE_STALE_TIME_MS = Number.POSITIVE_INFINITY

/**
 * Observes the per-relation Overpass tags cache. Same pattern as
 * `useFeatureDetailOverpass`/`useFeatureDetailWfs`: the query is always
 * mounted with `enabled: false` and reads the shared TanStack cache, so
 * navigating back to a previously-loaded relation shows the result without
 * a second click. `run()` triggers the fetch via `queryClient.fetchQuery`.
 *
 * Status derives from cache state alone — no external React state.
 */
export function useOverpassRelationTags(osmRelationIdRaw: string) {
  const queryClient = useQueryClient()
  const trimmed = osmRelationIdRaw.trim()
  const valid = VALID_RELATION_ID.test(trimmed)
  const relationId = valid ? Number(trimmed) : null

  // Hooks must be called unconditionally; for invalid IDs we observe a dummy
  // key and clamp the public status to `idle` below.
  const queryInput: OverpassRelationTagsQueryInput = {
    relationId: relationId ?? 0,
    interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
  }
  const query = useQuery({
    ...overpassRelationTagsQueryOptions(queryInput),
    enabled: false,
    staleTime: LIVE_STALE_TIME_MS,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    retry: false,
  })

  const run = useCallback(async () => {
    if (relationId == null) return
    await queryClient.fetchQuery({
      ...overpassRelationTagsQueryOptions({
        relationId,
        interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
      }),
      staleTime: LIVE_STALE_TIME_MS,
      retry: false,
    })
  }, [queryClient, relationId])

  const reset = useCallback(() => {
    if (relationId == null) return
    const queryKey = overpassRelationTagsQueryOptions({
      relationId,
      interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
    }).queryKey
    queryClient.removeQueries({ queryKey, exact: true })
  }, [queryClient, relationId])

  // `isFetching` (not `isPending`): the latter is true forever for
  // `enabled: false` queries that have never received data.
  const status: Status =
    relationId == null
      ? 'idle'
      : query.data
        ? 'done'
        : query.isFetching
          ? 'loading'
          : query.isError
            ? 'error'
            : 'idle'

  return {
    canRun: relationId != null,
    status,
    tags: query.data?.tags ?? null,
    replicationDate: query.data?.replicationDate ?? null,
    error: query.isError ? query.error : null,
    run,
    reset,
  }
}
