import type { Feature, FeatureCollection } from 'geojson'
import { padRegional12 } from '../shared/regionalArs.ts'
import type { RegionalHubOsmTag, RegionalHubOsmTagsFile } from '../shared/regionalHubPayload.ts'

function propString(
  props: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  if (!props) return undefined
  const raw = props[key]
  if (raw === null || raw === undefined) return undefined
  const text = String(raw).trim()
  return text === '' ? undefined : text
}

function osmIdFromProperties(
  props: Record<string, unknown> | null | undefined,
): string | undefined {
  const atId = propString(props, '@id')
  if (atId) return atId
  const osmId = propString(props, 'osm_id')
  if (osmId) {
    const abs = Math.abs(Number(osmId))
    if (Number.isFinite(abs) && abs > 0) return `relation/${abs}`
  }
  const wayId = propString(props, 'osm_way_id')
  if (wayId) {
    const abs = Math.abs(Number(wayId))
    if (Number.isFinite(abs) && abs > 0) return `way/${abs}`
  }
  return undefined
}

export function regionalOsmTagFromFeature(
  feature: Feature,
): { ars12: string; tag: RegionalHubOsmTag } | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const arsRaw = propString(props, 'de:regionalschluessel')
  if (!arsRaw) return null
  const ars12 = padRegional12(arsRaw)
  if (!ars12 || ars12.length !== 12) return null
  const osmId = osmIdFromProperties(props)
  if (!osmId) return null
  const tag: RegionalHubOsmTag = { osmId }
  const population = propString(props, 'population')
  const populationDate = propString(props, 'population:date')
  const wikidata = propString(props, 'wikidata')
  if (population) tag.population = population
  if (populationDate) tag.populationDate = populationDate
  if (wikidata) tag.wikidata = wikidata
  return { ars12, tag }
}

/** Prefer relation ids over closed ways when the same ARS appears twice. */
function osmIdRank(osmId: string): number {
  return osmId.startsWith('relation/') ? 0 : 1
}

export function collectRegionalOsmTags(
  collection: FeatureCollection,
  generatedAt = new Date().toISOString(),
): RegionalHubOsmTagsFile {
  const byArs: Record<string, RegionalHubOsmTag> = {}
  for (const feature of collection.features) {
    const parsed = regionalOsmTagFromFeature(feature)
    if (!parsed) continue
    const prev = byArs[parsed.ars12]
    if (prev && osmIdRank(prev.osmId) <= osmIdRank(parsed.tag.osmId)) continue
    byArs[parsed.ars12] = parsed.tag
  }
  return {
    generatedAt,
    featureCount: collection.features.length,
    byArs,
  }
}
