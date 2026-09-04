import { WIKIDATA_REGIONAL_SPARQL } from '../shared/wikidataRegionalSparqlQuery.ts'

export const WIKIDATA_SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'

export const WIKIDATA_SPARQL_USER_AGENT =
  'OSM-Grenzabgleich/regional-hub (https://github.com/osmberlin/osm-boundary-checker-germany; destatis-osm-wikidata compare)'

const LAND_PREFIXES = Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0'))

export function wikidataSparqlForLandPrefix(land: string) {
  return WIKIDATA_REGIONAL_SPARQL.replace(
    '?item wdt:P1388 ?ars .',
    `?item wdt:P1388 ?ars .\n  FILTER(STRSTARTS(STR(?ars), "${land}"))`,
  )
}

export function allWikidataSparqlQueries() {
  return [{ label: 'all', query: WIKIDATA_REGIONAL_SPARQL }]
}

export function splitWikidataSparqlQueries() {
  return LAND_PREFIXES.map((land) => ({
    label: `land-${land}`,
    query: wikidataSparqlForLandPrefix(land),
  }))
}
