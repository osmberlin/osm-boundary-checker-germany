import { describe, expect, test } from 'bun:test'
import { parseDatasetConfig, sourceKindFromDatasetConfig } from './datasetConfig.ts'

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
    expect(sourceKindFromDatasetConfig(parsed)).toBe('official')
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

  const dtpBase = {
    displayName: 'Schutzgebiete',
    titlePrefix: 'Schutzgebiet',
    officialProfile: 'dtp_protected_areas',
    osmProfile: 'protected_area_wdpa',
    idNormalization: { preset: 'wdpa' },
    metricsCrs: 'EPSG:25832',
    compare: {
      officialMatchProperty: 'wdpa',
      bboxFilter: 'none',
      osmScopeFilter: 'none',
      minZoom: 5,
    },
  }

  test('parses DtP config branch and defaults requireWdpa', () => {
    const parsed = parseDatasetConfig('area-dtp', {
      ...dtpBase,
      official: { dtp: { categoryIds: [1, 50] } },
    })
    expect(parsed.officialMode).toBe('dtp')
    if (parsed.officialMode !== 'dtp') throw new Error('Expected dtp config branch')
    expect(parsed.official.dtp).toEqual({ categoryIds: [1, 50], requireWdpa: true })
    expect(sourceKindFromDatasetConfig(parsed)).toBe('dtp')
  })

  test('DtP config requires official.dtp', () => {
    expect(() => parseDatasetConfig('bad', dtpBase)).toThrow(/official/)
  })

  test('DtP config rejects empty, duplicate and non-integer categoryIds', () => {
    for (const categoryIds of [[], [1, 1], [1.5], [0]]) {
      expect(() =>
        parseDatasetConfig('bad', { ...dtpBase, official: { dtp: { categoryIds } } }),
      ).toThrow()
    }
  })

  test('DtP config rejects unknown keys', () => {
    expect(() =>
      parseDatasetConfig('bad', {
        ...dtpBase,
        official: { dtp: { categoryIds: [1], extra: true } },
      }),
    ).toThrow()
    expect(() =>
      parseDatasetConfig('bad', {
        ...dtpBase,
        official: { dtp: { categoryIds: [1] }, extractLayer: 'x' },
      }),
    ).toThrow()
  })

  test('official.dtp is not allowed with a BKG profile', () => {
    expect(() =>
      parseDatasetConfig('bad', {
        ...dtpBase,
        officialProfile: 'bkg_vg25_gem',
        official: { dtp: { categoryIds: [1] } },
      }),
    ).toThrow()
  })
})
