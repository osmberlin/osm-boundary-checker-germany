/**
 * Wikidata items of protected areas in Germany: every item with a WDPA id (P809) and country
 * Germany (P17 Q183), plus the properties the feature detail page compares with DtP and OSM:
 * P402 (OSM relation id), P856 (website), P137 (operator), P2046 (area, normalized to m²) and
 * P373 (Commons category). Optional blocks may repeat a row per extra value; `mergeBindings` folds them.
 * The area uses a BestRank statement like the regional query (see `wikidataRegionalSparqlQuery.ts`).
 * Labels come from the label service: `OPTIONAL { rdfs:label … FILTER(LANG) }` over 24k items takes
 * ~50 s on WDQS (limit 60 s), the service ~2 s. An item without a German label gets its id as label
 * (`mergeBindings` drops that).
 */
const SELECT = `SELECT ?qid ?label ?wdpa ?osm ?website ?operatorQid ?operatorLabel ?area ?commons WHERE {`

const OPTIONALS = `  BIND(STRAFTER(STR(?item), "http://www.wikidata.org/entity/") AS ?qid)
  OPTIONAL { ?item wdt:P402 ?osm }
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL {
    ?item wdt:P137 ?operator .
    BIND(STRAFTER(STR(?operator), "http://www.wikidata.org/entity/") AS ?operatorQid)
  }
  OPTIONAL {
    ?item p:P2046 ?areaStmt .
    ?areaStmt a wikibase:BestRank .
    ?areaStmt psn:P2046/wikibase:quantityAmount ?area
  }
  OPTIONAL { ?item wdt:P373 ?commons }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "de" .
    ?item rdfs:label ?label .
    ?operator rdfs:label ?operatorLabel .
  }
}`

/** All German items with P809; `wdpaPrefix` limits to ids starting with it (split fallback). */
export function wikidataProtectedAreasSparql(wdpaPrefix?: string) {
  const filter = wdpaPrefix ? `\n  FILTER(STRSTARTS(STR(?wdpa), "${wdpaPrefix}"))` : ''
  return `${SELECT}
  ?item wdt:P809 ?wdpa .
  ?item wdt:P17 wd:Q183 .${filter}
${OPTIONALS}`
}

/** Items by id, whether or not they carry P809 (items DtP or OSM reference that the main query misses). */
export function wikidataProtectedAreasSparqlForQids(qids: readonly string[]) {
  const values = qids.map((qid) => `wd:${qid}`).join(' ')
  return `${SELECT}
  VALUES ?item { ${values} }
  OPTIONAL { ?item wdt:P809 ?wdpa }
${OPTIONALS}`
}
