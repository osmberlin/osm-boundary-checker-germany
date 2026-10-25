import * as turf from '@turf/turf'
import type { BBox, Feature, MultiPolygon, Point, Polygon } from 'geojson'
import type { CandidateSignalId } from '../../shared/comparisonPayload.ts'
import {
  categoryIdFromOfficialProperties,
  expectedTypeTags,
  matchesCategoryScope,
  natura2000CodeToRefDe,
  normalizeNatura2000Code,
  osmNatura2000Codes,
  protectedAreaCategoryRule,
} from '../../shared/protectedAreaCategories.ts'
import {
  buildCandidateIndex,
  type CandidateMatch,
  DEFAULT_CANDIDATE_SHRINK_FACTOR,
  osmTypeAndIdFromCandidateProps,
  searchByBbox,
  shrinkOfficialPolygon,
  trimmedOrNull,
} from './matchCandidates.ts'

/**
 * Candidates for `official_only` DtP protected-area rows (goal: suggest `ref:WDPA` in OSM).
 * Signals, strongest first: `dtp_id` tag, DtP `osm` ref, same `wikidata`, same Natura 2000 site
 * code (all four find candidates anywhere in Germany), point inside the shrunk official polygon
 * with a fitting type scope, similar name (and fitting type scope) close to the official polygon.
 * Informational only, like the admin/PLZ candidates: the strong `ref:WDPA` join is unchanged.
 */

/** Strongest first; ranking key. */
const SIGNAL_ORDER: readonly CandidateSignalId[] = [
  'dtp_id',
  'dtp_osm_ref',
  'wikidata',
  'natura2000',
  'inside',
  'name',
]

export const MAX_CANDIDATES_PER_ROW = 5
/** Name-only candidates must be at least this similar ... */
export const NAME_SIGNAL_MIN_SIMILARITY = 0.85
/** ... and sit within the official bbox padded by this many degrees (~2 km). */
const NAME_SIGNAL_BBOX_PAD_DEGREES = 0.02

export type ProtectedAreaOfficialOnlyInput = {
  canonicalMatchKey: string
  officialGeometryWgs84: Polygon | MultiPolygon | null
  officialProperties: Record<string, unknown> | null
}

export type ProtectedAreaCandidateOptions = {
  shrinkFactor?: number
}

const GENERIC_NAME_WORDS = new Set([
  'nsg',
  'lsg',
  'ffh',
  'spa',
  'naturschutzgebiet',
  'landschaftsschutzgebiet',
  'landschaftsschutz',
  'naturschutz',
  'vogelschutzgebiet',
  'vogelschutz',
  'fauna',
  'flora',
  'habitat',
  'gebiet',
  'fauna-flora-habitat',
  'naturpark',
  'nationalpark',
  'biosphaerenreservat',
  'natura',
  '2000',
])

/** Lower-case, no diacritics, no punctuation, no generic type words ("NSG", "Naturschutzgebiet"). */
export function normalizeProtectedAreaName(name: string): string {
  const folded = name
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  return folded
    .split(' ')
    .filter((word) => word.length > 0 && !GENERIC_NAME_WORDS.has(word))
    .join(' ')
}

function bigrams(text: string): Map<string, number> {
  const compact = text.replace(/ /g, '')
  const out = new Map<string, number>()
  for (let i = 0; i < compact.length - 1; i++) {
    const gram = compact.slice(i, i + 2)
    out.set(gram, (out.get(gram) ?? 0) + 1)
  }
  return out
}

/** 0..1: 1 for equal normalized names, else max(token Jaccard, character-bigram Dice). */
export function protectedAreaNameSimilarity(a: string | null, b: string | null): number {
  if (a == null || b == null) return 0
  const na = normalizeProtectedAreaName(a)
  const nb = normalizeProtectedAreaName(b)
  if (na.length === 0 || nb.length === 0) return 0
  if (na === nb) return 1
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  let shared = 0
  for (const token of ta) if (tb.has(token)) shared++
  const jaccard = shared / (ta.size + tb.size - shared)
  const ga = bigrams(na)
  const gb = bigrams(nb)
  let overlap = 0
  let totalA = 0
  let totalB = 0
  for (const [gram, count] of ga) {
    totalA += count
    overlap += Math.min(count, gb.get(gram) ?? 0)
  }
  for (const count of gb.values()) totalB += count
  const dice = totalA + totalB === 0 ? 0 : (2 * overlap) / (totalA + totalB)
  return Math.max(jaccard, dice)
}

