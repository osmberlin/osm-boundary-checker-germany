import { describe, expect, test } from 'bun:test'
import detailFixture from '../fixtures/detail-sample.json'
import listPageFixture from '../fixtures/list-page-sample.json'
import {
  dtpDeletedPageSchema,
  dtpDetailSchema,
  dtpListItemSchema,
  dtpListPageSchema,
} from './schemas.ts'

describe('dtpListPageSchema', () => {
  test('parses the 3-item list fixture and strips fields we do not use', () => {
    const page = dtpListPageSchema.parse(listPageFixture)
    expect(page.results).toHaveLength(3)
    expect(page.next).toBeNull()
    expect(page.results[0]).not.toHaveProperty('dtp_url')
    expect(page.results[0]).not.toHaveProperty('name_de')
  })

  test('keeps external references with name and id', () => {
    const page = dtpListPageSchema.parse(listPageFixture)
    const withRefs = page.results.find((item) => item.external_references.length > 0)
    expect(withRefs?.external_references[0]).toMatchObject({
      name: expect.any(String),
      id: expect.any(String),
    })
  })

  test('accepts a null name and a parent_uuid', () => {
    const item = {
      uuid: 'eb70e802-53db-4ed1-9398-a5beda39f744',
      name: null,
      category_id: 2,
      external_references: [],
      parent_uuid: '125c1fe9-4554-4e69-8c46-014f86d614f8',
      updated_at: '2026-10-22T06:33:51.540897Z',
      area_in_km2: 0.25,
    }
    expect(dtpListItemSchema.parse(item).parent_uuid).toBe(item.parent_uuid)
  })

  test('rejects an item without updated_at', () => {
    const { updated_at: _omit, ...item } = listPageFixture.results[0]!
    expect(() => dtpListItemSchema.parse(item)).toThrow()
  })
})

describe('dtpDetailSchema', () => {
  test('parses the detail fixture with a MultiPolygon geometry', () => {
    const detail = dtpDetailSchema.parse(detailFixture)
    expect(detail.geodata?.geometry.type).toBe('MultiPolygon')
    expect(detail.geodata?.geometry.coordinates).toHaveLength(1)
    expect(detail.geodata?.license?.name).toBe('CC BY-ND 4.0')
    expect(detail).not.toHaveProperty('legal_documents')
  })

  test('accepts null geodata', () => {
    expect(dtpDetailSchema.parse({ ...detailFixture, geodata: null }).geodata).toBeNull()
  })

  test('rejects a Polygon geometry type', () => {
    const bad = {
      ...detailFixture,
      geodata: {
        ...detailFixture.geodata,
        geometry: { type: 'Polygon', coordinates: detailFixture.geodata.geometry.coordinates },
      },
    }
    expect(() => dtpDetailSchema.parse(bad)).toThrow()
  })

  test('rejects a ring with fewer than four positions', () => {
    const bad = {
      ...detailFixture,
      geodata: {
        ...detailFixture.geodata,
        geometry: {
          type: 'MultiPolygon',
          coordinates: [[detailFixture.geodata.geometry.coordinates[0]![0]!.slice(0, 3)]],
        },
      },
    }
    expect(() => dtpDetailSchema.parse(bad)).toThrow()
  })
})

describe('dtpDeletedPageSchema', () => {
  test('parses a deleted page with null name', () => {
    const page = dtpDeletedPageSchema.parse({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          uuid: 'a1b2c3d4-0000-4000-8000-000000000000',
          name: null,
          deleted_at: '2026-10-20T10:00:00Z',
        },
      ],
    })
    expect(page.count).toBe(1)
    expect(page.results[0]?.name).toBeNull()
  })
})
