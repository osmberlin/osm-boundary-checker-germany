import { describe, expect, test } from 'bun:test'
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson'
import {
  type CandidateMatch,
  matchCandidatesForOfficialOnly,
  type OfficialOnlyInput,
  selectEligibleCandidates,
  shrinkOfficialPolygon,
} from './matchCandidates.ts'

function squarePolygon(centerLng: number, centerLat: number, halfSize: number): Polygon {
  const w = centerLng - halfSize
  const e = centerLng + halfSize
  const s = centerLat - halfSize
  const n = centerLat + halfSize
  return {
    type: 'Polygon',
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  }
}

function multiPolygonOfTwoSquares(): MultiPolygon {
  return {
    type: 'MultiPolygon',
    coordinates: [
      // Mainland (around 10, 52)
      [
        [
          [9.5, 51.5],
          [10.5, 51.5],
          [10.5, 52.5],
          [9.5, 52.5],
          [9.5, 51.5],
        ],
      ],
      // Disjoint island (around 13, 54)
      [
        [
          [12.9, 53.9],
          [13.1, 53.9],
          [13.1, 54.1],
          [12.9, 54.1],
          [12.9, 53.9],
        ],
      ],
    ],
  }
}

function pointFeature(lng: number, lat: number, props: Record<string, unknown>): Feature<Point> {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [lng, lat] },
    properties: props,
  }
}

const ADMIN_OPTIONS_DEFAULT = {
  idNormalizationPreset: 'regional-12' as const,
  osmProfileId: 'admin_rs' as const,
  osmMatchProperty: 'de:regionalschluessel',
}

describe('shrinkOfficialPolygon', () => {
  test('shrinks a square around its centroid', () => {
    const original = squarePolygon(10, 50, 1)
    const shrunk = shrinkOfficialPolygon(original, 0.7) as Polygon
    expect(shrunk.type).toBe('Polygon')
    const ring = shrunk.coordinates[0]!
    const minLng = Math.min(...ring.map((c) => c[0]!))
    const maxLng = Math.max(...ring.map((c) => c[0]!))
    expect(maxLng - minLng).toBeGreaterThan(1.39)
    expect(maxLng - minLng).toBeLessThan(1.41)
  })

  test('returns the original polygon for shrinkFactor=1', () => {
    const original = squarePolygon(0, 0, 1)
    const shrunk = shrinkOfficialPolygon(original, 1)
    expect(shrunk).toBe(original)
  })

  test('returns the original polygon for invalid shrink factors', () => {
    const original = squarePolygon(0, 0, 1)
    expect(shrinkOfficialPolygon(original, 0)).toBe(original)
    expect(shrinkOfficialPolygon(original, -0.5)).toBe(original)
    expect(shrinkOfficialPolygon(original, 1.5)).toBe(original)
  })
})