function splitValues(raw: unknown): string[] {
  if (raw == null) return []
  return String(raw)
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

type IndexedCandidate = {
  feature: Feature<Point, Record<string, unknown>>
  props: Record<string, unknown>
  osmType: 'way' | 'relation'
  osmId: string
  ref: string
  name: string | null
  wikidata: string[]
  natura2000: string[]
  dtpIds: string[]
}

function pushMulti<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

/** `way/123` / `relation/123` / `https://www.openstreetmap.org/relation/123` → `relation/123`. */
function normalizeOsmRef(raw: unknown): string | null {
  if (raw == null) return null
  const m = /(way|relation)\/(\d+)/i.exec(String(raw))
  return m ? `${m[1]!.toLowerCase()}/${m[2]}` : null
}

function toIndexed(feature: Feature<Point>): IndexedCandidate | null {
  const props = (feature.properties ?? {}) as Record<string, unknown>
  const decoded = osmTypeAndIdFromCandidateProps(props)
  if (!decoded) return null
  return {
    feature: feature as Feature<Point, Record<string, unknown>>,
    props,
    osmType: decoded.osmType,
    osmId: decoded.osmId,
    ref: `${decoded.osmType}/${decoded.osmId}`,
    name: trimmedOrNull(props.name),
    wikidata: splitValues(props.wikidata).map((q) => q.toUpperCase()),
    natura2000: osmNatura2000Codes(props),
    dtpIds: splitValues(props.dtp_id).map((id) => id.toLowerCase()),
  }
}

function buildSuggestedTags(
  candidate: IndexedCandidate,
  row: ProtectedAreaOfficialOnlyInput,
  categoryId: number | null,
): Record<string, string> {
  const official = row.officialProperties ?? {}
  const suggested: Record<string, string> = {}
  const wdpa = trimmedOrNull(official.wdpa) ?? row.canonicalMatchKey
  if (wdpa.length > 0) suggested['ref:WDPA'] = wdpa
  const wikidata = trimmedOrNull(official.wikidata)
  if (wikidata && candidate.wikidata.length === 0) suggested.wikidata = wikidata
  const rule = protectedAreaCategoryRule(categoryId)
  const n2kCode = normalizeNatura2000Code(official.natura2000_code)
  if (rule?.natura2000RefKey && n2kCode.length > 0 && candidate.natura2000.length === 0) {
    const rawCode = trimmedOrNull(official.natura2000_code) ?? n2kCode
    suggested[rule.natura2000RefKey] = natura2000CodeToRefDe(
      rawCode.toUpperCase().startsWith('DE') ? rawCode : `DE${n2kCode}`,
    )
  }
  if (rule && !matchesCategoryScope(candidate.props, categoryId)) {
    for (const entry of expectedTypeTags(rule)) {
      const [key, value] = entry.split('=')
      if (key && value && trimmedOrNull(candidate.props[key]) == null) suggested[key] = value
    }
  }
  return suggested
}

function strongestSignalIndex(signals: readonly CandidateSignalId[]): number {
  let best = SIGNAL_ORDER.length
  for (const signal of signals) best = Math.min(best, SIGNAL_ORDER.indexOf(signal))
  return best
}

/**
 * One entry per `official_only` row (empty array = ran, nothing found). `candidatePoints` must be
 * the eligible set (ignore list / bbox applied), including objects that carry `ref:WDPA`.
 */
export function matchProtectedAreaCandidates(input: {
  rows: ReadonlyArray<ProtectedAreaOfficialOnlyInput>
  /** Canonical (`wdpa` preset) keys of all official rows. */
  officialKeySet: ReadonlySet<string>
  candidatePoints: ReadonlyArray<Feature<Point>>
  options?: ProtectedAreaCandidateOptions
}): Map<string, CandidateMatch[]> {
  const { rows, officialKeySet, candidatePoints } = input
  const shrinkFactor = input.options?.shrinkFactor ?? DEFAULT_CANDIDATE_SHRINK_FACTOR

  const candidates: IndexedCandidate[] = []
  const byRef = new Map<string, IndexedCandidate>()
  const byDtpId = new Map<string, IndexedCandidate[]>()
  const byWikidata = new Map<string, IndexedCandidate[]>()
  const byNatura2000 = new Map<string, IndexedCandidate[]>()
  for (const feature of candidatePoints) {
    const candidate = toIndexed(feature)
    if (!candidate) continue
    candidates.push(candidate)
    byRef.set(candidate.ref, candidate)
    for (const id of candidate.dtpIds) pushMulti(byDtpId, id, candidate)
    for (const q of candidate.wikidata) pushMulti(byWikidata, q, candidate)
    for (const code of candidate.natura2000) pushMulti(byNatura2000, code, candidate)
  }
  const tree = buildCandidateIndex(candidates.map((c) => c.feature))
  const candidateForHit = (hit: Feature<Point, Record<string, unknown>>) => {
    const decoded = osmTypeAndIdFromCandidateProps(hit.properties ?? {})
    return decoded ? byRef.get(`${decoded.osmType}/${decoded.osmId}`) : undefined
  }

  const result = new Map<string, CandidateMatch[]>()
  for (const row of rows) {
    const official = row.officialProperties ?? {}
    const categoryId = categoryIdFromOfficialProperties(official)
    const rowName = trimmedOrNull(official.name)
    const signalsByRef = new Map<string, Set<CandidateSignalId>>()
    const found = new Map<string, IndexedCandidate>()
    const add = (candidate: IndexedCandidate, signal: CandidateSignalId) => {
      // ref:WDPA that already belongs to another official row: that object is matched elsewhere.
      const wdpaValues = splitValues(candidate.props['ref:WDPA'])
      if (wdpaValues.some((v) => v !== row.canonicalMatchKey && officialKeySet.has(v))) return
      found.set(candidate.ref, candidate)
      const set = signalsByRef.get(candidate.ref) ?? new Set<CandidateSignalId>()
      set.add(signal)
      signalsByRef.set(candidate.ref, set)
    }

    const dtpUuid = trimmedOrNull(official.dtp_uuid)?.toLowerCase()
    if (dtpUuid) for (const c of byDtpId.get(dtpUuid) ?? []) add(c, 'dtp_id')

    const osmRef = normalizeOsmRef(official.dtp_osm_ref)
    if (osmRef) {
      const c = byRef.get(osmRef)
      if (c) add(c, 'dtp_osm_ref')
    }

    const wikidata = trimmedOrNull(official.wikidata)?.toUpperCase()
    if (wikidata) for (const c of byWikidata.get(wikidata) ?? []) add(c, 'wikidata')

    const n2kCode = normalizeNatura2000Code(official.natura2000_code)
    if (n2kCode.length > 0) for (const c of byNatura2000.get(n2kCode) ?? []) add(c, 'natura2000')

    const polygon = row.officialGeometryWgs84
    if (polygon) {
      const shrunk = shrinkOfficialPolygon(polygon, shrinkFactor)
      const shrunkBbox = turf.bbox({ type: 'Feature', geometry: shrunk, properties: {} }) as BBox
      for (const hit of searchByBbox(tree, shrunkBbox)) {
        const candidate = candidateForHit(hit)
        if (!candidate) continue
        if (!matchesCategoryScope(candidate.props, categoryId)) continue
        if (!turf.booleanPointInPolygon(hit as Feature<Point>, shrunk)) continue
        add(candidate, 'inside')
      }
      if (rowName) {
        const fullBbox = turf.bbox({ type: 'Feature', geometry: polygon, properties: {} }) as BBox
        const padded: BBox = [
          fullBbox[0] - NAME_SIGNAL_BBOX_PAD_DEGREES,
          fullBbox[1] - NAME_SIGNAL_BBOX_PAD_DEGREES,
          fullBbox[2] + NAME_SIGNAL_BBOX_PAD_DEGREES,
          fullBbox[3] + NAME_SIGNAL_BBOX_PAD_DEGREES,
        ]
        for (const hit of searchByBbox(tree, padded)) {
          const candidate = candidateForHit(hit)
          if (!candidate) continue
          if (!matchesCategoryScope(candidate.props, categoryId)) continue
          if (protectedAreaNameSimilarity(rowName, candidate.name) < NAME_SIGNAL_MIN_SIMILARITY) {
            continue
          }
          add(candidate, 'name')
        }
      }
    }

    const ranked = [...found.values()].map((candidate) => {
      const signals = SIGNAL_ORDER.filter((s) => signalsByRef.get(candidate.ref)?.has(s))
      const similarity = protectedAreaNameSimilarity(rowName, candidate.name)
      return { candidate, signals, similarity }
    })
    ranked.sort((a, b) => {
      const bySignal = strongestSignalIndex(a.signals) - strongestSignalIndex(b.signals)
      if (bySignal !== 0) return bySignal
      if (a.similarity !== b.similarity) return b.similarity - a.similarity
      if (a.candidate.osmType !== b.candidate.osmType) {
        return a.candidate.osmType === 'relation' ? -1 : 1
      }
      return Number(a.candidate.osmId) - Number(b.candidate.osmId)
    })

    result.set(
      row.canonicalMatchKey,
      ranked.slice(0, MAX_CANDIDATES_PER_ROW).map(({ candidate, signals, similarity }) => ({
        osmType: candidate.osmType,
        osmId: candidate.osmId,
        name: candidate.name,
        signals,
        nameSimilarity: Math.round(similarity * 100) / 100,
        refWdpa: trimmedOrNull(candidate.props['ref:WDPA']),
        wikidata: trimmedOrNull(candidate.props.wikidata),
        protectionTitle: trimmedOrNull(candidate.props.protection_title),
        protectClass: trimmedOrNull(candidate.props.protect_class),
        suggestedTags: buildSuggestedTags(candidate, row, categoryId),
      })),
    )
  }
  return result
}
