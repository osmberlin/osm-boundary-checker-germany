import { describe, expect, it } from 'vitest'
import { decideRelationResolution, type RelationResolverCandidate } from './relationResolver'

const CANDIDATES: RelationResolverCandidate[] = [
  {
    dataset: 'berlin-bezirke',
    areaId: 'berlin-bezirke',
    featureKey: '11000002',
    featureName: 'Friedrichshain-Kreuzberg',
  },
  {
    dataset: 'de-gemeinden-bb',
    areaId: 'de-gemeinden-bb',
    featureKey: '120600000000',
    featureName: 'Brandenburg an der Havel',
  },
]

describe('decideRelationResolution', () => {
  it('returns not_found without candidates', () => {
    const result = decideRelationResolution({ candidates: [], dataset: undefined })
    expect(result.kind).toBe('not_found')
  })

  it('redirects when exactly one candidate exists and no dataset is provided', () => {
    const result = decideRelationResolution({ candidates: [CANDIDATES[0]!], dataset: undefined })
    expect(result.kind).toBe('redirect')
    if (result.kind !== 'redirect') return
    expect(result.candidate.dataset).toBe('berlin-bezirke')
  })

  it('lists when multiple candidates exist and no dataset is provided', () => {
    const result = decideRelationResolution({ candidates: CANDIDATES, dataset: undefined })
    expect(result.kind).toBe('list')
  })

  it('redirects when dataset filters to exactly one candidate', () => {
    const result = decideRelationResolution({ candidates: CANDIDATES, dataset: 'de-gemeinden-bb' })
    expect(result.kind).toBe('redirect')
    if (result.kind !== 'redirect') return
    expect(result.candidate.featureKey).toBe('120600000000')
  })

  it('lists when dataset has no match but other candidates exist', () => {
    const result = decideRelationResolution({ candidates: CANDIDATES, dataset: 'de-gemeinden-by' })
    expect(result.kind).toBe('list')
    if (result.kind !== 'list') return
    expect(result.candidates).toHaveLength(2)
  })
})
