import { describe, expect, test } from 'bun:test'
import { WIKIDATA_REGIONAL_SPARQL } from './wikidataRegionalSparqlQuery.ts'

describe('WIKIDATA_REGIONAL_SPARQL', () => {
  test('matches BestRank as a class, not as a wikibase:rank value', () => {
    expect(WIKIDATA_REGIONAL_SPARQL).toContain('?st a wikibase:BestRank')
    expect(WIKIDATA_REGIONAL_SPARQL).toContain('?popStmt a wikibase:BestRank')
    expect(WIKIDATA_REGIONAL_SPARQL).not.toContain('wikibase:rank wikibase:BestRank')
  })
})
