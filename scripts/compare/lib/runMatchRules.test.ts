import { describe, expect, test } from 'bun:test'
import type { Feature } from 'geojson'
import type { MatchRule } from '../../shared/matchRules.ts'
import {
  type KeyJoinOsmEntry,
  type MatchRuleRow,
  normalizeOsmObjectRef,
  runMatchRules,
} from './runMatchRules.ts'

const square = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
}

function osm(id: string, props: Record<string, unknown> = {}): Feature {
  return { type: 'Feature', geometry: square, properties: { '@id': id, ...props } }
}

function row(key: string, properties: Record<string, unknown> | null = {}): MatchRuleRow {
  return { key, properties, hasGeometry: true }
}

const KEY_RULE: MatchRule = { kind: 'key', officialProperty: 'match_key', osmTag: 'ref:WDPA' }
const REF_RULE: MatchRule = { kind: 'osm_reference', officialProperty: 'dtp_osm_ref' }
const TAG_RULE: MatchRule = { kind: 'osm_tag', officialProperty: 'dtp_uuid', osmTag: 'dtp_id' }

/** `ref:WDPA` is the join key of the fixture features. */
function run(
  rules: MatchRule[],
  rows: MatchRuleRow[],
  features: Feature[],
  extra: { officialKeys?: string[] } = {},
) {
  const osmByKey = new Map<string, KeyJoinOsmEntry>()
  for (const feature of features) {
    const key = (feature.properties as Record<string, unknown>)['ref:WDPA']
    if (typeof key !== 'string') continue
    osmByKey.set(key, {
      geometry: feature.geometry,
      properties: feature.properties,
      featureIds: [String((feature.properties as Record<string, unknown>)['@id'])],
    })
  }
  return runMatchRules({
    rules,
    rows,
    osmByKey,
    osmFeatures: features,
    osmKeyOf: (props) => (typeof props['ref:WDPA'] === 'string' ? props['ref:WDPA'] : null),
    officialKeySet: new Set(extra.officialKeys ?? rows.map((r) => r.key)),
  })
}

describe('normalizeOsmObjectRef', () => {
  test('reads type/id from refs and osm.org URLs, rejects the rest', () => {
    expect(normalizeOsmObjectRef('relation/12')).toBe('relation/12')
    expect(normalizeOsmObjectRef('https://www.openstreetmap.org/Way/5')).toBe('way/5')
    expect(normalizeOsmObjectRef('node/5')).toBeNull()
    expect(normalizeOsmObjectRef(null)).toBeNull()
  })
})

describe('runMatchRules', () => {
  test('rules run in order and record which rule matched', () => {
    const features = [
      osm('relation/1', { 'ref:WDPA': '100' }),
      osm('relation/10', { name: 'by ref' }),
      osm('relation/20', { dtp_id: 'AAAA-1' }),
    ]
    const rows = [
      row('100'),
      row('dtp-a', { dtp_osm_ref: 'relation/10' }),
      row('dtp-b', { dtp_uuid: 'aaaa-1' }),
      row('dtp-c', { dtp_osm_ref: 'relation/99' }),
    ]
    const { matches } = run([KEY_RULE, REF_RULE, TAG_RULE], rows, features)
    expect(matches.get('100')?.by).toEqual({ rule: 0, kind: 'key' })
    expect(matches.get('dtp-a')?.by).toEqual({ rule: 1, kind: 'osm_reference' })
    expect(matches.get('dtp-a')?.osm.featureIds).toEqual(['relation/10'])
    expect(matches.get('dtp-b')?.by).toEqual({ rule: 2, kind: 'osm_tag' })
    expect(matches.has('dtp-c')).toBe(false)
  })

  test('a later rule only looks at rows the earlier rules left unmatched', () => {
    const features = [osm('relation/10'), osm('relation/20', { dtp_id: 'aaaa-1' })]
    const row1 = row('dtp-a', { dtp_osm_ref: 'relation/10', dtp_uuid: 'aaaa-1' })
    const refFirst = run([KEY_RULE, REF_RULE, TAG_RULE], [row1], features).matches.get('dtp-a')
    expect(refFirst?.osm.featureIds).toEqual(['relation/10'])
    const tagFirst = run([KEY_RULE, TAG_RULE, REF_RULE], [row1], features).matches.get('dtp-a')
    expect(tagFirst?.osm.featureIds).toEqual(['relation/20'])
  })

  test('an OSM object is used for one row only', () => {
    const features = [osm('relation/10')]
    const rows = [
      row('dtp-a', { dtp_osm_ref: 'relation/10' }),
      row('dtp-b', { dtp_osm_ref: 'relation/10' }),
    ]
    const { matches, usedObjects } = run([KEY_RULE, REF_RULE], rows, features)
    expect([...matches.keys()]).toEqual(['dtp-a'])
    expect(usedObjects.has('relation/10')).toBe(true)
  })

  test('a reference does not take an object that the key join gave to another row', () => {
    const features = [osm('relation/1', { 'ref:WDPA': '100' })]
    const rows = [row('100'), row('dtp-a', { dtp_osm_ref: 'relation/1' })]
    const { matches } = run([KEY_RULE, REF_RULE], rows, features)
    expect(matches.get('100')?.by.kind).toBe('key')
    expect(matches.has('dtp-a')).toBe(false)
  })

  test('an object keyed to an official row stays reserved for that key even when its rule comes later', () => {
    const features = [osm('relation/1', { 'ref:WDPA': '100' })]
    const rows = [row('100'), row('dtp-a', { dtp_osm_ref: 'relation/1' })]
    const { matches } = run([REF_RULE, KEY_RULE], rows, features)
    expect(matches.get('100')?.by).toEqual({ rule: 1, kind: 'key' })
    expect(matches.has('dtp-a')).toBe(false)
  })

  test('objects paired by an object rule report their join key as consumed', () => {
    const features = [osm('relation/10', { 'ref:WDPA': '777' })]
    const rows = [row('dtp-a', { dtp_osm_ref: 'relation/10' })]
    const { matches, consumedOsmKeys } = run([KEY_RULE, REF_RULE], rows, features, {
      officialKeys: ['dtp-a'],
    })
    expect(matches.get('dtp-a')?.by.kind).toBe('osm_reference')
    expect([...consumedOsmKeys]).toEqual(['777'])
  })

  test('osm_tag matches any part of a ;-separated tag value, case-insensitive; rows without geometry are skipped', () => {
    const features = [osm('relation/20', { dtp_id: 'x;AAAA-1' })]
    const rows: MatchRuleRow[] = [
      row('dtp-a', { dtp_uuid: 'aaaa-1' }),
      { key: 'dtp-b', properties: { dtp_uuid: 'x' }, hasGeometry: false },
    ]
    const { matches } = run([KEY_RULE, TAG_RULE], rows, features)
    expect([...matches.keys()]).toEqual(['dtp-a'])
  })

  test('without any object rule only the key join runs', () => {
    const features = [osm('relation/1', { 'ref:WDPA': '100' }), osm('relation/10')]
    const rows = [row('100'), row('dtp-a', { dtp_osm_ref: 'relation/10' })]
    const { matches } = run([KEY_RULE], rows, features)
    expect([...matches.keys()]).toEqual(['100'])
  })
})
