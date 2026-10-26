import {
  evaluateAttributeChecks,
  type AttributeCheckConfig,
  type AttributeCheckResult,
} from '../../../scripts/shared/attributeChecks.ts'
import { PROTECTED_AREA_EXTRACT_TAG_KEYS } from '../../../scripts/shared/protectedAreaCategories.ts'
import type { SourceKind } from '../../../scripts/shared/sourceKind.ts'
import { de } from '../i18n/de'
import { sourceText } from '../i18n/sourceVocabulary'

export type LiveOsmTagMarker = { equal: boolean; missing?: boolean; tooltip: string }

/**
 * Attribute checks of a row's official properties against the tags of one OSM object (live tags,
 * or the extract/candidate tags). Only results that mark an OSM tag are kept: equal, different, and
 * OSM value missing at the reference.
 */
export function liveOsmCheckResults(
  checks: readonly AttributeCheckConfig[] | undefined,
  officialProperties: Record<string, unknown> | null | undefined,
  tags: Record<string, string>,
): AttributeCheckResult[] {
  return evaluateAttributeChecks(checks, officialProperties, tags).filter(
    (result) => result.status !== 'missing' && result.status !== 'missing_osm',
  )
}

/** ✓/≠/∅ marker of one check result with its tooltip. */
export function liveOsmResultMarker(
  result: AttributeCheckResult,
  officialProperties: Record<string, unknown> | null | undefined,
  sourceKind?: SourceKind,
): LiveOsmTagMarker {
  if (result.status === 'missing_reference') {
    return {
      equal: false,
      missing: true,
      tooltip: de.feature.liveOsmCheckMissingReferenceTooltip(
        sourceText(sourceKind, 'dataAtLabel'),
      ),
    }
  }
  const equal = result.status === 'equal'
  const source = sourceText(sourceKind, 'dataAtLabel')
  const officialValue = String(officialProperties?.[result.official] ?? '').trim()
  return {
    equal,
    tooltip: equal
      ? de.feature.liveOsmCheckEqualTooltip(source, result.official, officialValue)
      : de.feature.liveOsmCheckDifferentTooltip(source, result.official, officialValue),
  }
}

/** Markers per OSM tag key: every tag a check read gets the result of that check. */
export function liveOsmTagMarkers(
  results: readonly AttributeCheckResult[],
  officialProperties: Record<string, unknown> | null | undefined,
  sourceKind?: SourceKind,
): Map<string, LiveOsmTagMarker[]> {
  const out = new Map<string, LiveOsmTagMarker[]>()
  for (const result of results) {
    const marker = liveOsmResultMarker(result, officialProperties, sourceKind)
    for (const { key } of result.osm) {
      out.set(key, [...(out.get(key) ?? []), marker])
    }
  }
  return out
}

export type LiveOsmTagChange = { key: string; before: string | null; after: string | null }

function textOrNull(raw: unknown): string | null {
  if (raw == null || typeof raw === 'object') return null
  const value = String(raw).trim()
  return value === '' ? null : value
}

/**
 * Tags that differ between the extract row and the live object. Only the tags the extract carries
 * are compared (`PROTECTED_AREA_EXTRACT_TAG_KEYS`); other live tags were never in the extract.
 */
export function liveOsmTagChanges(
  snapshot: Record<string, unknown> | null | undefined,
  live: Record<string, string>,
  keys: readonly string[] = PROTECTED_AREA_EXTRACT_TAG_KEYS,
): LiveOsmTagChange[] {
  const changes: LiveOsmTagChange[] = []
  for (const key of keys) {
    const before = textOrNull(snapshot?.[key])
    const after = textOrNull(live[key])
    if (before !== after) changes.push({ key, before, after })
  }
  return changes
}

/** One change as short German text. */
export function describeLiveOsmTagChange(change: LiveOsmTagChange): string {
  const { key, before, after } = change
  if (before === null && after !== null) return de.feature.liveOsmChangeAdded(key, after)
  if (before !== null && after === null) return de.feature.liveOsmChangeRemoved(key, before)
  return de.feature.liveOsmChangeChanged(key, before ?? '', after ?? '')
}
