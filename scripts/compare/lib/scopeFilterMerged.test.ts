import { describe, expect, test } from 'bun:test'
import * as turf from '@turf/turf'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import {
  filterOsmByMergedOfficialScope,
  mergeOfficialFootprint,
  passesMergedOfficialScope,
} from './scopeFilterMerged.ts'

const METRICS_CRS = 'EPSG:25832'

function rect(lon1: number, lat1: number, lon2: number, lat2: number): Feature<Polygon> {
  return turf.polygon([
    [
      [lon1, lat1],
      [lon2, lat1],
      [lon2, lat2],
      [lon1, lat2],
      [lon1, lat1],
    ],
  ]) as Feature<Polygon>
}

describe('mergeOfficialFootprint', () => {
  test('unions two disjoint official squares into one multipolygon footprint', () => {
    const a = rect(9.0, 50.0, 9.05, 50.05)
    const b = rect(9.1, 50.0, 9.15, 50.05)
    const merged = mergeOfficialFootprint([a, b])
    expect(merged?.geometry?.type).toBe('MultiPolygon')
    const bbox = turf.bbox(merged!)
    expect(bbox[0]).toBeLessThanOrEqual(9.0)
    expect(bbox[2]).toBeGreaterThanOrEqual(9.15)
  })

  test('returns null when no polygon features', () => {
    expect(mergeOfficialFootprint([])).toBeNull()
  })
})

describe('passesMergedOfficialScope', () => {
  test('accepts OSM fully inside merged official footprint (pip)', () => {
    const merged = rect(9.0, 50.0, 9.2, 50.2)
    const mergedBbox = turf.bbox(merged) as [number, number, number, number]
    const osm = rect(9.05, 50.05, 9.1, 50.1)
    expect(passesMergedOfficialScope(osm, merged, mergedBbox, METRICS_CRS)).toBe(true)
  })

  test('rejects OSM whose bbox does not overlap merged bbox', () => {
    const merged = rect(9.0, 50.0, 9.05, 50.05)
    const mergedBbox = turf.bbox(merged) as [number, number, number, number]
    const osm = rect(10.0, 51.0, 10.05, 51.05)
    expect(passesMergedOfficialScope(osm, merged, mergedBbox, METRICS_CRS)).toBe(false)
  })

  test('rejects grazing edge-only contact (fallback intersection area ~ 0)', () => {
    const merged = rect(9.0, 50.0, 9.1, 50.1)
    const mergedBbox = turf.bbox(merged) as [number, number, number, number]
    const osm = rect(9.1, 50.0, 9.2, 50.1)
    expect(passesMergedOfficialScope(osm, merged, mergedBbox, METRICS_CRS)).toBe(false)
  })

  test('accepts multipolygon when largest part is outside merged but overlap meets fixed fallback thresholds', () => {
    const merged = rect(9.0, 50.0, 9.25, 50.25)
    const mergedBbox = turf.bbox(merged) as [number, number, number, number]

    const largeOutside = rect(7.5, 50.0, 8.0, 50.5)
    const overlapInside = rect(9.05, 50.05, 9.22, 50.22)

    const mp: Feature<MultiPolygon> = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'MultiPolygon',
        coordinates: [largeOutside.geometry!.coordinates, overlapInside.geometry!.coordinates],
      },
    }

    const rep = turf.pointOnFeature(mp)
    const pip = turf.booleanPointInPolygon(rep, merged)
    if (pip) {
      expect(passesMergedOfficialScope(mp, merged, mergedBbox, METRICS_CRS)).toBe(true)
      return
    }

    expect(passesMergedOfficialScope(mp, merged, mergedBbox, METRICS_CRS)).toBe(true)
  })

  test('fallback rejects wide polygon that only ribbons along merged edge (low overlap / OSM area)', () => {
    const merged = rect(9.0, 50.0, 9.2, 50.2)
    const mergedBbox = turf.bbox(merged) as [number, number, number, number]
    const osm = rect(9.15, 50.0, 11.0, 50.2)
    expect(passesMergedOfficialScope(osm, merged, mergedBbox, METRICS_CRS)).toBe(false)
  })
})

describe('filterOsmByMergedOfficialScope', () => {
  test('keeps only rows that pass merged official scope', () => {
    const merged = rect(9.0, 50.0, 9.2, 50.2)
    const mergedBbox = turf.bbox(merged) as [number, number, number, number]
    const inside = rect(9.05, 50.05, 9.1, 50.1)
    const outside = rect(10.0, 51.0, 10.05, 51.05)
    const ribbon = rect(9.15, 50.0, 11.0, 50.2)
    const filtered = filterOsmByMergedOfficialScope(
      [inside, outside, ribbon],
      merged,
      mergedBbox,
      METRICS_CRS,
    )
    expect(filtered).toEqual([inside])
  })
})
