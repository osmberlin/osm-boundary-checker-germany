import type { IdNormalizationPreset } from './config.ts'
import { normalizeOfficialValue } from './normalizeGermanKey.ts'

/** Maps official dataset IDs to OSM `de:regionalschluessel` values before normalization. */
export type OfficialKeyTransposition = {
  /** Must match `official.matchProperty` when set (same field used for lookup). */
  sourceProperty?: string
  /** Only `de:regionalschluessel` is supported for compare today. */
  targetKey: 'de:regionalschluessel'
  /** Official id (string) → raw Schlüssel string as tagged on OSM. */
  map: Record<string, string>
}

export function parseOfficialKeyTransposition(
  areaLabel: string,
  officialMatchProperty: string,
  raw: unknown,
): OfficialKeyTransposition | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object') {
    throw new Error(`${areaLabel}: official.keyTransposition must be an object`)
  }
  const o = raw as Record<string, unknown>
  const targetKeyRaw = typeof o.targetKey === 'string' ? o.targetKey.trim() : ''
  const targetKey = (targetKeyRaw ||
    'de:regionalschluessel') as OfficialKeyTransposition['targetKey']
  if (targetKey !== 'de:regionalschluessel') {
    throw new Error(
      `${areaLabel}: official.keyTransposition.targetKey must be "de:regionalschluessel" (got "${targetKeyRaw}")`,
    )
  }

  const sourceProp =
    typeof o.sourceProperty === 'string' && o.sourceProperty.trim() !== ''
      ? o.sourceProperty.trim()
      : undefined
  if (sourceProp !== undefined && sourceProp !== officialMatchProperty) {
    throw new Error(
      `${areaLabel}: official.keyTransposition.sourceProperty ("${sourceProp}") must equal official.matchProperty ("${officialMatchProperty}")`,
    )
  }

  const mapRaw = o.map
  if (!mapRaw || typeof mapRaw !== 'object' || Array.isArray(mapRaw)) {
    throw new Error(`${areaLabel}: official.keyTransposition.map must be an object`)
  }
  const map: Record<string, string> = {}
  for (const [k, v] of Object.entries(mapRaw as Record<string, unknown>)) {
    const key = String(k).trim()
    if (!key) continue
    if (typeof v !== 'string' || !v.trim()) {
      throw new Error(
        `${areaLabel}: official.keyTransposition.map["${k}"] must be a non-empty string`,
      )
    }
    map[key] = v.trim()
  }
  if (Object.keys(map).length === 0) {
    throw new Error(`${areaLabel}: official.keyTransposition.map is empty`)
  }

  const seenValues = new Map<string, string>()
  for (const [k, v] of Object.entries(map)) {
    const prev = seenValues.get(v)
    if (prev !== undefined) {
      throw new Error(
        `${areaLabel}: official.keyTransposition.map duplicate target Schlüssel "${v}" (keys "${prev}" and "${k}")`,
      )
    }
    seenValues.set(v, k)
  }

  return { ...(sourceProp ? { sourceProperty: sourceProp } : {}), targetKey, map }
}

/**
 * Reads the official id from `official.matchProperty`, optionally maps it to an OSM Schlüssel,
 * then returns the normalized canonical match key.
 */
export function officialPropertyToMatchKey(
  props: Record<string, unknown> | null,
  matchProperty: string,
  keyTransposition: OfficialKeyTransposition | undefined,
  preset: IdNormalizationPreset,
): string | null {
  if (!props) return null
  const raw = props[matchProperty]
  if (raw == null) return null
  const rawStr = String(raw).trim()
  if (!rawStr) return null

  if (!keyTransposition) {
    return normalizeOfficialValue(rawStr, preset)
  }

  const mapped = keyTransposition.map[rawStr]
  if (mapped === undefined) {
    throw new Error(
      `official.keyTransposition.map missing entry for official id "${rawStr}" (matchProperty "${matchProperty}")`,
    )
  }
  return normalizeOfficialValue(mapped, preset)
}
