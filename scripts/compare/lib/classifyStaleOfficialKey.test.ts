import { describe, expect, test } from 'bun:test'
import type { Polygon } from 'geojson'
import { parseArsSuccessorTable } from '../../shared/arsSuccessorTable.ts'
import {
  applyStaleOfficialKeyClassification,
  classifyStaleOfficialKey,
  promoteStaleOfficialRows,
  uniqueOsmMapArsByAgs8,
  type ClassifiableOfficialRow,
  type ClassifiableUnmatchedRow,
  type DestatisArsPresence,
  type StalePromoteRow,
} from './classifyStaleOfficialKey.ts'
import type { CandidateMatch } from './matchCandidates.ts'

const successors = parseArsSuccessorTable({
  successors: [
    {
      fromArs: '064350014014',
      toArs: '064150000000',
      validFrom: '2026-01-01',
      kind: 'kreisfrei',
      note: 'Hanau wurde kreisfreie Stadt und verließ den Main-Kinzig-Kreis.',
    },
  ],
})

const destatis: DestatisArsPresence = {
  isLatestGemeindeArs: (ars) =>
    ars === '010575785008' || ars === '160770043043' || ars === '064150000000',
  isObsoleteGemeindeArs: (ars) =>
    ars === '010570008008' ||
    ars === '160775052043' ||
    ars === '010539105105' ||
    ars === '064350014014',
}

function candidate(deRegionalRaw: string, deAgsRaw?: string): CandidateMatch {
  return {
    osmType: 'relation',
    osmId: '1',
    name: 'Demo',
    adminLevel: '8',
    deRegionalRaw,
    deAgsRaw: deAgsRaw ?? null,
  }
}

describe('classifyStaleOfficialKey', () => {
  test('Bönebüttel-like association change uses the spatial candidate', () => {
    const stale = classifyStaleOfficialKey({
      officialArs: '010570008008',
      candidates: [candidate('010575785008', '01057008')],
      destatis,
      successors,
    })
    expect(stale).toEqual({ toArs: '010575785008', source: 'ags_candidate' })
  })

  test('derives candidate AGS from ARS when deAgsRaw is missing', () => {
    const stale = classifyStaleOfficialKey({
      officialArs: '160775052043',
      candidates: [candidate('160770043043')],
      destatis,
      successors,
    })
    expect(stale?.source).toBe('ags_candidate')
    expect(stale?.toArs).toBe('160770043043')
  })

  test('Hanau-like table hit when there is no candidate', () => {
    const stale = classifyStaleOfficialKey({
      officialArs: '064350014014',
      candidates: [],
      destatis,
      successors,
    })
    expect(stale).toEqual({ toArs: '064150000000', source: 'successor_table' })
  })

  test('obsolete official with empty candidates and no table row stays a gap', () => {
    expect(
      classifyStaleOfficialKey({
        officialArs: '010539105105',
        candidates: [],
        destatis,
        successors,
      }),
    ).toBeUndefined()
  })

  test('current official ARS without a table row stays a gap', () => {
    expect(
      classifyStaleOfficialKey({
        officialArs: '010010000000',
        candidates: [candidate('010575785008')],
        destatis: {
          isLatestGemeindeArs: (ars) => ars === '010010000000',
          isObsoleteGemeindeArs: () => false,
        },
        successors,
      }),
    ).toBeUndefined()
  })

  test('unique osmMap AGS successor is used when spatial candidates miss', () => {
    const stale = classifyStaleOfficialKey({
      officialArs: '160775052043',
      candidates: [],
      destatis,
      successors,
      uniqueOsmMapByAgs8: uniqueOsmMapArsByAgs8(['160770043043']),
    })
    expect(stale).toEqual({ toArs: '160770043043', source: 'osm_map' })
  })

  test('spatial candidate still wins over osmMap', () => {
    const stale = classifyStaleOfficialKey({
      officialArs: '010570008008',
      candidates: [candidate('010575785008', '01057008')],
      destatis,
      successors,
      uniqueOsmMapByAgs8: uniqueOsmMapArsByAgs8(['010575785008']),
    })
    expect(stale?.source).toBe('ags_candidate')
  })

  test('two osmMap keys with the same AGS are not unique', () => {
    expect(
      classifyStaleOfficialKey({
        officialArs: '160775052043',
        candidates: [],
        destatis,
        successors,
        uniqueOsmMapByAgs8: uniqueOsmMapArsByAgs8(['160770043043', '160775052043']),
      }),
    ).toBeUndefined()
  })
})

describe('uniqueOsmMapArsByAgs8', () => {
  test('keeps only AGS values with exactly one ARS', () => {
    const unique = uniqueOsmMapArsByAgs8([
      '160770043043',
      '010575785008',
      '010575785008',
      '010570008008',
    ])
    expect(unique.get('16077043')).toBe('160770043043')
    expect(unique.has('01057008')).toBe(false)
  })
})

