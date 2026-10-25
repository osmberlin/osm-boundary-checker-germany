import { describe, expect, test } from 'bun:test'
import detailFixture from '../fixtures/detail-sample.json'
import {
  buildOfficialFeatures,
  natura2000CodeFromReferences,
  officialFeatureFromRecord,
  organizationNamesText,
  selectInventoryItems,
  type DtpOfficialNames,
} from './officialRows.ts'
import {
  dtpDetailSchema,
  type DtpCachedRecord,
  type DtpExternalReference,
  type DtpInventoryItem,
} from './schemas.ts'

const baseDetail = dtpDetailSchema.parse(detailFixture)
const names: DtpOfficialNames = {
  categories: new Map([
    [1, 'Nationalpark'],
    [2, 'Naturschutzgebiet'],
  ]),
  organizations: new Map([
    [42, 'Landkreis Alpha'],
    [43, 'Verband Beta'],
  ]),
}
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

function item(
  uuid: string,
  categoryId: number,
  refs: DtpExternalReference[],
  managed = false,
): DtpInventoryItem {
  return {
    uuid,
    name: uuid,
    category_id: categoryId,
    external_references: refs,
    parent_uuid: null,
    updated_at: '2026-10-01T00:00:00Z',
    area_in_km2: 1,
    managed,
  }
}

function record(
  listItem: DtpInventoryItem,
  opts: { geo?: typeof geodata | null; organizationIds?: number[] | null | undefined } = {},
): DtpCachedRecord {
  const geo = opts.geo === undefined ? geodata : opts.geo
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
      responsible_organization_ids: opts.organizationIds === undefined ? [] : opts.organizationIds,
    },
  }
}

describe('selectInventoryItems', () => {
  const items = [
    item('a', 1, [{ name: 'wdpa', id: '1' }]),
    item('b', 1, [{ name: 'osm', id: 'relation/1' }]),
    item('c', 2, [{ name: 'wdpa', id: '2' }]),
  ]
  test('filters by category and keeps areas without a WDPA id', () => {
    expect(selectInventoryItems(items, { categoryIds: [1] }).map((i) => i.uuid)).toEqual(['a', 'b'])
  })
})

describe('officialFeatureFromRecord match key', () => {
  test('areas without a WDPA id get the dtp-<uuid> key and an empty wdpa', () => {
    const keyless = item('ABCD-1234', 4, [{ name: 'osm', id: 'relation/5' }])
    const feature = officialFeatureFromRecord(record(keyless), false, names)
    expect(feature?.properties.match_key).toBe('dtp-abcd-1234')
    expect(feature?.properties.wdpa).toBe('')
    expect(feature?.properties.dtp_osm_ref).toBe('relation/5')
  })
})

describe('organizationNamesText', () => {
  test('joins names in API order and drops duplicate names', () => {
    expect(organizationNamesText([43, 42, 43], names.organizations)).toEqual({
      text: 'Verband Beta; Landkreis Alpha',
      unknownIds: 0,
    })
  })

  test('null for no ids, counts ids without a name', () => {
    expect(organizationNamesText([], names.organizations)).toEqual({ text: null, unknownIds: 0 })
    expect(organizationNamesText(undefined, names.organizations)).toEqual({
      text: null,
      unknownIds: 0,
    })
    expect(organizationNamesText([42, 999], names.organizations)).toEqual({
      text: 'Landkreis Alpha',
      unknownIds: 1,
    })
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
    const feature = officialFeatureFromRecord(record(it), false, names)
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

  test('dtp_managed is always a boolean; dtp_organizations is set for managed areas with names', () => {
    const managed = officialFeatureFromRecord(
      record(item('m', 1, []), { organizationIds: [43, 42] }),
      true,
      names,
    )
    expect(managed?.properties.dtp_managed).toBe(true)
    expect(managed?.properties.dtp_organizations).toBe('Verband Beta; Landkreis Alpha')
  })

  test('unmanaged areas have dtp_managed false and no dtp_organizations key', () => {
    const feature = officialFeatureFromRecord(
      record(item('u', 1, []), { organizationIds: [] }),
      false,
      names,
    )
    expect(feature?.properties.dtp_managed).toBe(false)
    expect(feature?.properties).not.toHaveProperty('dtp_organizations')
  })

  test('a managed area whose ids have no names gets no dtp_organizations key', () => {
    const feature = officialFeatureFromRecord(
      record(item('m', 1, []), { organizationIds: [999] }),
      true,
      names,
    )
    expect(feature?.properties.dtp_managed).toBe(true)
    expect(feature?.properties).not.toHaveProperty('dtp_organizations')
  })

  test('returns null without geometry', () => {
    expect(
      officialFeatureFromRecord(record(item('u', 1, []), { geo: null }), false, names),
    ).toBeNull()
  })

  test('natura2000_code only for DE + 7 digits', () => {
    expect(natura2000CodeFromReferences([{ name: 'source_id', id: 'bw_1.019' }])).toBeNull()
    expect(natura2000CodeFromReferences([{ name: 'source_id', id: 'DE123' }])).toBeNull()
    expect(natura2000CodeFromReferences([{ name: 'wdpa', id: 'DE1234567' }])).toBeNull()
  })
})

describe('buildOfficialFeatures', () => {
  test('counts missing cache records and no-geometry, reports duplicate wdpa', () => {
    const a = item('a', 1, [{ name: 'wdpa', id: '7' }], true)
    const b = item('b', 1, [{ name: 'wdpa', id: '7' }])
    const c = item('c', 1, [{ name: 'wdpa', id: '8' }])
    const d = item('d', 1, [{ name: 'wdpa', id: '9' }])
    const e = item('e', 2, [{ name: 'wdpa', id: '10' }])
    const records = new Map([
      ['a', record(a, { organizationIds: [42, 999] })],
      ['b', record(b)],
      ['c', record(c, { geo: null })],
      ['e', record(e)],
    ])
    const { features, stats } = buildOfficialFeatures(
      [a, b, c, d, e],
      records,
      { categoryIds: [1] },
      names,
    )
    expect(features.map((f) => f.properties.dtp_uuid)).toEqual(['a', 'b'])
    expect(features.map((f) => f.properties.match_key)).toEqual(['7', '7'])
    expect(features.map((f) => f.properties.dtp_managed)).toEqual([true, false])
    expect(features[0]?.properties.dtp_organizations).toBe('Landkreis Alpha')
    expect(stats).toMatchObject({
      selectedInInventory: 4,
      missingFromCache: 1,
      noGeometry: 1,
      written: 2,
      unknownOrganizationIds: 1,
    })
    expect([...stats.duplicateWdpa]).toEqual([['7', ['a', 'b']]])
  })
})
