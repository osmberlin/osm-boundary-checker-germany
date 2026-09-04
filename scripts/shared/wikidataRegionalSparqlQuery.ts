/**
 * BestRank P1082. Use `a wikibase:BestRank` (class). `wikibase:rank wikibase:BestRank`
 * matches nothing — rank values are PreferredRank / NormalRank / DeprecatedRank.
 * Keep the OPTIONAL correlated to `?item` (a global MAX(P585) subquery over all P1082
 * items times out on WDQS). Extra BestRank rows are resolved in mergeBindings.
 */
export const WIKIDATA_REGIONAL_SPARQL = `SELECT ?ars ?qid ?ags ?osm ?pop ?date WHERE {
  ?item wdt:P1388 ?ars .
  BIND(STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?qid)
  OPTIONAL { ?item wdt:P439 ?ags }
  OPTIONAL { ?item wdt:P402 ?osm }
  OPTIONAL {
    ?item p:P1082 ?popStmt .
    ?popStmt a wikibase:BestRank .
    ?popStmt ps:P1082 ?pop .
    OPTIONAL { ?popStmt pq:P585 ?date }
  }
}`
