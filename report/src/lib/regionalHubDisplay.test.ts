import { describe, expect, it } from 'vitest'
import { overlayLiveOsmTags } from './regionalHubDisplay'

describe('overlayLiveOsmTags', () => {
  it('keeps extract tags when Overpass has not returned', () => {
    expect(overlayLiveOsmTags({ osmId: 'relation/62422', wikidata: 'Q64' }, undefined)).toEqual({
      osmId: 'relation/62422',
      wikidata: 'Q64',
    })
  })

  it('uses live wikidata even when the extract snapshot omitted the tag', () => {
    expect(
      overlayLiveOsmTags({ osmId: 'relation/62422' }, { wikidata: 'Q64', population: '3769962' }),
    ).toEqual({
      osmId: 'relation/62422',
      wikidata: 'Q64',
      population: '3769962',
    })
  })
})
