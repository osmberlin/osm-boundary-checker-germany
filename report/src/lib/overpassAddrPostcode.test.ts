import { describe, expect, test } from 'bun:test'
import { addrPostcodeColorMatchExpression } from './addrPostcodeMapExpressions'
import {
  addrPostcodeColorIndex,
  buildOverpassAddrPostcodeQuery,
  isPlzDatasetForReport,
  parseOverpassAddrPostcodeData,
} from './overpassAddrPostcode'

describe('addrPostcodeColorIndex', () => {
  test('uses last digit of digits-only postcode', () => {
    expect(addrPostcodeColorIndex('10115')).toBe(5)
    expect(addrPostcodeColorIndex('10119')).toBe(9)
  })

  test('strips non-digits before last digit', () => {
    expect(addrPostcodeColorIndex('D-10115')).toBe(5)
  })

  test('empty or non-numeric falls back to 0', () => {
    expect(addrPostcodeColorIndex('')).toBe(0)
    expect(addrPostcodeColorIndex('abc')).toBe(0)
  })
})

describe('buildOverpassAddrPostcodeQuery', () => {
  test('embeds bbox in south,west,north,east order', () => {
    const q = buildOverpassAddrPostcodeQuery([13.0, 52.4, 13.5, 52.6])
    expect(q).toContain('node["addr:postcode"](52.4,13,52.6,13.5)')
    expect(q).toContain('way["addr:postcode"](52.4,13,52.6,13.5)')
    expect(q).toContain('out center')
  })
})

describe('isPlzDatasetForReport', () => {
  test('true for plz-5 preset', () => {
    expect(
      isPlzDatasetForReport({
        area: 'berlin-plz',
        displayName: 'x',
        titlePrefix: 'x',
        generatedAt: '',
        metricsCrs: 'EPSG:4326',
        hasPmtiles: false,
        tippecanoeLayer: 'x',
        sourceMetadata: { official: { sourcePublicUrl: '', sourceDownloadUrl: '' }, osm: {} },
        filterConfigSummary: {
          officialMatchProperty: 'plz',
          bboxFilter: 'none',
          osmScopeFilter: 'none',
          minZoom: 0,
        },
        idNormalizationPreset: 'plz-5',
        rows: [],
        unmatchedOsm: [],
      }),
    ).toBe(true)
  })

  test('false for admin dataset', () => {
    expect(
      isPlzDatasetForReport({
        area: 'berlin-bezirke',
        displayName: 'x',
        titlePrefix: 'x',
        generatedAt: '',
        metricsCrs: 'EPSG:4326',
        hasPmtiles: false,
        tippecanoeLayer: 'x',
        sourceMetadata: { official: { sourcePublicUrl: '', sourceDownloadUrl: '' }, osm: {} },
        filterConfigSummary: {
          officialMatchProperty: 'ARS',
          bboxFilter: 'none',
          osmScopeFilter: 'none',
          minZoom: 0,
        },
        overpassBoundaryTag: 'administrative',
        rows: [],
        unmatchedOsm: [],
      }),
    ).toBe(false)
  })
})

describe('parseOverpassAddrPostcodeData', () => {
  test('parses node with addr:postcode as Point', () => {
    const json = JSON.stringify({
      elements: [
        {
          type: 'node',
          id: 42,
          lat: 52.5,
          lon: 13.4,
          tags: { 'addr:postcode': '10115', 'addr:street': 'Test' },
        },
      ],
    })
    const { hits, geojson } = parseOverpassAddrPostcodeData(json)
    expect(hits).toHaveLength(1)
    expect(hits[0]?.type).toBe('node')
    expect(hits[0]?.id).toBe(42)
    expect(geojson.features).toHaveLength(1)
    expect(geojson.features[0]?.geometry.type).toBe('Point')
    expect(geojson.features[0]?.properties.label).toBe('10115')
    expect(geojson.features[0]?.properties.colorIndex).toBe(5)
  })
})

describe('addrPostcodeColorMatchExpression', () => {
  test('builds match with 10 branches', () => {
    const expr = addrPostcodeColorMatchExpression('point') as unknown[]
    expect(expr[0]).toBe('match')
    expect(expr[1]).toEqual(['get', 'colorIndex'])
    expect(expr.length).toBe(2 + 10 * 2 + 1)
  })
})
