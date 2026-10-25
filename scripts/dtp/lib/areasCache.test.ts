import { describe, expect, test } from 'bun:test'
import detailFixture from '../fixtures/detail-sample.json'
import { parseAreasNdjson, serializeAreasNdjson } from './areasCache.ts'
import { dtpDetailSchema, type DtpCachedRecord } from './schemas.ts'

const detail = dtpDetailSchema.parse(detailFixture)

function record(uuid: string): DtpCachedRecord {
  return {
    uuid,
    fetchedAt: '2026-10-25T10:00:00.000Z',
    listUpdatedAt: detail.updated_at,
    listAreaKm2: detail.area_in_km2,
    detail,
  }
}

describe('areas ndjson', () => {
  test('round-trips records sorted by uuid, one per line', () => {
    const text = serializeAreasNdjson([record('b'), record('a')])
    const lines = text.trimEnd().split('\n')
    expect(lines).toHaveLength(2)
    const { records, invalidCount } = parseAreasNdjson(text)
    expect(invalidCount).toBe(0)
    expect(records.map((r) => r.uuid)).toEqual(['a', 'b'])
    expect(records[0]?.detail.geodata?.geometry.type).toBe('MultiPolygon')
  })

  test('serializes an empty list to an empty string', () => {
    expect(serializeAreasNdjson([])).toBe('')
    expect(parseAreasNdjson('').records).toEqual([])
  })

  test('skips and counts broken lines', () => {
    const good = JSON.stringify(record('a'))
    const text = `${good}\nnot json\n{"uuid":"x"}\n\n`
    const { records, invalidCount } = parseAreasNdjson(text)
    expect(records).toHaveLength(1)
    expect(invalidCount).toBe(2)
  })
})
