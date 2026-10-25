import { describe, expect, test } from 'bun:test'
import { toCompareRulesSummary } from './compareRulesSummary.ts'
import type { DatasetConfig } from './datasetConfig.ts'

describe('toCompareRulesSummary', () => {
  test('derives a relation_id rule from osm.matchCriteria', () => {
    const cfg = {
      officialMode: 'direct' as const,
      displayName: 'Test',
      titlePrefix: 'T',
      official: {},
      osmProfile: 'admin_rs' as const,
      idNormalization: { preset: 'regional-12' as const },
      metricsCrs: 'EPSG:25832',
      compare: {
        officialMatchProperty: 'ARS',
        bboxFilter: 'none' as const,
        osmScopeFilter: 'none' as const,
        minZoom: 0,
      },
      osm: {
        matchCriteria: { kind: 'relation_id' as const, relationIds: ['51477'] },
      },
    } satisfies DatasetConfig
    expect(toCompareRulesSummary(cfg)).toEqual({
      idNormalizationPreset: 'regional-12',
      matchRules: [{ kind: 'relation_id', relationIds: ['51477'] }],
    })
  })

  test('derives one key rule when matchRules and matchCriteria are absent', () => {
    const cfg = {
      officialMode: 'direct' as const,
      displayName: 'Test',
      titlePrefix: 'T',
      official: {},
      osmProfile: 'admin_rs' as const,
      idNormalization: { preset: 'amtlicher-8' as const },
      metricsCrs: 'EPSG:25832',
      compare: {
        officialMatchProperty: 'ARS',
        bboxFilter: 'none' as const,
        osmScopeFilter: 'none' as const,
        minZoom: 0,
      },
    } satisfies DatasetConfig
    expect(toCompareRulesSummary(cfg)).toEqual({
      idNormalizationPreset: 'amtlicher-8',
      matchRules: [{ kind: 'key', officialProperty: 'ARS', osmTag: 'de:regionalschluessel' }],
    })
  })
})
