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
        minZoom: 0,
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
        minZoom: 6,
      },
    })
    expect(parsed.officialMode).toBe('profile')
    expect(parsed.compare).toMatchObject({ minZoom: 6 })
  })

  test('rejects compare.minZoom out of range', () => {
    expect(() =>
      parseDatasetConfig('bad', {
        displayName: 'X',
        titlePrefix: 'X',
        officialProfile: 'bkg_vg25_gem',
        osmProfile: 'admin_rs',
        idNormalization: { preset: 'regional-12' },
        metricsCrs: 'EPSG:25832',
        compare: {
          officialMatchProperty: 'ARS',
          bboxFilter: 'none',
          osmScopeFilter: 'none',
          minZoom: 16,
        },
      }),
    ).toThrow()
  })

  test('maps legacy osmScopeFilter centroid alias to intersects_official_coverage', () => {
    const parsed = parseDatasetConfig('area-legacy', {
      displayName: 'Legacy scope',
      titlePrefix: 'Area',
      officialProfile: 'bkg_vg25_gem',
      osmProfile: 'admin_rs',
      idNormalization: { preset: 'regional-12' },
      metricsCrs: 'EPSG:25832',
      compare: {
        officialMatchProperty: 'ARS',
        bboxFilter: 'none',
        osmScopeFilter: 'centroid_in_official_coverage',
        minZoom: 0,
      },
    })
    expect(parsed.compare.osmScopeFilter).toBe('intersects_official_coverage')
  })
})
