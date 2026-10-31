import { describe, expect, it } from 'vitest'
import {
  addrPostcodesSql,
  liveOsmObjectSql,
  nearbyBoundariesSql,
  parseAddrPostcodes,
  parseLiveOsmObjectTags,
  parseLiveOsmObjectWithGeometry,
  parseNearbyBoundaries,
  POSTPASS_INVALID_RESPONSE,
} from './postpass'

const properties = { generator: 'Postpass API 0.2', timestamp: '2026-10-31T09:05:06Z' }

function featureAnswer(features: unknown[]) {
  return JSON.stringify({
    postpass_properties: properties,
    type: 'FeatureCollection',
    features,
  })
}

const line = {
  type: 'MultiLineString',
  coordinates: [
    [
      [13.1, 52.1],
      [13.2, 52.2],
    ],
  ],
}

describe('Postpass SQL', () => {
  it('asks for one object by type and id, tags only unless geometry is wanted', () => {
    expect(liveOsmObjectSql({ type: 'relation', id: 62422 }, { geometry: false })).toBe(
      "SELECT tags FROM postpass_linepolygon WHERE osm_type = 'R' AND osm_id = 62422 LIMIT 1",
    )
    const withGeometry = liveOsmObjectSql({ type: 'way', id: 7 }, { geometry: true })
    expect(withGeometry).toContain("osm_type = 'W' AND osm_id = 7")
    expect(withGeometry).toContain('ST_SimplifyPreserveTopology')
  })

  it('refuses anything but a positive integer id', () => {
    expect(() => liveOsmObjectSql({ type: 'way', id: Number.NaN }, { geometry: false })).toThrow()
    expect(() => liveOsmObjectSql({ type: 'way', id: -1 }, { geometry: false })).toThrow()
  })

  it('searches national parks together with protected areas', () => {
    const sql = nearbyBoundariesSql([13, 52, 13.5, 52.5], 'protected_area')
    expect(sql).toContain("IN ('protected_area', 'national_park')")
    expect(sql).toContain('ST_MakeEnvelope(13, 52, 13.5, 52.5, 4326)')
  })

  it('refuses a map area that is no box', () => {
    expect(() => nearbyBoundariesSql([14, 52, 13, 53], 'administrative')).toThrow()
    expect(() => addrPostcodesSql([13, 52, Number.POSITIVE_INFINITY, 53])).toThrow()
  })
})

describe('Postpass answers', () => {
  it('reads tags, and null for an object Postpass does not know', () => {
    const answer = (result: unknown[]) =>
      JSON.stringify({ postpass_properties: properties, result })
    expect(parseLiveOsmObjectTags(answer([{ tags: { name: 'Berlin' } }]))).toEqual({
      tags: { name: 'Berlin' },
      features: null,
      timestamp: properties.timestamp,
    })
    expect(parseLiveOsmObjectTags(answer([])).tags).toBeNull()
  })

  it('turns an object with geometry into one overlay feature', () => {
    const parsed = parseLiveOsmObjectWithGeometry(
      featureAnswer([
        {
          type: 'Feature',
          geometry: line,
          properties: { osm_type: 'R', osm_id: 5, tags: { name: 'A', boundary: 'protected_area' } },
        },
      ]),
    )
    expect(parsed.tags).toEqual({ name: 'A', boundary: 'protected_area' })
    expect(parsed.features?.[0]?.properties).toEqual({
      id: 5,
      type: 'relation',
      label: 'A',
      relation_id: 5,
      name: 'A',
      boundary: 'protected_area',
    })
  })

  it('drops objects that clipping left without geometry, and sorts relations first', () => {
    const parsed = parseNearbyBoundaries(
      featureAnswer([
        {
          type: 'Feature',
          geometry: line,
          properties: { osm_type: 'W', osm_id: 1, tags: { name: 'Way' } },
        },
        {
          type: 'Feature',
          geometry: { type: 'MultiLineString', coordinates: [] },
          properties: { osm_type: 'R', osm_id: 2, tags: {} },
        },
        {
          type: 'Feature',
          geometry: line,
          properties: { osm_type: 'R', osm_id: 3, tags: { name: 'Relation' } },
        },
      ]),
    )
    expect(parsed.hits.map((hit) => `${hit.type}/${hit.id}`)).toEqual(['relation/3', 'way/1'])
    expect(parsed.geojson.features).toHaveLength(2)
    expect(parsed.truncated).toBe(false)
  })

  it('reads postcodes as points with their colour bucket', () => {
    const parsed = parseAddrPostcodes(
      featureAnswer([
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [13.4, 52.5] },
          properties: { osm_type: 'N', osm_id: 9, postcode: '10117' },
        },
      ]),
    )
    expect(parsed.hits).toEqual([{ type: 'node', id: 9, tags: { 'addr:postcode': '10117' } }])
    expect(parsed.geojson.features[0]?.properties).toMatchObject({
      label: '10117',
      colorIndex: 7,
      node_id: 9,
    })
  })

  it('reports an answer it cannot read', () => {
    expect(() => parseLiveOsmObjectTags('pq: geometry column is missing')).toThrow(
      POSTPASS_INVALID_RESPONSE,
    )
    expect(() => parseNearbyBoundaries('{}')).toThrow(POSTPASS_INVALID_RESPONSE)
  })
})
