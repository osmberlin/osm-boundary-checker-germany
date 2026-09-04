import { describe, expect, test } from 'bun:test'
import {
  candidateMatchSchema,
  comparisonForReportSchema,
  featureDetailShardSchema,
  reportRowSchema,
  unmatchedOsmRowSchema,
} from './comparisonPayload.ts'

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

describe('comparisonForReportSchema', () => {
  test('defaults filterConfigSummary.minZoom to 0 when absent (pre-refresh artifacts)', () => {
    const parsed = comparisonForReportSchema.parse({
      area: 'demo',
      displayName: 'Demo',
      titlePrefix: 'T',
      generatedAt: '2026-01-01T00:00:00.000Z',
      metricsCrs: 'EPSG:25832',
      hasPmtiles: true,
      tippecanoeLayer: 'comparison',
      sourceMetadata: {
        official: {
          sourcePublicUrl: 'https://example.com/source',
          sourceDownloadUrl: 'https://example.com/download',
        },
        osm: {},
      },
      filterConfigSummary: {
        officialMatchProperty: 'id',
        bboxFilter: 'none',
        osmScopeFilter: 'none',
      },
      rows: [],
      unmatchedOsm: [],
    })
    expect(parsed.filterConfigSummary.minZoom).toBe(0)
  })
})

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

describe('staleOfficialKey fields', () => {
  test('old artifacts without stale fields still parse', () => {
    const parsed = reportRowSchema.parse(validRow)
    expect(parsed.staleOfficialKey).toBeUndefined()
    const unmatched = unmatchedOsmRowSchema.parse({
      canonicalMatchKey: 'k2',
      nameLabel: 'OSM',
      osmRelationId: '1',
      adminLevel: '8',
      mapBbox: null,
    })
    expect(unmatched.staleOfficialPredecessor).toBeUndefined()
  })

  test('accepts staleOfficialKey on official-only rows', () => {
    const parsed = reportRowSchema.parse({
      ...validRow,
      staleOfficialKey: {
        toArs: '010575785008',
        source: 'ags_candidate',
        pairedUnmatchedKey: '010575785008',
      },
    })
    expect(parsed.staleOfficialKey?.toArs).toBe('010575785008')
  })

  test('accepts osm_map staleOfficialKey source on matched rows', () => {
    const parsed = reportRowSchema.parse({
      ...validRow,
      category: 'matched',
      staleOfficialKey: {
        toArs: '160770043043',
        source: 'osm_map',
      },
    })
    expect(parsed.staleOfficialKey?.source).toBe('osm_map')
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
