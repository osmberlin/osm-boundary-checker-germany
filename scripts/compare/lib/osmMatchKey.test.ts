import { describe, expect, test } from 'bun:test'
import type { Feature, Polygon } from 'geojson'
import {
  canonicalOsmMatchKey,
  keepOsmFeaturesForSpatialScope,
  osmFeatureHasOfficialMatchKey,
  type OsmMatchKeyContext,
} from './osmMatchKey.ts'

const rsCtx: OsmMatchKeyContext = {
  relationIdCriteria: null,
  isRsMode: true,
  osmMatchProperty: 'de:regionalschluessel',
  preset: 'regional-12',
}

function square(props: Record<string, unknown>, lon: number, lat: number): Feature<Polygon> {
  const h = 0.001
  return {
    type: 'Feature',
    properties: props,
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon - h, lat - h],
          [lon + h, lat - h],
          [lon + h, lat + h],
          [lon - h, lat + h],
          [lon - h, lat - h],
        ],
      ],
    },
  }
}

describe('canonicalOsmMatchKey', () => {
  test('normalizes de:regionalschluessel in RS mode', () => {
    expect(canonicalOsmMatchKey({ 'de:regionalschluessel': '034579501501' }, rsCtx)).toBe(
      '034579501501',
    )
  })

  test('returns null when RS tag is missing', () => {
    expect(canonicalOsmMatchKey({ name: 'Insel Lütje Hörn' }, rsCtx)).toBeNull()
  })

  test('uses postal_code outside RS mode', () => {
    const ctx: OsmMatchKeyContext = {
      relationIdCriteria: null,
      isRsMode: false,
      osmMatchProperty: 'postal_code',
      preset: 'plz-5',
    }
    expect(canonicalOsmMatchKey({ postal_code: '10115' }, ctx)).toBe('10115')
  })

  test('relation_id mode only accepts configured relations', () => {
    const ctx: OsmMatchKeyContext = {
      relationIdCriteria: new Set(['51477']),
      isRsMode: false,
      osmMatchProperty: 'de:regionalschluessel',
      preset: 'regional-12',
    }
    expect(canonicalOsmMatchKey({ '@id': 'relation/51477' }, ctx)).not.toBeNull()
    expect(canonicalOsmMatchKey({ '@id': 'relation/1' }, ctx)).toBeNull()
  })
})

describe('keepOsmFeaturesForSpatialScope', () => {
  const lutje = square(
    { 'de:regionalschluessel': '034579501501', name: 'Insel Lütje Hörn' },
    6.85,
    53.59,
  )
  const neighbourRibbon = square(
    { 'de:regionalschluessel': '081365002087', name: 'Riesbürg' },
    10.2,
    48.8,
  )
  const unkeyed = square({ name: 'no-rs' }, 9.0, 50.0)
  const officialKeys = new Set(['034579501501'])

  test('keeps keyed OSM that spatial scope dropped (drifted island)', () => {
    const kept = keepOsmFeaturesForSpatialScope(
      [lutje, neighbourRibbon, unkeyed],
      new Set(),
      officialKeys,
      rsCtx,
    )
    expect(kept).toEqual([lutje])
  })

  test('still drops unkeyed and foreign-key OSM that spatial scope dropped', () => {
    const kept = keepOsmFeaturesForSpatialScope(
      [neighbourRibbon, unkeyed],
      new Set(),
      officialKeys,
      rsCtx,
    )
    expect(kept).toEqual([])
  })

  test('keeps spatially accepted indexes even without an official key', () => {
    const kept = keepOsmFeaturesForSpatialScope(
      [lutje, neighbourRibbon, unkeyed],
      new Set([1]),
      officialKeys,
      rsCtx,
    )
    expect(kept).toEqual([lutje, neighbourRibbon])
  })

  test('osmFeatureHasOfficialMatchKey is false for a neighbour ARS', () => {
    expect(osmFeatureHasOfficialMatchKey(neighbourRibbon, officialKeys, rsCtx)).toBe(false)
    expect(osmFeatureHasOfficialMatchKey(lutje, officialKeys, rsCtx)).toBe(true)
  })
})
