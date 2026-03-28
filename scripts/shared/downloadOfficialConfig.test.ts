import { describe, expect, test } from 'bun:test'
import { parseDownloadOfficial } from './downloadOfficialConfig.ts'

describe('parseDownloadOfficial', () => {
  test('returns null when download.official missing', () => {
    expect(parseDownloadOfficial({ official: { path: 'x' } })).toBeNull()
    expect(parseDownloadOfficial({ download: {} })).toBeNull()
  })

  test('parses http geojson with defaults', () => {
    const u = 'https://example.com/wfs?request=GetFeature'
    const o = parseDownloadOfficial({
      download: { official: { url: u } },
    })
    expect(o).toEqual({ kind: 'http', url: u, format: 'geojson', crs: undefined })
  })

  test('parses crs and explicit format', () => {
    const o = parseDownloadOfficial({
      download: {
        official: {
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

  test('rejects unsupported kind or format', () => {
    expect(() =>
      parseDownloadOfficial({
        download: { official: { url: 'https://x', kind: 'ftp' } },
      }),
    ).toThrow(/kind/)
    expect(() =>
      parseDownloadOfficial({
        download: { official: { url: 'https://x', format: 'gml' } },
      }),
    ).toThrow(/format/)
  })
})
