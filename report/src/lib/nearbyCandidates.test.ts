import { describe, expect, test } from 'vitest'
import type { CandidateMatch } from '../types/report'
import { nearbyCandidates } from './nearbyCandidates'

const known: CandidateMatch = { osmType: 'relation', osmId: '1', name: 'Bekannt' }

describe('nearbyCandidates', () => {
  test('drops listed candidates and nodes, maps tags to candidate fields', () => {
    const result = nearbyCandidates(
      [
        { type: 'relation', id: 1, tags: { name: 'Bekannt' } },
        { type: 'way', id: 2, tags: { name: 'Neu', admin_level: '6', postal_code: '10115' } },
        { type: 'node', id: 3, tags: {} },
      ],
      [known],
    )
    expect(result).toEqual([
      {
        osmType: 'way',
        osmId: '2',
        name: 'Neu',
        adminLevel: '6',
        deRegionalRaw: null,
        postalCodeRaw: '10115',
        tags: { name: 'Neu', admin_level: '6', postal_code: '10115' },
      },
    ])
  })
})