describe('matchCandidatesForOfficialOnly — admin profile', () => {
  test('point inside the shrunk polygon is reported as a candidate', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: '120010000000', officialGeometryWgs84: squarePolygon(10, 50, 1) },
    ]
    const candidates = [
      pointFeature(10, 50, {
        osm_id: '12345',
        admin_level: '8',
        name: 'Inner',
      }),
    ]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set([]),
      candidatePoints: candidates,
      options: { ...ADMIN_OPTIONS_DEFAULT, shrinkFactor: 0.7 },
    })
    const matches = result.get('120010000000') ?? []
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      osmType: 'way',
      osmId: '12345',
      name: 'Inner',
      adminLevel: '8',
    })
  })

  test('shrink factor: point near the edge falls outside the shrunk polygon', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: 'k1', officialGeometryWgs84: squarePolygon(10, 50, 1) },
    ]
    // Point at lng=10.85 is inside the original (extends to 11.0) but outside the
    // 0.7-shrunk square (extends to ~10.7).
    const candidates = [pointFeature(10.85, 50, { osm_id: '999', admin_level: '8' })]
    const inside = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set([]),
      candidatePoints: candidates,
      options: { ...ADMIN_OPTIONS_DEFAULT, shrinkFactor: 1 },
    })
    expect(inside.get('k1') ?? []).toHaveLength(1)
    const outside = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set([]),
      candidatePoints: candidates,
      options: { ...ADMIN_OPTIONS_DEFAULT, shrinkFactor: 0.7 },
    })
    expect(outside.get('k1') ?? []).toHaveLength(0)
  })

  test('candidate whose canonical key belongs to another official unit is excluded', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: 'k1', officialGeometryWgs84: squarePolygon(10, 50, 1) },
    ]
    const officialKeySet = new Set(['012345678901', '120010000000'])
    const candidates = [
      pointFeature(10, 50, {
        osm_id: '1',
        admin_level: '8',
        'de:regionalschluessel': '012345678901',
      }),
      pointFeature(10.05, 50.05, {
        osm_id: '2',
        admin_level: '8',
        'de:regionalschluessel': '999988887777',
      }),
    ]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet,
      candidatePoints: candidates,
      options: ADMIN_OPTIONS_DEFAULT,
    })
    const matches = result.get('k1') ?? []
    expect(matches.map((m) => m.osmId)).toEqual(['2'])
  })

  test('candidate with same canonical RS as this official_only row is kept (recovery)', () => {
    const rowKey = '130725259085'
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: rowKey, officialGeometryWgs84: squarePolygon(10, 50, 1) },
    ]
    const officialKeySet = new Set([rowKey, '010040000000'])
    const candidates = [
      pointFeature(10, 50, {
        osm_id: '-394331',
        admin_level: '8',
        name: 'Rerik',
        'de:regionalschluessel': '130725259085',
      }),
    ]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet,
      candidatePoints: candidates,
      options: ADMIN_OPTIONS_DEFAULT,
    })
    const matches = result.get(rowKey) ?? []
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({
      osmType: 'relation',
      osmId: '394331',
      name: 'Rerik',
      deRegionalRaw: '130725259085',
    })
  })

  test('multipolygon official: point inside one of the disjoint pieces matches', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: 'land', officialGeometryWgs84: multiPolygonOfTwoSquares() },
    ]
    // Point inside the island (13, 54) must match because the island is part of the
    // official multipolygon. We use shrinkFactor=1 (no shrink) so the test stays
    // independent of how `transformScale` chooses the origin for disjoint pieces.
    const candidates = [pointFeature(13, 54, { osm_id: '7', admin_level: '6' })]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set([]),
      candidatePoints: candidates,
      options: { ...ADMIN_OPTIONS_DEFAULT, shrinkFactor: 1 },
    })
    expect((result.get('land') ?? []).map((m) => m.osmId)).toEqual(['7'])
  })

  test('rows without polygonal geometry yield empty candidate arrays', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: 'no_geom', officialGeometryWgs84: null },
    ]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set([]),
      candidatePoints: [pointFeature(10, 50, { osm_id: '1', admin_level: '8' })],
      options: ADMIN_OPTIONS_DEFAULT,
    })
    expect(result.get('no_geom')).toEqual([])
  })

  test('returns one entry per row, even when no candidates match', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: 'k1', officialGeometryWgs84: squarePolygon(10, 50, 1) },
      { canonicalMatchKey: 'k2', officialGeometryWgs84: squarePolygon(0, 0, 1) },
    ]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set([]),
      candidatePoints: [pointFeature(10, 50, { osm_id: '1', admin_level: '8' })],
      options: ADMIN_OPTIONS_DEFAULT,
    })
    expect((result.get('k1') ?? []).map((m) => m.osmId)).toEqual(['1'])
    expect(result.get('k2')).toEqual([])
  })

  test('positive osm_id with type=boundary is treated as relation (GDAL multipolygon quirk)', () => {
    const candidates = [
      pointFeature(10, 50, {
        osm_id: '1303470',
        type: 'boundary',
        admin_level: '8',
        'de:regionalschluessel': '120620341341',
      }),
    ]
    const result = matchCandidatesForOfficialOnly({
      rows: [
        { canonicalMatchKey: '120620341341', officialGeometryWgs84: squarePolygon(10, 50, 0.5) },
      ],
      officialKeySet: new Set(['120620341341']),
      candidatePoints: candidates,
      options: {
        idNormalizationPreset: 'regional-12',
        osmProfileId: 'admin_rs',
        osmMatchProperty: 'de:regionalschluessel',
      },
    })
    const matches = result.get('120620341341') ?? []
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ osmType: 'relation', osmId: '1303470' })
  })

  test('relation osm_id is decoded as negative and surfaces as relation/<id>', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: 'k1', officialGeometryWgs84: squarePolygon(10, 50, 1) },
    ]
    const candidates = [pointFeature(10, 50, { osm_id: '-51477', admin_level: '6' })]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set([]),
      candidatePoints: candidates,
      options: ADMIN_OPTIONS_DEFAULT,
    })
    const matches = result.get('k1') ?? []
    expect(matches[0]).toMatchObject({ osmType: 'relation', osmId: '51477' })
  })
})

