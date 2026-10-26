import { describe, expect, test } from 'bun:test'
import { wikidataShardForRow } from './wikidataShard.ts'

const byQid = {
  Q1: { label: 'Eins', wdpa: ['10'], osmRelation: ['5'], areaHa: 12.5 },
  Q2: { label: 'Zwei' },
}

describe('wikidataShardForRow', () => {
  test('embeds the item of the official property', () => {
    expect(wikidataShardForRow({ wikidata: 'Q1' }, null, byQid)).toEqual({
      official: { qid: 'Q1', ...byQid.Q1 },
    })
  })

  test('adds the OSM item only when it differs', () => {
    expect(wikidataShardForRow({ wikidata: 'Q1' }, { wikidata: 'Q1' }, byQid).osm).toBeUndefined()
    expect(wikidataShardForRow({ wikidata: 'Q1' }, { wikidata: 'Q2' }, byQid)).toEqual({
      official: { qid: 'Q1', ...byQid.Q1 },
      osm: { qid: 'Q2', ...byQid.Q2 },
    })
  })

  test('uses the OSM item alone when the official record has none, first id of a list', () => {
    expect(wikidataShardForRow({ wikidata: null }, { wikidata: 'Q2;Q1' }, byQid)).toEqual({
      osm: { qid: 'Q2', ...byQid.Q2 },
    })
  })

  test('marks an id missing from the dump and returns {} without any reference', () => {
    expect(wikidataShardForRow({ wikidata: 'Q99' }, null, byQid)).toEqual({
      official: { qid: 'Q99', notFound: true },
    })
    expect(wikidataShardForRow({ wikidata: '' }, { name: 'x' }, byQid)).toEqual({})
  })
})
