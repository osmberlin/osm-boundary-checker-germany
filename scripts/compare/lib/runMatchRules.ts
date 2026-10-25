import type { Feature, Geometry } from 'geojson'
import {
  isKeyJoinRule,
  isObjectMatchRule,
  type MatchedBy,
  type MatchRule,
  type ObjectMatchRule,
} from '../../shared/matchRules.ts'

/** One OSM side of a match: the (merged) OSM object(s) a row was paired with. */
export type RuleMatchedOsm = {
  geometry: Geometry
  properties: Record<string, unknown> | null
  /** OSM object refs (`relation/123`) behind the geometry. */
  featureIds: string[]
  /** Join key of the OSM object under the key join, when it has one. */
  osmKey: string | null
}

export type RuleMatch = {
  osm: RuleMatchedOsm
  by: MatchedBy
}

export type KeyJoinOsmEntry = {
  geometry: Geometry | null
  properties: Record<string, unknown> | null
  featureIds: string[]
}

export type MatchRuleRow = {
  /** Row key (canonical official join key). */
  key: string
  properties: Record<string, unknown> | null
  hasGeometry: boolean
}

export type MatchRuleRunInput = {
  rules: readonly MatchRule[]
  /** Rows in processing order. */
  rows: readonly MatchRuleRow[]
  /** Merged OSM objects by join key, for the `key` / `relation_id` rule. */
  osmByKey: ReadonlyMap<string, KeyJoinOsmEntry>
  /** OSM objects the object rules (`osm_reference`, `osm_tag`) may pick. */
  osmFeatures: readonly Feature[]
  /** Join key of an OSM object under the key join; null when it has none. */
  osmKeyOf: (properties: Record<string, unknown>) => string | null
  /** Join keys of all official rows. */
  officialKeySet: ReadonlySet<string>
}

export type MatchRuleRunResult = {
  /** Row key → how it was paired; rows without an entry stay unmatched. */
  matches: Map<string, RuleMatch>
  /** OSM objects (`relation/123`) paired with a row. */
  usedObjects: Set<string>
  /** Join keys of OSM objects paired by an object rule; they are not "OSM only" any more. */
  consumedOsmKeys: Set<string>
}

type OsmObjectIndex = {
  byObjectRef: ReadonlyMap<string, Feature>
  /** OSM tag → lower-case tag value part → first object. */
  byTagValue: ReadonlyMap<string, ReadonlyMap<string, Feature>>
}

function props(feature: Feature): Record<string, unknown> {
  return (feature.properties ?? {}) as Record<string, unknown>
}

/** `relation/123` / `way/123` (also inside an osm.org URL) → lower-case `type/id`; null otherwise. */
export function normalizeOsmObjectRef(raw: unknown): string | null {
  if (raw == null) return null
  const m = /(way|relation)\/(\d+)/i.exec(String(raw))
  return m ? `${m[1]!.toLowerCase()}/${m[2]}` : null
}

function normalizedTagValue(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
}

export function buildOsmObjectIndex(
  features: readonly Feature[],
  rules: readonly MatchRule[],
): OsmObjectIndex {
  const tags = new Set<string>()
  for (const rule of rules) if (rule.kind === 'osm_tag') tags.add(rule.osmTag)
  const byObjectRef = new Map<string, Feature>()
  const byTagValue = new Map<string, Map<string, Feature>>(
    [...tags].map((tag) => [tag, new Map<string, Feature>()]),
  )
  for (const feature of features) {
    if (!feature.geometry) continue
    const p = props(feature)
    const ref = normalizeOsmObjectRef(p['@id'])
    if (ref && !byObjectRef.has(ref)) byObjectRef.set(ref, feature)
    for (const [tag, byValue] of byTagValue) {
      const raw = p[tag]
      if (raw == null) continue
      for (const part of String(raw).split(';')) {
        const value = normalizedTagValue(part)
        if (value && !byValue.has(value)) byValue.set(value, feature)
      }
    }
  }
  return { byObjectRef, byTagValue }
}

/** The OSM object an object rule names for one official row; null when there is none. */
export function findObjectForRule(
  rule: ObjectMatchRule,
  officialProperties: Record<string, unknown> | null,
  index: OsmObjectIndex,
): Feature | null {
  if (!officialProperties) return null
  if (rule.kind === 'osm_reference') {
    const ref = normalizeOsmObjectRef(officialProperties[rule.officialProperty])
    return (ref && index.byObjectRef.get(ref)) || null
  }
  const value = normalizedTagValue(officialProperties[rule.officialProperty])
  return (value && index.byTagValue.get(rule.osmTag)?.get(value)) || null
}

/**
 * Pairs official rows with OSM objects, rule by rule in the configured order. A rule only looks at
 * rows the earlier rules left unmatched, and an OSM object belongs to one row at most.
 *
 * - `key` / `relation_id`: the row's key finds the merged OSM object with the same join key.
 * - `osm_reference` / `osm_tag`: the object the row names. An object whose join key belongs to an
 *   official row is left to the key join and never taken by these rules.
 */
export function runMatchRules(input: MatchRuleRunInput): MatchRuleRunResult {
  const matches = new Map<string, RuleMatch>()
  const usedObjects = new Set<string>()
  const consumedOsmKeys = new Set<string>()
  const objectIndex = input.rules.some(isObjectMatchRule)
    ? buildOsmObjectIndex(input.osmFeatures, input.rules)
    : null

  input.rules.forEach((rule, ruleIndex) => {
    if (isKeyJoinRule(rule)) {
      for (const row of input.rows) {
        if (matches.has(row.key)) continue
        const osm = input.osmByKey.get(row.key)
        if (!osm?.geometry) continue
        const refs = osm.featureIds.map((id) => normalizeOsmObjectRef(id) ?? id)
        if (refs.some((ref) => usedObjects.has(ref))) continue
        for (const ref of refs) usedObjects.add(ref)
        matches.set(row.key, {
          osm: {
            geometry: osm.geometry,
            properties: osm.properties,
            featureIds: osm.featureIds,
            osmKey: row.key,
          },
          by: { rule: ruleIndex, kind: rule.kind },
        })
      }
      return
    }
    if (!objectIndex) return
    for (const row of input.rows) {
      if (matches.has(row.key) || !row.hasGeometry) continue
      const feature = findObjectForRule(rule, row.properties, objectIndex)
      if (!feature?.geometry) continue
      const objectRef = normalizeOsmObjectRef(props(feature)['@id'])
      if (!objectRef || usedObjects.has(objectRef)) continue
      const osmProperties = props(feature)
      const osmKey = input.osmKeyOf(osmProperties)
      if (osmKey && input.officialKeySet.has(osmKey)) continue
      usedObjects.add(objectRef)
      if (osmKey) consumedOsmKeys.add(osmKey)
      matches.set(row.key, {
        osm: {
          geometry: feature.geometry,
          properties: osmProperties,
          featureIds: [objectRef],
          osmKey,
        },
        by: { rule: ruleIndex, kind: rule.kind },
      })
    }
  })

  return { matches, usedObjects, consumedOsmKeys }
}