describe('applyStaleOfficialKeyClassification', () => {
  test('pairs same-area unmatched OSM with the official-only predecessor', () => {
    const rows: ClassifiableOfficialRow[] = [
      {
        category: 'official_only',
        canonicalMatchKey: '010570008008',
        candidates: [candidate('010575785008', '01057008')],
      },
    ]
    const unmatchedOsm: ClassifiableUnmatchedRow[] = [{ canonicalMatchKey: '010575785008' }]
    applyStaleOfficialKeyClassification({
      preset: 'regional-12',
      rows,
      unmatchedOsm,
      destatis,
      successors,
    })
    expect(rows[0]?.staleOfficialKey).toEqual({
      toArs: '010575785008',
      source: 'ags_candidate',
      pairedUnmatchedKey: '010575785008',
    })
    expect(unmatchedOsm[0]?.staleOfficialPredecessor).toEqual({ fromArs: '010570008008' })
  })

  test('skips non regional-12 presets', () => {
    const rows: ClassifiableOfficialRow[] = [
      {
        category: 'official_only',
        canonicalMatchKey: '010570008008',
        candidates: [candidate('010575785008', '01057008')],
      },
    ]
    applyStaleOfficialKeyClassification({
      preset: 'plz-5',
      rows,
      unmatchedOsm: [],
      destatis,
      successors,
    })
    expect(rows[0]?.staleOfficialKey).toBeUndefined()
  })

  test('classifies a unique osmMap AGS successor when candidates are empty', () => {
    const rows: ClassifiableOfficialRow[] = [
      {
        category: 'official_only',
        canonicalMatchKey: '160775052043',
      },
    ]
    const unmatchedOsm: ClassifiableUnmatchedRow[] = [{ canonicalMatchKey: '160770043043' }]
    applyStaleOfficialKeyClassification({
      preset: 'regional-12',
      rows,
      unmatchedOsm,
      destatis,
      successors,
      osmMapArs: ['160770043043'],
    })
    expect(rows[0]?.staleOfficialKey).toEqual({
      toArs: '160770043043',
      source: 'osm_map',
      pairedUnmatchedKey: '160770043043',
    })
  })

  test('does not classify when the successor ARS is already an official key', () => {
    const rows: ClassifiableOfficialRow[] = [
      {
        category: 'official_only',
        canonicalMatchKey: '160775052043',
      },
      {
        category: 'matched',
        canonicalMatchKey: '160770043043',
      },
    ]
    applyStaleOfficialKeyClassification({
      preset: 'regional-12',
      rows,
      unmatchedOsm: [],
      destatis,
      successors,
      osmMapArs: ['160770043043'],
    })
    expect(rows[0]?.staleOfficialKey).toBeUndefined()
  })

  test('skips both official rows when they claim the same successor', () => {
    const destatisMerger: DestatisArsPresence = {
      isLatestGemeindeArs: (ars) => ars === '160770043043',
      isObsoleteGemeindeArs: (ars) => ars === '160775052043' || ars === '160770000043',
    }
    const rows: ClassifiableOfficialRow[] = [
      { category: 'official_only', canonicalMatchKey: '160775052043' },
      { category: 'official_only', canonicalMatchKey: '160770000043' },
    ]
    applyStaleOfficialKeyClassification({
      preset: 'regional-12',
      rows,
      unmatchedOsm: [],
      destatis: destatisMerger,
      successors,
      osmMapArs: ['160770043043'],
    })
    expect(rows[0]?.staleOfficialKey).toBeUndefined()
    expect(rows[1]?.staleOfficialKey).toBeUndefined()
  })
})

const square: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
}

describe('promoteStaleOfficialRows', () => {
  test('attaches successor OSM geom, drops the unmatched twin, and clears the pair key', () => {
    const rows: StalePromoteRow[] = [
      {
        category: 'official_only',
        canonicalMatchKey: '010570008008',
        nameLabel: '010570008008',
        osmRelationId: '',
        officialGeometryWgs84: square,
        osmGeometryWgs84: null,
        osmProperties: null,
        candidates: [candidate('010575785008', '01057008')],
        staleOfficialKey: {
          toArs: '010575785008',
          source: 'ags_candidate',
          pairedUnmatchedKey: '010575785008',
        },
      },
    ]
    const unmatchedOsm = [{ canonicalMatchKey: '010575785008' }]
    const osmByArs = new Map([
      [
        '010575785008',
        {
          geometry: square,
          featureIds: ['relation/99'],
          properties: { name: 'Bönebüttel' },
        },
      ],
    ])
    const promoted = promoteStaleOfficialRows({
      rows,
      unmatchedOsm,
      osmByArs,
      osmNameByKey: new Map([['010575785008', 'Bönebüttel']]),
      pickRelationId: (ids) => ids[0]?.replace('relation/', '') ?? '',
    })
    expect(promoted).toEqual([0])
    expect(rows[0]?.category).toBe('matched')
    expect(rows[0]?.osmRelationId).toBe('99')
    expect(rows[0]?.nameLabel).toBe('Bönebüttel')
    expect(rows[0]?.candidates).toBeUndefined()
    expect(rows[0]?.staleOfficialKey).toEqual({
      toArs: '010575785008',
      source: 'ags_candidate',
    })
    expect(unmatchedOsm).toEqual([])
  })

  test('leaves official-only + banner when successor geometry is missing', () => {
    const rows: StalePromoteRow[] = [
      {
        category: 'official_only',
        canonicalMatchKey: '064350014014',
        nameLabel: 'Hanau',
        osmRelationId: '',
        officialGeometryWgs84: square,
        osmGeometryWgs84: null,
        osmProperties: null,
        staleOfficialKey: { toArs: '064150000000', source: 'successor_table' },
      },
    ]
    const unmatchedOsm = [{ canonicalMatchKey: '064150000000' }]
    const promoted = promoteStaleOfficialRows({
      rows,
      unmatchedOsm,
      osmByArs: new Map(),
      osmNameByKey: new Map(),
      pickRelationId: () => '',
    })
    expect(promoted).toEqual([])
    expect(rows[0]?.category).toBe('official_only')
    expect(unmatchedOsm).toHaveLength(1)
  })
})
