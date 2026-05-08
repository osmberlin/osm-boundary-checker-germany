import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { type OverpassRelationTagsQueryInput, overpassRelationTagsQueryOptions } from '../data/load'
import { DEFAULT_OVERPASS_INTERPRETER_URL } from '../lib/overpassServers'

type Status = 'idle' | 'loading' | 'done' | 'error'

const VALID_RELATION_ID = /^[0-9]+$/

export function useOverpassRelationTags(osmRelationIdRaw: string) {
  const queryClient = useQueryClient()
  const trimmed = osmRelationIdRaw.trim()
  const valid = VALID_RELATION_ID.test(trimmed)
  const relationId = valid ? Number(trimmed) : null

  const [activeInput, setActiveInput] = useState<OverpassRelationTagsQueryInput | null>(null)
  const inputForActiveRelation =
    activeInput != null && relationId != null && activeInput.relationId === relationId
      ? activeInput
      : null

  const query = useQuery({
    ...(inputForActiveRelation != null
      ? overpassRelationTagsQueryOptions(inputForActiveRelation)
      : overpassRelationTagsQueryOptions({
          relationId: relationId ?? 0,
          interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
        })),
    enabled: inputForActiveRelation != null,
    retry: false,
  })

  const run = useCallback(async () => {
    if (relationId == null) return
    const input: OverpassRelationTagsQueryInput = {
      relationId,
      interpreterUrl: DEFAULT_OVERPASS_INTERPRETER_URL,
    }
    setActiveInput(input)
    await queryClient.fetchQuery({
      ...overpassRelationTagsQueryOptions(input),
      retry: false,
    })
  }, [queryClient, relationId])

  const reset = useCallback(() => {
    setActiveInput(null)
  }, [])

  const status: Status =
    inputForActiveRelation == null
      ? 'idle'
      : query.isPending
        ? 'loading'
        : query.isError
          ? 'error'
          : 'done'

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
