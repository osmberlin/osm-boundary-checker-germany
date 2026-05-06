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
      official: { download: { url: u, upstreamDateResolver: 'wfs_inspire_iso19139' } },
    })
    expect(o).toEqual({
      kind: 'http',
      url: u,
      format: 'geojson',
      upstreamDateResolver: 'wfs_inspire_iso19139',
    })
  })

  test('parses crs and explicit format', () => {
    const o = parseDownloadOfficial({
      official: {
        download: {
          kind: 'http',
          url: 'https://x',
          format: 'geojson',
          upstreamDateResolver: 'ogc_api_features_temporal_end',
          crs: 'EPSG:4326',
        },
      },
    })
    expect(o).toEqual({
      kind: 'http',
      url: 'https://x',
      format: 'geojson',
      upstreamDateResolver: 'ogc_api_features_temporal_end',
      crs: 'EPSG:4326',
    })
  })

  test('parses gml format with iso19139_xml', () => {
    const o = parseDownloadOfficial({
      official: {
        download: {
          url: 'https://example.com/wfs?request=GetFeature',
          format: 'gml',
          upstreamDateResolver: 'iso19139_xml',
          upstreamMetadataUrl: 'https://example.test/brandenburg.xml',
          upstreamDateSourceKind: 'wfs_capabilities',
        },
      },
    })
    expect(o).toEqual({
      kind: 'http',
      url: 'https://example.com/wfs?request=GetFeature',
      format: 'gml',
      upstreamDateResolver: 'iso19139_xml',
      upstreamMetadataUrl: 'https://example.test/brandenburg.xml',
      upstreamDateSourceKind: 'wfs_capabilities',
    })
  })

  test('rejects unsupported kind/format/resolver', () => {
    expect(() =>
      parseDownloadOfficial({
        official: {
          download: {
            url: 'https://x',
            kind: 'ftp',
            upstreamDateResolver: 'wfs_inspire_iso19139',
          },
        },
      }),
    ).toThrow(/kind/)
    expect(() =>
      parseDownloadOfficial({
        official: {
          download: {
            url: 'https://x',
            format: 'gml',
            upstreamDateResolver: 'iso19139_xml',
          },
        },
      }),
    ).toThrow()
    expect(() =>
      parseDownloadOfficial({
        official: {
          download: {
            url: 'https://x',
            format: 'zip',
            upstreamDateResolver: 'wfs_inspire_iso19139',
          },
        },
      }),
    ).toThrow(/format/)
    expect(() =>
      parseDownloadOfficial({
        official: { download: { url: 'https://x', format: 'geojson' } },
      }),
    ).toThrow()
  })
})
