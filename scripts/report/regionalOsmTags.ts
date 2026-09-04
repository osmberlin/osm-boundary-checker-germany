import type { Feature, FeatureCollection } from 'geojson'
import { padRegional12 } from '../shared/regionalArs.ts'
import type { RegionalHubOsmTag } from '../shared/regionalHubPayload.ts'

function propString(props: Record<string, unknown> | null | undefined, key: string) {
  if (!props) return undefined
  const raw = props[key]
  if (raw === null || raw === undefined) return undefined
  const text = String(raw).trim()
  return text === '' ? undefined : text
}

function osmIdFromProperties(props: Record<string, unknown> | null | undefined) {
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

export function regionalOsmTagFromFeature(feature: Feature) {
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
function osmIdRank(osmId: string) {
  return osmId.startsWith('relation/') ? 0 : 1
}

function osmTagScore(tag: RegionalHubOsmTag) {
  return (tag.wikidata ? 1 : 0) + (tag.population ? 1 : 0)
}

function mergeOsmTags(primary: RegionalHubOsmTag, secondary: RegionalHubOsmTag) {
  return {
    osmId: primary.osmId,
    population: primary.population ?? secondary.population,
    populationDate: primary.populationDate ?? secondary.populationDate,
    wikidata: primary.wikidata ?? secondary.wikidata,
  }
}

function pickOsmTag(prev: RegionalHubOsmTag, next: RegionalHubOsmTag) {
  const prevRank = osmIdRank(prev.osmId)
  const nextRank = osmIdRank(next.osmId)
  if (nextRank < prevRank) return mergeOsmTags(next, prev)
  if (nextRank > prevRank) return mergeOsmTags(prev, next)
  if (osmTagScore(next) > osmTagScore(prev)) return mergeOsmTags(next, prev)
  return mergeOsmTags(prev, next)
}

export function collectRegionalOsmTags(
  collection: FeatureCollection,
  generatedAt = new Date().toISOString(),
) {
  const byArs: Record<string, RegionalHubOsmTag> = {}
  for (const feature of collection.features) {
    const parsed = regionalOsmTagFromFeature(feature)
    if (!parsed) continue
    const prev = byArs[parsed.ars12]
    byArs[parsed.ars12] = prev ? pickOsmTag(prev, parsed.tag) : parsed.tag
  }
  return {
    generatedAt,
    featureCount: collection.features.length,
    byArs,
  }
}
