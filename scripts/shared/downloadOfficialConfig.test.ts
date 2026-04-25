import { describe, expect, test } from 'bun:test'
import { parseDownloadOfficial } from './downloadOfficialConfig.ts'

describe('parseDownloadOfficial', () => {
  test('returns null when official.download missing', () => {
    expect(parseDownloadOfficial({ official: { path: 'x' } })).toBeNull()
    expect(parseDownloadOfficial({ official: {} })).toBeNull()
  })

  test('parses http geojson with defaults', () => {
    const u = 'https://example.com/wfs?request=GetFeature'
    const o = parseDownloadOfficial({
      official: { download: { url: u } },
    })
    expect(o).toEqual({ kind: 'http', url: u, format: 'geojson', crs: undefined })
  })

  test('parses crs and explicit format', () => {
    const o = parseDownloadOfficial({
      official: {
        download: {
          kind: 'http',
          url: ' https://x ',
          format: 'GeoJSON',
          crs: 'EPSG:4326',
        },
      },
    })
    expect(o).toEqual({
      kind: 'http',
      url: 'https://x',
      format: 'geojson',
      crs: 'EPSG:4326',
    })
  })

  test('parses gml format', () => {
    const o = parseDownloadOfficial({
      official: {
        download: {
          url: 'https://example.com/wfs?request=GetFeature',
          format: 'GML',
        },
      },
    })
    expect(o).toEqual({
      kind: 'http',
      url: 'https://example.com/wfs?request=GetFeature',
      format: 'gml',
      crs: undefined,
    })
  })

  test('rejects unsupported kind or format', () => {
    expect(() =>
      parseDownloadOfficial({
        official: { download: { url: 'https://x', kind: 'ftp' } },
      }),
    ).toThrow(/kind/)
    expect(() =>
      parseDownloadOfficial({
        official: { download: { url: 'https://x', format: 'gml' } },
      }),
    ).not.toThrow()
    expect(() =>
      parseDownloadOfficial({
        official: { download: { url: 'https://x', format: 'zip' } },
      }),
    ).toThrow(/format/)
  })
})
