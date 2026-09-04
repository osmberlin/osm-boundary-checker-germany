export function regionalHubQuickStatementsV1Url(command: string): string {
  return `https://quickstatements.toolforge.org/#/v1=${encodeURIComponent(command)}`
}

export function destatisPopulationQuickStatement(input: {
  qid: string
  population: number
  pointInTimeIso: string
  sourceUrl: string
  retrievedIso: string
}): string {
  const qid = input.qid.replace(/^Q/i, 'Q')
  const date = input.pointInTimeIso.slice(0, 10)
  const retrieved = input.retrievedIso.slice(0, 10)
  return `${qid}|P1082|${input.population}|P585|+${date}T00:00:00Z/11|S248|Q764739|S854|"${input.sourceUrl}"|S813|+${retrieved}T00:00:00Z/11`
}

export function osmRelationP402QuickStatement(qid: string, osmRelationId: string): string {
  const id = osmRelationId.replace(/^relation\//i, '')
  return `${qid}|P402|"${id}"`
}

export function destatisPopulationQuickStatementsUrl(input: {
  qid: string
  population: number
  pointInTimeIso: string
  sourceUrl: string
  retrievedIso: string
}): string {
  return regionalHubQuickStatementsV1Url(destatisPopulationQuickStatement(input))
}

export function osmRelationP402QuickStatementsUrl(qid: string, osmRelationId: string): string {
  return regionalHubQuickStatementsV1Url(osmRelationP402QuickStatement(qid, osmRelationId))
}

export function wikidataItemUrl(qid: string, hash?: 'P1082' | 'P402'): string {
  const id = qid.startsWith('Q') || qid.startsWith('q') ? qid : `Q${qid}`
  return hash
    ? `https://www.wikidata.org/wiki/${id}#${hash}`
    : `https://www.wikidata.org/wiki/${id}`
}
