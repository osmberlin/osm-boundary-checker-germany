import { destatisAttributesForArs } from '../../../scripts/shared/germanKeyGemeindeSum.ts'
import type { GermanKeyLookupBundle } from '../../../scripts/shared/germanKeyLookupPayload.ts'
import {
  parsePopulationNumber,
  type RegionalHubCompareInput,
} from '../../../scripts/shared/regionalHubCompare.ts'
import type { RegionalHubOsmTag } from '../../../scripts/shared/regionalHubPayload.ts'
import type { RegionalHubWikidataRow } from '../../../scripts/shared/regionalHubPayload.ts'
import { resolveGemeindeNameByArs } from './germanKeyLookupBundle'

export function displayNameForArs(bundle: GermanKeyLookupBundle, ars12: string): string | null {
  const gemeinde = resolveGemeindeNameByArs(bundle, ars12)
  if (gemeinde.value) return gemeinde.value
  const land = bundle.latest.bundeslaender[ars12.slice(0, 2)]
  if (ars12.endsWith('0000000000')) return land ?? null
  const kreis = bundle.latest.kreise[ars12.slice(0, 5)]
  if (ars12.endsWith('0000000')) return kreis ?? land ?? null
  const verband = bundle.latest.gemeindeverbaende[ars12.slice(0, 9)]
  return verband ?? kreis ?? land ?? null
}

/** Live Overpass tags win when the query succeeded; extract is the fallback. */
export function overlayLiveOsmTags(
  extract: RegionalHubOsmTag | undefined,
  liveTags: Record<string, string> | null | undefined,
): RegionalHubOsmTag | undefined {
  if (!extract) return undefined
  if (liveTags == null) return extract
  const population = liveTags.population?.trim()
  const populationDate = liveTags['population:date']?.trim()
  const wikidata = liveTags.wikidata?.trim()
  return {
    osmId: extract.osmId,
    ...(population ? { population } : {}),
    ...(populationDate ? { populationDate } : {}),
    ...(wikidata ? { wikidata } : {}),
  }
}

export function hubCompareInputForArs(input: {
  bundle: GermanKeyLookupBundle
  ars12: string
  osm?: RegionalHubOsmTag
  wikidata?: RegionalHubWikidataRow
}): RegionalHubCompareInput {
  const destatis = destatisAttributesForArs(input.bundle, input.ars12)
  return {
    destatisPop: destatis?.populationTotal,
    destatisDate: input.bundle.latest.populationDate,
    osmPop: parsePopulationNumber(input.osm?.population),
    osmDate: input.osm?.populationDate,
    osmWikidata: input.osm?.wikidata,
    osmId: input.osm?.osmId,
    wdQid: input.wikidata?.qid,
    wdPop: input.wikidata?.pop,
    wdDate: input.wikidata?.date,
    wdOsmRelationId: input.wikidata?.osmRelationId,
  }
}

export function newestPopulationSource(input: {
  destatisDate?: string
  osmDate?: string
  wdDate?: string
}): 'destatis' | 'osm' | 'wikidata' | null {
  const ranked: { key: 'destatis' | 'osm' | 'wikidata'; date: string }[] = []
  if (input.destatisDate) ranked.push({ key: 'destatis', date: input.destatisDate })
  if (input.osmDate) ranked.push({ key: 'osm', date: input.osmDate.slice(0, 10) })
  if (input.wdDate) ranked.push({ key: 'wikidata', date: input.wdDate.slice(0, 10) })
  if (ranked.length === 0) return null
  ranked.sort((a, b) => b.date.localeCompare(a.date))
  return ranked[0]!.key
}
