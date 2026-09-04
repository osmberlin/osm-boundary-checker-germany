import type { Feature } from 'geojson'
import type { IdNormalizationPreset } from './config.ts'
import { normalizeOsmValue } from './normalizeGermanKey.ts'

export const OSM_RS_TAG = 'de:regionalschluessel'

export type OsmMatchKeyContext = {
  relationIdCriteria: ReadonlySet<string> | null
  isRsMode: boolean
  osmMatchProperty: string
  preset: IdNormalizationPreset
}

function parseRelationId(rawId: unknown): string | null {
  const id = typeof rawId === 'string' ? rawId.trim() : ''
  if (id.length === 0) return null
  if (/^way\/\d+$/i.test(id)) return null
  if (/^\d+$/.test(id)) return id
  const rel = /^relation\/(\d+)$/i.exec(id)
  if (rel?.[1]) return rel[1]
  return null
}

function parseRelationIdFromOsmId(raw: unknown): string | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(raw)
    if (n < 0) return String(-n)
    if (n > 0) return null
    return null
  }
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (text.length === 0) return null
  const asNumber = Number(text)
  if (!Number.isFinite(asNumber)) return null
  if (asNumber < 0) return String(-Math.trunc(asNumber))
  if (asNumber > 0) return null
  return null
}

export function resolveRelationId(
  props: Record<string, unknown> | null | undefined,
): string | null {
  if (!props) return null
  return parseRelationId(props['@id']) ?? parseRelationIdFromOsmId(props.osm_id)
}

function readTrimmedTag(props: Record<string, unknown> | null | undefined, tag: string): string {
  if (!props) return ''
  const v = props[tag]
  if (v == null) return ''
  return String(v).trim()
}

/**
 * RS-only OSM keying for `osmProfile=admin_rs`: canonical key from `de:regionalschluessel` only.
 */
function deriveOsmKeyForRsMode(
  props: Record<string, unknown> | null | undefined,
  preset: IdNormalizationPreset,
): string | null {
  const p = props ?? {}
  const rsRaw = readTrimmedTag(p, OSM_RS_TAG)
  if (!rsRaw) return null
  const canonical = normalizeOsmValue(OSM_RS_TAG, rsRaw, preset).canonicalMatchKey
  return canonical.length > 0 ? canonical : null
}

/** Canonical OSM join key for the active match mode, or null when the feature cannot join. */
export function canonicalOsmMatchKey(
  props: Record<string, unknown> | null | undefined,
  ctx: OsmMatchKeyContext,
): string | null {
  const p = props ?? {}
  if (ctx.relationIdCriteria) {
    const relId = resolveRelationId(p)
    if (!relId || !ctx.relationIdCriteria.has(relId)) return null
    const canonical = normalizeOsmValue('osm_relation_id', relId, ctx.preset).canonicalMatchKey
    return canonical.length > 0 ? canonical : null
  }
  if (ctx.isRsMode) {
    return deriveOsmKeyForRsMode(p, ctx.preset)
  }
  const v = p[ctx.osmMatchProperty]
  if (v == null) return null
  const canonical = normalizeOsmValue(ctx.osmMatchProperty, String(v), ctx.preset).canonicalMatchKey
  return canonical.length > 0 ? canonical : null
}

export function osmFeatureHasOfficialMatchKey(
  feature: Feature,
  officialKeySet: ReadonlySet<string>,
  ctx: OsmMatchKeyContext,
): boolean {
  const key = canonicalOsmMatchKey(feature.properties as Record<string, unknown> | null, ctx)
  return key != null && officialKeySet.has(key)
}

/**
 * Spatial scope (bbox / coverage) may drop OSM that merely grazes a neighbour Land.
 * Features whose join key is already in the official set must still participate in the
 * key match — e.g. a drifted island whose polygon no longer intersects VG25.
 */
export function keepOsmFeaturesForSpatialScope(
  features: readonly Feature[],
  spatiallyKeptIndexes: ReadonlySet<number>,
  officialKeySet: ReadonlySet<string>,
  ctx: OsmMatchKeyContext,
): Feature[] {
  return features.filter((feature, index) => {
    if (spatiallyKeptIndexes.has(index)) return true
    return osmFeatureHasOfficialMatchKey(feature, officialKeySet, ctx)
  })
}
