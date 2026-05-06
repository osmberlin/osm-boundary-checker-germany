import { describe, expect, test } from 'bun:test'
import { parseDatasetConfig } from './datasetConfig.ts'

describe('parseDatasetConfig', () => {
  test('parses direct HTTP config branch', () => {
    const parsed = parseDatasetConfig('area-http', {
      displayName: 'Area HTTP',
      titlePrefix: 'Area',
      official: {
        source: { sourcePublicUrl: 'https://example.test/info' },
        download: { url: 'https://example.test/wfs', upstreamDateResolver: 'wfs_inspire_iso19139' },
      },
      osmProfile: 'admin_rs',
      idNormalization: { preset: 'regional-12' },
      metricsCrs: 'EPSG:25832',
      compare: {
        officialMatchProperty: 'ars',
        bboxFilter: 'none',
        osmScopeFilter: 'none',
      },
    })
    expect(parsed.officialMode).toBe('direct')
  })

  test('parses profile-driven config branch', () => {
    const parsed = parseDatasetConfig('area-bkg', {
      displayName: 'Area BKG',
      titlePrefix: 'Area',
      officialProfile: 'bkg_vg25_gem',
      osmProfile: 'admin_rs',
      idNormalization: { preset: 'regional-12' },
      metricsCrs: 'EPSG:25832',
      compare: {
        officialMatchProperty: 'ARS',
        bboxFilter: 'none',
        osmScopeFilter: 'none',
      },
    })
    expect(parsed.officialMode).toBe('profile')
  })

  test('rejects mixed officialProfile + official object', () => {
    expect(() =>
      parseDatasetConfig('area-invalid', {
        displayName: 'Area Invalid',
        titlePrefix: 'Area',
        officialProfile: 'bkg_vg25_gem',
        official: {},
        osmProfile: 'admin_rs',
        idNormalization: { preset: 'regional-12' },
        metricsCrs: 'EPSG:25832',
        compare: {
          officialMatchProperty: 'ARS',
          bboxFilter: 'none',
          osmScopeFilter: 'none',
        },
      }),
    ).toThrow()
  })
})
