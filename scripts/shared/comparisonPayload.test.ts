import { describe, expect, test } from 'bun:test'
import { candidateMatchSchema, featureDetailShardSchema } from './comparisonPayload.ts'

const validRow = {
  canonicalMatchKey: 'k1',
  nameLabel: 'Demo',
  category: 'official_only' as const,
  osmRelationId: '',
  metrics: null,
  mapBbox: null,
  officialForEditPath: null,
  officialProperties: null,
  osmProperties: null,
}

describe('candidateMatchSchema', () => {
  test('accepts a minimal admin candidate (only required fields)', () => {
    const parsed = candidateMatchSchema.parse({
      osmType: 'way',
      osmId: '12345',
      name: 'Foo',
    })
    expect(parsed.osmType).toBe('way')
    expect(parsed.osmId).toBe('12345')
  })

  test('accepts admin candidate with all admin-side fields', () => {
    const parsed = candidateMatchSchema.parse({
      osmType: 'relation',
      osmId: '999',
      name: null,
      adminLevel: '8',
      deRegionalRaw: '050000000000',
      deAgsRaw: '05000000',
    })
    expect(parsed.deRegionalRaw).toBe('050000000000')
  })

  test('accepts postal_code candidate with postalCodeRaw', () => {
    const parsed = candidateMatchSchema.parse({
      osmType: 'relation',
      osmId: '7',
      name: 'PLZ 13585',
      postalCodeRaw: '13585',
    })
    expect(parsed.postalCodeRaw).toBe('13585')
  })

  test('rejects missing osmType', () => {
    expect(() =>
      candidateMatchSchema.parse({
        osmId: '12',
        name: null,
      }),
    ).toThrow()
  })

  test('rejects unknown osmType values', () => {
    expect(() =>
      candidateMatchSchema.parse({
        osmType: 'node',
        osmId: '12',
        name: null,
      }),
    ).toThrow()
  })

  test('rejects unknown extra keys (strict)', () => {
    expect(() =>
      candidateMatchSchema.parse({
        osmType: 'way',
        osmId: '12',
        name: null,
        unexpectedExtra: 'no',
      }),
    ).toThrow()
  })
})

describe('featureDetailShardSchema', () => {
  test('row-only shard parses without candidates', () => {
    const parsed = featureDetailShardSchema.parse({ row: validRow })
    expect(parsed.candidates).toBeUndefined()
  })

  test('shard accepts an empty candidates array', () => {
    const parsed = featureDetailShardSchema.parse({ row: validRow, candidates: [] })
    expect(parsed.candidates).toEqual([])
  })

  test('shard accepts a populated candidates array', () => {
    const parsed = featureDetailShardSchema.parse({
      row: validRow,
      candidates: [
        { osmType: 'way', osmId: '1', name: null, adminLevel: '8' },
        { osmType: 'relation', osmId: '2', name: 'Demo', postalCodeRaw: '13585' },
      ],
    })
    expect(parsed.candidates).toHaveLength(2)
  })

  test('shard rejects malformed candidate entries', () => {
    expect(() =>
      featureDetailShardSchema.parse({
        row: validRow,
        candidates: [{ osmType: 'way', osmId: '' }],
      }),
    ).toThrow()
  })
})
