import { z } from 'zod'
import type { DatasetConfig } from './datasetConfig.ts'
import { resolveOsmProfile } from './osmProfiles.ts'

const trimmedString = z.string().trim().min(1)

/**
 * One way to find the OSM object of an official row (`compare.matchRules` in a dataset config).
 *
 * - `key`: normalized key join. The official `officialProperty` and the OSM tag `osmTag` are
 *   normalized with `idNormalization.preset` and compared.
 * - `relation_id`: the OSM relation with one of `relationIds` (`@id`) belongs to the official row
 *   whose key (`compare.officialMatchProperty`) equals that relation id.
 * - `osm_reference`: the official `officialProperty` holds an OSM object reference
 *   (`relation/123`, `way/45`, also inside an osm.org URL); that OSM object belongs to the row.
 * - `osm_tag`: the OSM object whose tag `osmTag` equals the value of the official `officialProperty`
 *   (a `;` separated tag value matches when one part equals it, case-insensitive).
 */
export const matchRuleSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('key'), officialProperty: trimmedString, osmTag: trimmedString })
    .strict(),
  z.object({ kind: z.literal('relation_id'), relationIds: z.array(trimmedString).min(1) }).strict(),
  z.object({ kind: z.literal('osm_reference'), officialProperty: trimmedString }).strict(),
  z
    .object({ kind: z.literal('osm_tag'), officialProperty: trimmedString, osmTag: trimmedString })
    .strict(),
])

export type MatchRule = z.infer<typeof matchRuleSchema>
export type MatchRuleKind = MatchRule['kind']
export type KeyMatchRule = Extract<MatchRule, { kind: 'key' }>
export type RelationIdMatchRule = Extract<MatchRule, { kind: 'relation_id' }>
/** Rules that pair an OSM object with a row by naming it (reference or tag), not by the key join. */
export type ObjectMatchRule = Extract<MatchRule, { kind: 'osm_reference' | 'osm_tag' }>

/** The rule that records which rule matched a row: position in the ordered list plus its kind. */
export const matchedBySchema = z
  .object({
    rule: z.number().int().min(0),
    kind: z.enum(['key', 'relation_id', 'osm_reference', 'osm_tag']),
  })
  .strict()
export type MatchedBy = z.infer<typeof matchedBySchema>

export function isKeyJoinRule(rule: MatchRule): rule is KeyMatchRule | RelationIdMatchRule {
  return rule.kind === 'key' || rule.kind === 'relation_id'
}

export function isObjectMatchRule(rule: MatchRule): rule is ObjectMatchRule {
  return rule.kind === 'osm_reference' || rule.kind === 'osm_tag'
}

type RuleSourceConfig = Pick<DatasetConfig, 'compare' | 'osm' | 'osmProfile'>

/**
 * The ordered rules of a dataset: `compare.matchRules` when set, otherwise the one rule that
 * `compare.officialMatchProperty` + `osmProfile` (+ optional `osm.matchCriteria`) describe.
 */
export function resolveMatchRules(config: RuleSourceConfig): MatchRule[] {
  const explicit = config.compare.matchRules
  if (explicit) return explicit.map((rule) => structuredClone(rule))
  const criteria = config.osm?.matchCriteria
  if (criteria?.kind === 'relation_id') {
    return [{ kind: 'relation_id', relationIds: [...criteria.relationIds] }]
  }
  return [
    {
      kind: 'key',
      officialProperty: config.compare.officialMatchProperty ?? '',
      osmTag: resolveOsmProfile(config.osmProfile).matchProperty,
    },
  ]
}

/** Official property of the row key (what the official rows are grouped by). */
export function resolveOfficialMatchProperty(config: RuleSourceConfig): string | undefined {
  if (config.compare.officialMatchProperty) return config.compare.officialMatchProperty
  const key = config.compare.matchRules?.find((rule) => rule.kind === 'key')
  return key?.kind === 'key' ? key.officialProperty : undefined
}

/**
 * Cross-field checks of a parsed dataset config; returns messages (config paths included).
 * - Exactly one key join rule (`key` or `relation_id`): it defines the row keys, the OSM scope
 *   filters and the "OSM only" list.
 * - `key` agrees with `compare.officialMatchProperty` (when both are set) and the OSM profile tag.
 * - `matchRules` replaces `osm.matchCriteria`.
 */
export function validateMatchRules(config: RuleSourceConfig): string[] {
  const issues: string[] = []
  const rules = config.compare.matchRules
  if (!rules) {
    if (!config.compare.officialMatchProperty) {
      issues.push(
        'config.compare.officialMatchProperty: required when compare.matchRules is not set',
      )
    }
    return issues
  }
  if (config.osm?.matchCriteria !== undefined) {
    issues.push(
      'config.osm.matchCriteria: not allowed together with compare.matchRules (use a relation_id rule)',
    )
  }
  const keyJoinRules = rules.filter(isKeyJoinRule)
  if (keyJoinRules.length !== 1) {
    issues.push(
      `config.compare.matchRules: needs exactly one "key" or "relation_id" rule (found ${keyJoinRules.length})`,
    )
  }
  const profileTag = resolveOsmProfile(config.osmProfile).matchProperty
  rules.forEach((rule, index) => {
    if (rule.kind !== 'key') return
    const path = `config.compare.matchRules.${index}`
    const official = config.compare.officialMatchProperty
    if (official !== undefined && official !== rule.officialProperty) {
      issues.push(
        `${path}.officialProperty: "${rule.officialProperty}" must equal compare.officialMatchProperty ("${official}") or leave compare.officialMatchProperty out`,
      )
    }
    if (rule.osmTag !== profileTag) {
      issues.push(
        `${path}.osmTag: "${rule.osmTag}" must equal the matchProperty of osmProfile "${config.osmProfile}" ("${profileTag}")`,
      )
    }
  })
  if (
    rules.some((rule) => rule.kind === 'relation_id') &&
    config.compare.officialMatchProperty === undefined
  ) {
    issues.push('config.compare.officialMatchProperty: required with a relation_id rule')
  }
  return issues
}
