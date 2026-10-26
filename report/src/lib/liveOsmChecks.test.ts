import { describe, expect, test } from 'vitest'
import type { AttributeCheckConfig } from '../../../scripts/shared/attributeChecks.ts'
import { liveOsmCheckResults, liveOsmTagMarkers } from './liveOsmChecks'

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
})

describe('liveOsmTagMarkers', () => {
  test('marks equal and different tags by key', () => {
    const results = liveOsmCheckResults(checks, official, { wikidata: 'Q1', name: 'Anderswo' })
    const markers = liveOsmTagMarkers(results, official)
    expect(markers.get('wikidata')?.map((m) => m.equal)).toEqual([true])
    expect(markers.get('name')?.map((m) => m.equal)).toEqual([false])
    expect(markers.has('ref')).toBe(false)
  })
})
