import { describe, expect, test } from 'bun:test'
import { parsePopulationNumber, primaryRegionalHubIssue } from '../shared/regionalHubCompare.ts'

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
})
