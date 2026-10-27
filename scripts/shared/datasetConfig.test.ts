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

  test('parses DtP config branch', () => {
    const parsed = parseDatasetConfig('area-dtp', {
      ...dtpBase,
      official: { dtp: { categoryIds: [1, 50] } },
    })
    expect(parsed.officialMode).toBe('dtp')
    if (parsed.officialMode !== 'dtp') throw new Error('Expected dtp config branch')
    expect(parsed.official.dtp).toEqual({ categoryIds: [1, 50] })
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

  describe('rowFlags', () => {
    const flag = {
      id: 'managed',
      officialProperty: 'some_property',
      equals: true,
      label: 'Label',
      hint: 'Hint',
    }
    const withFlags = (rowFlags: unknown) =>
      parseDatasetConfig('area-dtp', {
        ...dtpBase,
        official: { dtp: { categoryIds: [1] } },
        rowFlags,
      })

    test('parses optional rowFlags and leaves them undefined otherwise', () => {
      const parsed = withFlags([
        { ...flag, sortFirst: true, detailProperty: 'p', detailLabel: 'L' },
      ])
      expect(parsed.rowFlags).toEqual([
        { ...flag, sortFirst: true, detailProperty: 'p', detailLabel: 'L' },
      ])
      expect(withFlags(undefined).rowFlags).toBeUndefined()
    })

    test('rejects bad ids, duplicate ids, unknown keys and a lonely detail field', () => {
      for (const rowFlags of [
        [{ ...flag, id: 'Not Valid' }],
        [flag, flag],
        [{ ...flag, extra: 1 }],
        [{ ...flag, detailProperty: 'p' }],
        [{ ...flag, equals: null }],
      ]) {
        expect(() => withFlags(rowFlags)).toThrow()
      }
    })
  })

  describe('compare.attributeChecks', () => {
    const withChecks = (attributeChecks: unknown) =>
      parseDatasetConfig('area-dtp', {
        ...dtpBase,
        official: { dtp: { categoryIds: [1] } },
        compare: { ...dtpBase.compare, attributeChecks },
      })

    test('parses optional attributeChecks and leaves them undefined otherwise', () => {
      const checks = [
        { label: 'Wikidata', official: 'wikidata', osm: ['wikidata'] },
        {
          label: 'Name',
          official: 'name',
          osm: ['name', 'official_name'],
          compare: 'name' as const,
        },
      ]
      expect(withChecks(checks).compare.attributeChecks).toEqual(checks)
      expect(withChecks(undefined).compare.attributeChecks).toBeUndefined()
    })

    test('rejects empty lists, unknown modes and unknown keys', () => {
      for (const attributeChecks of [
        [],
        [{ label: 'W', official: 'w', osm: [] }],
        [{ label: 'W', official: 'w', osm: ['w'], compare: 'fuzzy' }],
        [{ label: 'W', official: 'w', osm: ['w'], extra: 1 }],
      ]) {
        expect(() => withChecks(attributeChecks)).toThrow()
      }
    })
  })

  describe('official.extractFilter', () => {
    const baseConfig = {
      displayName: 'Area Filter',
      titlePrefix: 'Area',
      osmProfile: 'admin_rs',
      idNormalization: { preset: 'regional-12' },
      metricsCrs: 'EPSG:25832',
      compare: {
        officialMatchProperty: 'ARS',
        bboxFilter: 'none',
        osmScopeFilter: 'none',
        minZoom: 0,
      },
    }

    test('accepts excludeValues without valuePrefix', () => {
      const parsed = parseDatasetConfig('area-exclude', {
        ...baseConfig,
        official: { extractFilter: { property: 'BEM', excludeValues: ['gemeinschaftsfrei'] } },
      })
      expect(parsed.officialMode).toBe('direct')
    })

    test('rejects a filter without valuePrefix or excludeValues', () => {
      expect(() =>
        parseDatasetConfig('area-empty-filter', {
          ...baseConfig,
          official: { extractFilter: { property: 'BEM' } },
        }),
      ).toThrow()
    })

    test('rejects an empty excludeValues list', () => {
      expect(() =>
        parseDatasetConfig('area-empty-exclude', {
          ...baseConfig,
          official: { extractFilter: { property: 'BEM', excludeValues: [] } },
        }),
      ).toThrow()
    })

    test('accepts extractFilter in profile mode', () => {
      const parsed = parseDatasetConfig('area-profile-filter', {
        ...baseConfig,
        officialProfile: 'bkg_vg25_vwg',
        official: { extractFilter: { property: 'BEM', excludeValues: ['gemeinschaftsfrei'] } },
      })
      expect(parsed.officialMode).toBe('profile')
      if (parsed.officialMode !== 'profile') throw new Error('expected profile mode')
      expect(parsed.official?.extractFilter?.excludeValues).toEqual(['gemeinschaftsfrei'])
    })

    test('rejects other official keys in profile mode', () => {
      expect(() =>
        parseDatasetConfig('area-profile-source', {
          ...baseConfig,
          officialProfile: 'bkg_vg25_vwg',
          official: { source: { note: 'x' } },
        }),
      ).toThrow()
    })
  })
})