describe('matchCandidatesForOfficialOnly — postal_code profile', () => {
  test('postal_code candidate is matched and reports postalCodeRaw', () => {
    const inputs: OfficialOnlyInput[] = [
      { canonicalMatchKey: '13585', officialGeometryWgs84: squarePolygon(13.2, 52.5, 0.05) },
    ]
    const candidates = [
      pointFeature(13.2, 52.5, {
        osm_id: '-7777',
        name: 'PLZ 13585 (rough)',
        postal_code: '13585',
      }),
    ]
    const result = matchCandidatesForOfficialOnly({
      rows: inputs,
      officialKeySet: new Set(['13585']),
      candidatePoints: candidates,
      options: {
        idNormalizationPreset: 'plz-5',
        osmProfileId: 'postal_code',
        osmMatchProperty: 'postal_code',
      },
    })
    const matches = result.get('13585') ?? []
    expect(matches).toHaveLength(1)
    const match = matches[0] as CandidateMatch
    expect(match.osmType).toBe('relation')
    expect(match.postalCodeRaw).toBe('13585')
    expect(match.adminLevel).toBeUndefined()
    expect(match.deRegionalRaw).toBeUndefined()
  })
})

describe('selectEligibleCandidates', () => {
  test('admin_level allowlist drops non-allowed levels', () => {
    const features = [
      pointFeature(10, 50, { osm_id: '1', admin_level: '8' }),
      pointFeature(10, 50, { osm_id: '2', admin_level: '6' }),
      pointFeature(10, 50, { osm_id: '3', admin_level: '8' }),
    ]
    const filtered = selectEligibleCandidates(features, {
      adminLevelAllowList: new Set(['8']),
    })
    expect(filtered.map((f) => (f.properties as Record<string, unknown>).osm_id)).toEqual([
      '1',
      '3',
    ])
  })

  test('ignoreRelationIds removes relations only', () => {
    const features = [
      pointFeature(10, 50, { osm_id: '-100', admin_level: '6' }),
      pointFeature(10, 50, { osm_id: '100', admin_level: '6' }),
    ]
    const filtered = selectEligibleCandidates(features, {
      ignoreRelationIds: new Set(['100']),
    })
    expect(filtered.map((f) => (f.properties as Record<string, unknown>).osm_id)).toEqual(['100'])
  })

  test('ignoreRelationIds drops positive osm_id when type=boundary implies relation', () => {
    const features = [
      pointFeature(10, 50, { osm_id: '100', type: 'boundary', admin_level: '6' }),
      pointFeature(10, 50, { osm_id: '200', admin_level: '6' }),
    ]
    const filtered = selectEligibleCandidates(features, {
      ignoreRelationIds: new Set(['100']),
    })
    expect(filtered.map((f) => (f.properties as Record<string, unknown>).osm_id)).toEqual(['200'])
  })

  test('bbox filter excludes points outside [w, s, e, n]', () => {
    const features = [
      pointFeature(10, 50, { osm_id: '1', admin_level: '8' }),
      pointFeature(20, 50, { osm_id: '2', admin_level: '8' }),
    ]
    const filtered = selectEligibleCandidates(features, { bboxFilter: [9, 49, 11, 51] })
    expect(filtered.map((f) => (f.properties as Record<string, unknown>).osm_id)).toEqual(['1'])
  })

  test('drops features whose osm_id cannot be parsed', () => {
    const features = [
      pointFeature(10, 50, { osm_id: 'bogus', admin_level: '8' }),
      pointFeature(10, 50, { admin_level: '8' }),
    ]
    expect(selectEligibleCandidates(features, {})).toHaveLength(0)
  })
})
