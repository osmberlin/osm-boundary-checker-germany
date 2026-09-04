import { describe, expect, test } from 'bun:test'
import {
  numericOsmRelationId,
  parsePopulationNumber,
  primaryRegionalHubIssue,
  regionalHubCellTones,
} from '../shared/regionalHubCompare.ts'

describe('primaryRegionalHubIssue', () => {
  test('prefers adding OSM wikidata when P1388 is unique and P402 agrees', () => {
    expect(
      primaryRegionalHubIssue({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmId: 'relation/62470',
        wdQid: 'Q3931',
        wdOsmRelationId: '62470',
        wdPop: 73921,
        wdDate: '2023-12-31',
      }),
    ).toBe('osm_wikidata')
  })

  test('does not suggest OSM wikidata when P402 points at another relation', () => {
    expect(
      primaryRegionalHubIssue({
        osmId: 'relation/111',
        wdQid: 'Q3931',
        wdOsmRelationId: '62470',
        destatisPop: 74113,
        destatisDate: '2024-12-31',
      }),
    ).toBe('osm_population')
  })

  test('does not suggest OSM wikidata when OSM has no relation', () => {
    expect(
      primaryRegionalHubIssue({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        wdQid: 'Q3931',
        wdOsmRelationId: '62470',
      }),
    ).toBe('osm_population')
  })

  test('does not suggest OSM wikidata on QID mismatch when P402 disagrees', () => {
    expect(
      primaryRegionalHubIssue({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmId: 'relation/111',
        osmWikidata: 'Q9999',
        wdQid: 'Q3931',
        wdOsmRelationId: '62470',
      }),
    ).toBe('osm_population')
  })

  test('suggests OSM wikidata on QID mismatch when P402 agrees', () => {
    expect(
      primaryRegionalHubIssue({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmId: 'relation/62470',
        osmWikidata: 'Q9999',
        wdQid: 'Q3931',
        wdOsmRelationId: '62470',
        wdPop: 73921,
        wdDate: '2023-12-31',
      }),
    ).toBe('osm_wikidata')
  })

  test('asks for OSM population when Destatis is newer', () => {
    expect(
      primaryRegionalHubIssue({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmPop: 74113,
        osmDate: '2023-12-31',
        osmWikidata: 'Q3931',
        osmId: 'relation/62470',
        wdQid: 'Q3931',
        wdPop: 74113,
        wdDate: '2024-12-31',
      }),
    ).toBe('osm_population')
  })

  test('asks for Wikidata P1082 when OSM already matches Destatis', () => {
    expect(
      primaryRegionalHubIssue({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmPop: 74113,
        osmDate: '2024-12-31',
        osmWikidata: 'Q3931',
        osmId: 'relation/62470',
        wdQid: 'Q3931',
        wdPop: 73921,
        wdDate: '2023-12-31',
      }),
    ).toBe('wikidata_population')
  })

  test('asks for P402 last', () => {
    expect(
      primaryRegionalHubIssue({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmPop: 74113,
        osmDate: '2024-12-31',
        osmWikidata: 'Q3931',
        osmId: 'relation/62470',
        wdQid: 'Q3931',
        wdPop: 74113,
        wdDate: '2024-12-31',
      }),
    ).toBe('wikidata_p402')
  })

  test('parsePopulationNumber strips grouping characters', () => {
    expect(parsePopulationNumber('74.113')).toBe(74113)
    expect(parsePopulationNumber('74,113')).toBe(74113)
  })

  test('numericOsmRelationId ignores ways and requires a relation id', () => {
    expect(numericOsmRelationId('relation/62470')).toBe('62470')
    expect(numericOsmRelationId('62470')).toBe('62470')
    expect(numericOsmRelationId('way/62470')).toBeUndefined()
  })
})

describe('regionalHubCellTones', () => {
  test('marks Destatis as the matching reference and OSM/WD population as off', () => {
    expect(
      regionalHubCellTones({
        destatisPop: 3700577,
        destatisDate: '2025-12-31',
        osmPop: 3769962,
        osmWikidata: 'Q64',
        osmId: 'relation/62422',
        wdQid: 'Q64',
        wdPop: 3782202,
        wdDate: '2023-12-31',
        wdOsmRelationId: '62422',
      }),
    ).toEqual({
      destatisPop: 'ok',
      destatisDate: 'ok',
      osmPop: 'bad',
      osmDate: 'neutral',
      wdPop: 'bad',
      wdDate: 'bad',
      osmWikidata: 'ok',
      wdQid: 'ok',
      osmRelation: 'ok',
      wdP402: 'ok',
    })
  })

  test('keeps a matching OSM population green when only the date is stale', () => {
    expect(
      regionalHubCellTones({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmPop: 74113,
        osmDate: '2023-12-31',
        osmWikidata: 'Q3931',
        osmId: 'relation/62470',
        wdQid: 'Q3931',
        wdPop: 74113,
        wdDate: '2024-12-31',
        wdOsmRelationId: '62470',
      }),
    ).toMatchObject({
      osmPop: 'ok',
      osmDate: 'bad',
      wdPop: 'ok',
      wdDate: 'ok',
    })
  })

  test('treats a missing Wikidata P402 as bad once OSM and Wikidata are linked', () => {
    expect(
      regionalHubCellTones({
        destatisPop: 74113,
        destatisDate: '2024-12-31',
        osmPop: 74113,
        osmDate: '2024-12-31',
        osmWikidata: 'Q3931',
        osmId: 'relation/62470',
        wdQid: 'Q3931',
        wdPop: 74113,
        wdDate: '2024-12-31',
      }).wdP402,
    ).toBe('bad')
  })

  test('keeps an OSM wikidata tag as ok when Wikidata has no P1388 for the ARS', () => {
    expect(
      regionalHubCellTones({
        destatisPop: 167209,
        destatisDate: '2025-12-31',
        osmWikidata: 'Q2937',
        osmId: 'relation/27019',
      }),
    ).toMatchObject({
      osmWikidata: 'ok',
      wdQid: 'bad',
    })
  })
})
