/** BestRank P1082 at MAX(P585). Do not OPTIONAL-join all historical P585 values. */
export const WIKIDATA_REGIONAL_SPARQL = `SELECT ?ars ?qid ?ags ?osm ?pop ?date WHERE {
  ?item wdt:P1388 ?ars .
  BIND(STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?qid)
  OPTIONAL { ?item wdt:P439 ?ags }
  OPTIONAL { ?item wdt:P402 ?osm }
  OPTIONAL {
    {
      SELECT ?item (MAX(?d) AS ?date) WHERE {
        ?item p:P1082 ?st .
        ?st wikibase:rank wikibase:BestRank .
        OPTIONAL { ?st pq:P585 ?d }
      }
      GROUP BY ?item
    }
    ?item p:P1082 ?popStmt .
    ?popStmt wikibase:rank wikibase:BestRank .
    ?popStmt ps:P1082 ?pop .
    OPTIONAL { ?popStmt pq:P585 ?pd }
    FILTER(!BOUND(?date) || ?pd = ?date)
  }
}`
