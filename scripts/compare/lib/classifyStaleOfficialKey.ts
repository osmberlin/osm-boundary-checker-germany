import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Geometry } from 'geojson'
import {
  ags8FromArs12,
  lookupSuccessorByFromArs,
  type ArsSuccessorTable,
} from '../../shared/arsSuccessorTable.ts'
import { loadArsSuccessorTable } from '../../shared/arsSuccessorTableFs.ts'
import {
  germanKeyLookupBundleSchema,
  type GermanKeyLookupBundle,
} from '../../shared/germanKeyLookupPayload.ts'
import type { IdNormalizationPreset } from './config.ts'
import type { CandidateMatch } from './matchCandidates.ts'
import { normalizeOsmValue } from './normalizeGermanKey.ts'

export const staleOfficialKeySources = ['ags_candidate', 'osm_map', 'successor_table'] as const
export type StaleOfficialKeySource = (typeof staleOfficialKeySources)[number]

export type StaleOfficialKey = {
  toArs: string
  source: StaleOfficialKeySource
  pairedUnmatchedKey?: string
}

export type StaleOfficialPredecessor = {
  fromArs: string
}

export type DestatisArsPresence = {
  isLatestGemeindeArs: (ars12: string) => boolean
  isObsoleteGemeindeArs: (ars12: string) => boolean
}

export function destatisArsPresenceFromBundle(bundle: GermanKeyLookupBundle) {
  return {
    isLatestGemeindeArs: (ars12: string) => Object.hasOwn(bundle.latest.gemeindenByArs, ars12),
    isObsoleteGemeindeArs: (ars12: string) =>
      Object.hasOwn(bundle.obsolete.maps.gemeindenByArs, ars12) &&
      !Object.hasOwn(bundle.latest.gemeindenByArs, ars12),
  }
}

let cachedBundle: GermanKeyLookupBundle | null | undefined

function germanKeyLookupPathFromRepo() {
  return join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../report/public/data/german-key-lookup.json',
  )
}

export function loadDestatisArsPresence() {
  if (cachedBundle === undefined) {
    const path = germanKeyLookupPathFromRepo()
    if (!existsSync(path)) {
      cachedBundle = null
      return null
    }
    const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    cachedBundle = germanKeyLookupBundleSchema.parse(raw)
  }
  return cachedBundle ? destatisArsPresenceFromBundle(cachedBundle) : null
}

function candidateCanonicalArs(deRegionalRaw: string | null | undefined) {
  if (deRegionalRaw == null || deRegionalRaw.trim() === '') return null
  const canonical = normalizeOsmValue(
    'de:regionalschluessel',
    deRegionalRaw,
    'regional-12',
  ).canonicalMatchKey
  return /^\d{12}$/.test(canonical) ? canonical : null
}

function candidateAgs8(candidate: CandidateMatch) {
  const agsDigits = candidate.deAgsRaw?.replace(/\D/g, '') ?? ''
  if (agsDigits.length === 8) return agsDigits
  const ars = candidateCanonicalArs(candidate.deRegionalRaw)
  return ars ? ags8FromArs12(ars) : null
}

export function uniqueOsmMapArsByAgs8(osmMapArs: readonly string[]) {
  const byAgs = new Map<string, string[]>()
  for (const raw of osmMapArs) {
    const ars = raw.replace(/\D/g, '')
    if (ars.length !== 12) continue
    const ags = ags8FromArs12(ars)
    if (!ags) continue
    const list = byAgs.get(ags) ?? []
    if (!list.includes(ars)) list.push(ars)
    byAgs.set(ags, list)
  }
  const unique = new Map<string, string>()
  for (const [ags, arsList] of byAgs) {
    if (arsList.length === 1) unique.set(ags, arsList[0]!)
  }
  return unique
}

export function classifyStaleOfficialKey(input: {
  officialArs: string
  candidates: CandidateMatch[] | undefined
  destatis: DestatisArsPresence
  successors: ArsSuccessorTable
  uniqueOsmMapByAgs8?: ReadonlyMap<string, string>
}): StaleOfficialKey | undefined {
  const officialArs = input.officialArs.replace(/\D/g, '')
  if (officialArs.length !== 12) return undefined

  const officialAgs = ags8FromArs12(officialArs)
  if (officialAgs && input.destatis.isObsoleteGemeindeArs(officialArs)) {
    for (const candidate of input.candidates ?? []) {
      const toArs = candidateCanonicalArs(candidate.deRegionalRaw)
      if (!toArs || toArs === officialArs) continue
      if (!input.destatis.isLatestGemeindeArs(toArs)) continue
      const candAgs = candidateAgs8(candidate)
      if (candAgs !== officialAgs) continue
      return { toArs, source: 'ags_candidate' }
    }

    const osmMapArs = input.uniqueOsmMapByAgs8?.get(officialAgs)
    if (osmMapArs && osmMapArs !== officialArs && input.destatis.isLatestGemeindeArs(osmMapArs)) {
      return { toArs: osmMapArs, source: 'osm_map' }
    }
  }

  const tableHit = lookupSuccessorByFromArs(input.successors, officialArs)
  if (tableHit) {
    return { toArs: tableHit.toArs, source: 'successor_table' }
  }
  return undefined
}

export type ClassifiableOfficialRow = {
  category: 'matched' | 'official_only'
  canonicalMatchKey: string
  candidates?: CandidateMatch[]
  staleOfficialKey?: StaleOfficialKey
}

