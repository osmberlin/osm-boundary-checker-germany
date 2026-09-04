import { z } from 'zod'

export const relationResolverCandidateSchema = z.object({
  dataset: z.string(),
  areaId: z.string(),
  featureKey: z.string(),
  featureName: z.string(),
})
export type RelationResolverCandidate = z.infer<typeof relationResolverCandidateSchema>

export const relationResolverIndexSchema = z.object({
  byRelationId: z.record(z.string(), z.array(relationResolverCandidateSchema)),
})
export type RelationResolverIndex = z.infer<typeof relationResolverIndexSchema>

export type RelationResolverDecision =
  | {
      kind: 'not_found'
      candidates: []
      requestedDataset: string | null
    }
  | {
      kind: 'redirect'
      candidate: RelationResolverCandidate
      candidates: RelationResolverCandidate[]
      requestedDataset: string | null
    }
  | {
      kind: 'list'
      candidates: RelationResolverCandidate[]
      requestedDataset: string | null
    }

type ResolveRelationArgs = {
  candidates: RelationResolverCandidate[]
  dataset: string | undefined
}

export function decideRelationResolution(args: ResolveRelationArgs): RelationResolverDecision {
  const requestedDataset = args.dataset?.trim() || null
  const candidates = args.candidates
  if (candidates.length === 0) {
    return { kind: 'not_found', candidates: [], requestedDataset }
  }

  if (requestedDataset) {
    const matchingDataset = candidates.filter((candidate) => candidate.dataset === requestedDataset)
    if (matchingDataset.length === 1) {
      const [candidate] = matchingDataset
      if (!candidate) return { kind: 'list', candidates, requestedDataset }
      return {
        kind: 'redirect',
        candidate,
        candidates,
        requestedDataset,
      }
    }
    return { kind: 'list', candidates, requestedDataset }
  }

  if (candidates.length === 1) {
    const [candidate] = candidates
    if (!candidate) return { kind: 'list', candidates, requestedDataset: null }
    return {
      kind: 'redirect',
      candidate,
      candidates,
      requestedDataset: null,
    }
  }

  return { kind: 'list', candidates, requestedDataset: null }
}
