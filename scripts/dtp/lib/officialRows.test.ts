import { describe, expect, test } from 'bun:test'
import detailFixture from '../fixtures/detail-sample.json'
import {
  buildOfficialFeatures,
  natura2000CodeFromReferences,
  officialFeatureFromRecord,
  selectInventoryItems,
} from './officialRows.ts'
import { dtpDetailSchema, type DtpCachedRecord, type DtpListItem } from './schemas.ts'

const baseDetail = dtpDetailSchema.parse(detailFixture)
const categories = new Map([
  [1, 'Nationalpark'],
  [2, 'Naturschutzgebiet'],
])
const geodata = {
  geometry: {
    type: 'MultiPolygon' as const,
    coordinates: [
      [
        [
          [10, 50],
          [10.1, 50],
          [10.1, 50.1],
          [10, 50],
        ],
      ],
    ],
  },
  centroid: null,
  source: { id: 5, name: 'Quelle', acronym: 'Q', url: 'https://example.test/q' },
  license: { name: 'CC0 1.0', uri: 'https://example.test/cc0' },
}

function item(uuid: string, categoryId: number, refs: { name: string; id: string }[]): DtpListItem {
  return {
    uuid,
    name: uuid,
    category_id: categoryId,
    external_references: refs,
    parent_uuid: null,
    updated_at: '2026-10-01T00:00:00Z',
    area_in_km2: 1,
  }
}

function record(listItem: DtpListItem, geo: typeof geodata | null = geodata): DtpCachedRecord {
  return {
    uuid: listItem.uuid,
    fetchedAt: '2026-10-25T00:00:00Z',
    listUpdatedAt: listItem.updated_at,
    listAreaKm2: 1,
    detail: {
      ...baseDetail,
      name: listItem.name,
      category_id: listItem.category_id,
      external_references: listItem.external_references,
      state_ids: [3, 9],
      parent_uuid: null,
      geodata: geo,
    },
  }
}

describe('selectInventoryItems', () => {
  const items = [
    item('a', 1, [{ name: 'wdpa', id: '1' }]),
    item('b', 1, [{ name: 'osm', id: 'relation/1' }]),
    item('c', 2, [{ name: 'wdpa', id: '2' }]),
  ]
  test('filters by category and requireWdpa', () => {
    expect(
      selectInventoryItems(items, { categoryIds: [1], requireWdpa: true }).map((i) => i.uuid),
    ).toEqual(['a'])
    expect(
      selectInventoryItems(items, { categoryIds: [1], requireWdpa: false }).map((i) => i.uuid),
    ).toEqual(['a', 'b'])
  })
})

describe('officialFeatureFromRecord', () => {
  test('maps references, source and license into flat properties', () => {
    const it = item('u1', 1, [
      { name: 'wdpa', id: '555' },
      { name: 'wikidata', id: 'Q1' },
      { name: 'osm', id: 'relation/123' },
      { name: 'source_id', id: 'DE5519304' },
    ])
    const feature = officialFeatureFromRecord(record(it), categories)
    expect(feature?.properties).toMatchObject({
      wdpa: '555',
      dtp_uuid: 'u1',
      category_id: 1,
      category_name: 'Nationalpark',
      dtp_osm_ref: 'relation/123',
      wikidata: 'Q1',
      natura2000_code: 'DE5519304',
      state_ids: '3,9',
      geometry_source_name: 'Quelle',
      geometry_source_url: 'https://example.test/q',
      geometry_license_name: 'CC0 1.0',
      geometry_license_url: 'https://example.test/cc0',
      dtp_url: 'https://platform.digitizetheplanet.org/api/v2/protected-areas/u1',
    })
  })

  test('returns null without geometry', () => {
    expect(officialFeatureFromRecord(record(item('u', 1, []), null), categories)).toBeNull()
  })

  test('natura2000_code only for DE + 7 digits', () => {
    expect(natura2000CodeFromReferences([{ name: 'source_id', id: 'bw_1.019' }])).toBeNull()
    expect(natura2000CodeFromReferences([{ name: 'source_id', id: 'DE123' }])).toBeNull()
    expect(natura2000CodeFromReferences([{ name: 'wdpa', id: 'DE1234567' }])).toBeNull()
  })
})

describe('buildOfficialFeatures', () => {
  test('counts missing cache records and no-geometry, reports duplicate wdpa', () => {
    const a = item('a', 1, [{ name: 'wdpa', id: '7' }])
    const b = item('b', 1, [{ name: 'wdpa', id: '7' }])
    const c = item('c', 1, [{ name: 'wdpa', id: '8' }])
    const d = item('d', 1, [{ name: 'wdpa', id: '9' }])
    const e = item('e', 2, [{ name: 'wdpa', id: '10' }])
    const records = new Map([
      ['a', record(a)],
      ['b', record(b)],
      ['c', record(c, null)],
      ['e', record(e)],
    ])
    const { features, stats } = buildOfficialFeatures(
      [a, b, c, d, e],
      records,
      { categoryIds: [1], requireWdpa: true },
      categories,
    )
    expect(features.map((f) => f.properties.dtp_uuid)).toEqual(['a', 'b'])
    expect(stats).toMatchObject({
      selectedInInventory: 4,
      missingFromCache: 1,
      noGeometry: 1,
      written: 2,
    })
    expect([...stats.duplicateWdpa]).toEqual([['7', ['a', 'b']]])
  })
})