export type ClassifiableUnmatchedRow = {
  canonicalMatchKey: string
  staleOfficialPredecessor?: StaleOfficialPredecessor
}

export function applyStaleOfficialKeyClassification(input: {
  preset: IdNormalizationPreset
  rows: ClassifiableOfficialRow[]
  unmatchedOsm: ClassifiableUnmatchedRow[]
  destatis: DestatisArsPresence | null
  successors?: ArsSuccessorTable
  osmMapArs?: readonly string[]
}) {
  if (input.preset !== 'regional-12' || input.destatis == null) return
  const successors = input.successors ?? loadArsSuccessorTable()
  const unmatchedKeys = new Set(input.unmatchedOsm.map((row) => row.canonicalMatchKey))
  const officialKeys = new Set(input.rows.map((row) => row.canonicalMatchKey))
  const uniqueOsmMapByAgs8 = uniqueOsmMapArsByAgs8(input.osmMapArs ?? [])

  type Proposal = { row: ClassifiableOfficialRow; stale: StaleOfficialKey }
  const proposals: Proposal[] = []
  for (const row of input.rows) {
    if (row.category !== 'official_only') continue
    const stale = classifyStaleOfficialKey({
      officialArs: row.canonicalMatchKey,
      candidates: row.candidates,
      destatis: input.destatis,
      successors,
      uniqueOsmMapByAgs8,
    })
    if (!stale) continue
    if (officialKeys.has(stale.toArs)) continue
    proposals.push({ row, stale })
  }

  const claimCount = new Map<string, number>()
  for (const { stale } of proposals) {
    claimCount.set(stale.toArs, (claimCount.get(stale.toArs) ?? 0) + 1)
  }

  for (const { row, stale } of proposals) {
    if ((claimCount.get(stale.toArs) ?? 0) > 1) continue
    if (unmatchedKeys.has(stale.toArs)) {
      row.staleOfficialKey = { ...stale, pairedUnmatchedKey: stale.toArs }
    } else {
      row.staleOfficialKey = stale
    }
  }

  const predecessorByToArs = new Map<string, string>()
  for (const row of input.rows) {
    if (row.staleOfficialKey) {
      predecessorByToArs.set(row.staleOfficialKey.toArs, row.canonicalMatchKey)
    }
  }
  for (const unmatched of input.unmatchedOsm) {
    const fromArs = predecessorByToArs.get(unmatched.canonicalMatchKey)
    if (fromArs) unmatched.staleOfficialPredecessor = { fromArs }
  }
}

export type StalePromoteRow = {
  category: 'matched' | 'official_only'
  canonicalMatchKey: string
  nameLabel: string
  osmRelationId: string
  officialGeometryWgs84: Geometry | null
  osmGeometryWgs84: Geometry | null
  osmProperties: Record<string, unknown> | null
  candidates?: CandidateMatch[]
  staleOfficialKey?: StaleOfficialKey
}

export type StalePromoteOsmEntry = {
  geometry: Geometry | null
  featureIds: string[]
  properties: Record<string, unknown> | null
}

export type StalePromoteUnmatchedRow = {
  canonicalMatchKey: string
}

function successorOsmName(
  entry: StalePromoteOsmEntry,
  osmNameByKey: Map<string, string>,
  toArs: string,
) {
  const fromMap = osmNameByKey.get(toArs)?.trim()
  if (fromMap) return fromMap
  const fromProps = entry.properties?.name
  if (typeof fromProps === 'string' && fromProps.trim().length > 0) return fromProps.trim()
  return null
}

/**
 * Attach the successor OSM polygon onto classified stale official-only rows.
 * Returns indexes of rows that became matched and still need metrics.
 * Unmatched OSM twins whose key is a promoted `toArs` are removed in place.
 */
export function promoteStaleOfficialRows(input: {
  rows: StalePromoteRow[]
  unmatchedOsm: StalePromoteUnmatchedRow[]
  osmByArs: Map<string, StalePromoteOsmEntry>
  osmNameByKey: Map<string, string>
  pickRelationId: (featureIds: string[], props: Record<string, unknown> | null) => string
}) {
  const promotedIndexes: number[] = []
  const promotedToArs = new Set<string>()
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i]
    if (!row || row.category !== 'official_only') continue
    const stale = row.staleOfficialKey
    if (!stale) continue
    const successor = input.osmByArs.get(stale.toArs)
    if (!successor?.geometry || !row.officialGeometryWgs84) continue

    row.category = 'matched'
    row.osmGeometryWgs84 = successor.geometry
    row.osmProperties = successor.properties
    row.osmRelationId = input.pickRelationId(successor.featureIds, successor.properties)
    const name = successorOsmName(successor, input.osmNameByKey, stale.toArs)
    if (name) row.nameLabel = name
    delete row.candidates
    if (stale.pairedUnmatchedKey != null) {
      row.staleOfficialKey = { toArs: stale.toArs, source: stale.source }
    }
    promotedToArs.add(stale.toArs)
    promotedIndexes.push(i)
  }

  if (promotedToArs.size === 0) return promotedIndexes
  let write = 0
  for (let read = 0; read < input.unmatchedOsm.length; read++) {
    const unmatched = input.unmatchedOsm[read]
    if (!unmatched || promotedToArs.has(unmatched.canonicalMatchKey)) continue
    input.unmatchedOsm[write] = unmatched
    write++
  }
  input.unmatchedOsm.length = write
  return promotedIndexes
}
