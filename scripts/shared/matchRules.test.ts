import { describe, expect, test } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadBoundaryConfig } from '../compare/lib/config.ts'
import { loadAreaConfig } from './areaConfig.ts'
import { parseDatasetConfig } from './datasetConfig.ts'
import { DATASETS_DIRECTORY } from './datasetPaths.ts'
import { type MatchRule, resolveMatchRules, resolveOfficialMatchProperty } from './matchRules.ts'
import { resolveOsmProfile } from './osmProfiles.ts'
import { workspaceRootFromHere } from './workspaceRoot.ts'

const workspaceRoot = workspaceRootFromHere(import.meta.url)

const base = {
  displayName: 'Schutzgebiete',
  titlePrefix: 'Schutzgebiet',
  officialProfile: 'dtp_protected_areas',
  official: { dtp: { categoryIds: [2] } },
  osmProfile: 'protected_area_wdpa',
  idNormalization: { preset: 'wdpa' },
  metricsCrs: 'EPSG:25832',
}
const compare = { bboxFilter: 'none', osmScopeFilter: 'none', minZoom: 5 }
const threeRules: MatchRule[] = [
  { kind: 'key', officialProperty: 'match_key', osmTag: 'ref:WDPA' },
  { kind: 'osm_reference', officialProperty: 'dtp_osm_ref' },
  { kind: 'osm_tag', officialProperty: 'dtp_uuid', osmTag: 'dtp_id' },
]

describe('compare.matchRules', () => {
  test('parses ordered rules; the key rule supplies the official match property', () => {
    const parsed = parseDatasetConfig('dtp', {
      ...base,
      compare: { ...compare, matchRules: threeRules },
    })
    expect(resolveMatchRules(parsed)).toEqual(threeRules)
    expect(resolveOfficialMatchProperty(parsed)).toBe('match_key')
  })

  test('rejects unknown rule kinds and extra keys', () => {
    for (const matchRules of [
      [{ kind: 'fuzzy', officialProperty: 'x' }],
      [{ kind: 'osm_reference', officialProperty: 'x', osmTag: 'y' }],
      [{ kind: 'osm_tag', officialProperty: 'x' }],
      [],
    ]) {
      expect(() =>
        parseDatasetConfig('bad', { ...base, compare: { ...compare, matchRules } }),
      ).toThrow()
    }
  })

  test('needs exactly one key or relation_id rule', () => {
    const only = (matchRules: unknown) => () =>
      parseDatasetConfig('bad', {
        ...base,
        compare: { ...compare, officialMatchProperty: 'match_key', matchRules },
      })
    expect(only([threeRules[1]])).toThrow(/exactly one/)
    expect(only([threeRules[0], threeRules[0]])).toThrow(/exactly one/)
  })

  test('the key rule must agree with officialMatchProperty and the OSM profile tag', () => {
    const with_ = (rule: MatchRule, officialMatchProperty?: string) => () =>
      parseDatasetConfig('bad', {
        ...base,
        compare: {
          ...compare,
          ...(officialMatchProperty ? { officialMatchProperty } : {}),
          matchRules: [rule],
        },
      })
    expect(with_(threeRules[0]!, 'other')).toThrow(/officialMatchProperty/)
    expect(with_(threeRules[0]!, 'match_key')).not.toThrow()
    expect(with_({ kind: 'key', officialProperty: 'match_key', osmTag: 'wikidata' })).toThrow(
      /osmProfile/,
    )
  })

  test('matchRules replace osm.matchCriteria; configs need a key property one way or the other', () => {
    expect(() =>
      parseDatasetConfig('bad', {
        ...base,
        osm: { matchCriteria: { kind: 'property' } },
        compare: { ...compare, matchRules: [threeRules[0]] },
      }),
    ).toThrow(/matchCriteria/)
    expect(() => parseDatasetConfig('bad', { ...base, compare })).toThrow(/officialMatchProperty/)
  })
})

describe('rules derived for configs without compare.matchRules', () => {
  const datasets = readdirSync(join(workspaceRoot, DATASETS_DIRECTORY)).filter((name) =>
    existsSync(join(workspaceRoot, DATASETS_DIRECTORY, name, 'config.jsonc')),
  )

  test('there are dataset configs to check', () => {
    expect(datasets.length).toBeGreaterThan(10)
  })

  test('every dataset yields the rule set its officialMatchProperty / osmProfile / matchCriteria described', () => {
    for (const name of datasets) {
      const config = loadAreaConfig(workspaceRoot, name)
      const rules = resolveMatchRules(config)
      if (config.compare.matchRules) {
        expect(rules).toEqual(config.compare.matchRules)
        continue
      }
      const criteria = config.osm?.matchCriteria
      const expected: MatchRule[] =
        criteria?.kind === 'relation_id'
          ? [{ kind: 'relation_id', relationIds: criteria.relationIds }]
          : [
              {
                kind: 'key',
                officialProperty: config.compare.officialMatchProperty!,
                osmTag: resolveOsmProfile(config.osmProfile).matchProperty,
              },
            ]
      expect(rules).toEqual(expected)
      expect(loadBoundaryConfig(config, name).matchRules).toEqual(expected)
    }
  })

  test('known datasets', () => {
    const rules = (name: string) => resolveMatchRules(loadAreaConfig(workspaceRoot, name))
    expect(rules('de-landkreise')).toEqual([
      { kind: 'key', officialProperty: 'ARS', osmTag: 'de:regionalschluessel' },
    ])
    expect(rules('de-staat')).toEqual([{ kind: 'relation_id', relationIds: ['51477'] }])
  })

  test('the four DtP datasets declare the same five rules, the reviewed override before DtP references', () => {
    const dtpRules: MatchRule[] = [
      { kind: 'key', officialProperty: 'match_key', osmTag: 'ref:WDPA' },
      { kind: 'osm_reference', officialProperty: 'override_osm_ref' },
      { kind: 'osm_tag', officialProperty: 'wikidata', osmTag: 'wikidata' },
      { kind: 'osm_reference', officialProperty: 'dtp_osm_ref' },
      { kind: 'osm_tag', officialProperty: 'dtp_uuid', osmTag: 'dtp_id' },
    ]
    for (const name of [
      'de-schutzgebiete-nsg',
      'de-schutzgebiete-lsg',
      'de-natura2000',
      'de-grossschutzgebiete',
    ]) {
      const config = loadAreaConfig(workspaceRoot, name)
      expect(config.compare.matchRules).toEqual(dtpRules)
      expect(loadBoundaryConfig(config, name).official.matchProperty).toBe('match_key')
    }
  })
})
