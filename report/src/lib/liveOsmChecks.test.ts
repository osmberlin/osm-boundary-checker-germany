import { describe, expect, test } from 'vitest'
import type { AttributeCheckConfig } from '../../../scripts/shared/attributeChecks.ts'
import {
  describeLiveOsmTagChange,
  liveOsmCheckResults,
  liveOsmTagChanges,
  liveOsmTagMarkers,
} from './liveOsmChecks'

const checks: AttributeCheckConfig[] = [
  { label: 'Wikidata', official: 'wikidata', osm: ['wikidata'] },
  { label: 'Name', official: 'name', osm: ['name'], compare: 'name' },
]
const official = { wikidata: 'Q1', name: 'Heide' }

describe('liveOsmCheckResults', () => {
  test('without checks there are no results', () => {
    expect(liveOsmCheckResults(undefined, official, { wikidata: 'Q1' })).toEqual([])
  })

  test('drops checks whose OSM keys are missing', () => {
    const results = liveOsmCheckResults(checks, official, { wikidata: 'Q1' })
    expect(results.map((r) => r.label)).toEqual(['Wikidata'])
  })

  test('keeps a live tag that the official record lacks, marked as missing', () => {
    const results = liveOsmCheckResults(
      checks,
      { name: 'Heide' },
      { wikidata: 'Q9', name: 'Heide' },
    )
    expect(results.map((r) => r.status)).toEqual(['missing_reference', 'equal'])
    const markers = liveOsmTagMarkers(results, { name: 'Heide' }, 'dtp')
    expect(markers.get('wikidata')).toEqual([
      { equal: false, missing: true, tooltip: 'fehlt bei DtP' },
    ])
  })

  test('has no results without live tags', () => {
    expect(liveOsmCheckResults(checks, official, {})).toEqual([])
  })
})

describe('liveOsmTagMarkers', () => {
  test('marks exactly the OSM keys the checks read, nothing for other tags or no OSM side', () => {
    const results = liveOsmCheckResults(checks, official, {
      wikidata: 'Q1',
      name: 'Heide',
      ref: '1',
    })
    const markers = liveOsmTagMarkers(results, official, 'dtp')
    expect([...markers.keys()].sort()).toEqual(['name', 'wikidata'])
    expect(markers.get('wikidata')).toEqual([
      { equal: true, tooltip: 'gleich wie bei DtP (wikidata: Q1)' },
    ])
    expect(liveOsmTagMarkers(liveOsmCheckResults(checks, official, {}), official).size).toBe(0)
  })

  test('marks equal and different tags by key', () => {
    const results = liveOsmCheckResults(checks, official, { wikidata: 'Q1', name: 'Anderswo' })
    const markers = liveOsmTagMarkers(results, official)
    expect(markers.get('wikidata')?.map((m) => m.equal)).toEqual([true])
    expect(markers.get('name')?.map((m) => m.equal)).toEqual([false])
    expect(markers.has('ref')).toBe(false)
  })
})

describe('liveOsmTagChanges', () => {
  const snapshot = { '@id': 'way/1', name: 'Heide', wikidata: 'Q1', operator: 'A' }

  test('reports changed, added and removed tags the extract carries', () => {
    const changes = liveOsmTagChanges(snapshot, { name: 'Heide', wikidata: 'Q2', 'ref:WDPA': '5' })
    expect(changes).toEqual([
      { key: 'ref:WDPA', before: null, after: '5' },
      { key: 'wikidata', before: 'Q1', after: 'Q2' },
      { key: 'operator', before: 'A', after: null },
    ])
    expect(changes.map(describeLiveOsmTagChange)).toEqual([
      'ref:WDPA neu (5)',
      'wikidata: Q1 → Q2',
      'operator entfernt (war A)',
    ])
  })

  test('ignores tags the extract does not carry and reports nothing when equal', () => {
    expect(
      liveOsmTagChanges(snapshot, { name: 'Heide', wikidata: 'Q1', operator: 'A', fixme: 'x' }),
    ).toEqual([])
  })
})
