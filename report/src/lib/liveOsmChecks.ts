import {
  evaluateAttributeChecks,
  type AttributeCheckConfig,
  type AttributeCheckResult,
} from '../../../scripts/shared/attributeChecks.ts'
import { de } from '../i18n/de'

export type LiveOsmTagMarker = { equal: boolean; tooltip: string }

/** Attribute checks of a row's official properties against the live tags of one OSM object. */
export function liveOsmCheckResults(
  checks: readonly AttributeCheckConfig[] | undefined,
  officialProperties: Record<string, unknown> | null | undefined,
  tags: Record<string, string>,
): AttributeCheckResult[] {
  return evaluateAttributeChecks(checks, officialProperties, tags).filter(
    (result) => result.status !== 'missing',
  )
}

/** ✓/≠ marker of one check result with its tooltip. */
export function liveOsmResultMarker(
  result: AttributeCheckResult,
  officialProperties: Record<string, unknown> | null | undefined,
): LiveOsmTagMarker {
  const equal = result.status === 'equal'
  const officialValue = String(officialProperties?.[result.official] ?? '').trim()
  return {
    equal,
    tooltip: equal
      ? de.feature.liveOsmCheckEqualTooltip(result.official, officialValue)
      : de.feature.liveOsmCheckDifferentTooltip(result.official, officialValue),
  }
}

/** ✓/≠ markers per OSM tag key: every tag a check read gets the result of that check. */
export function liveOsmTagMarkers(
  results: readonly AttributeCheckResult[],
  officialProperties: Record<string, unknown> | null | undefined,
): Map<string, LiveOsmTagMarker[]> {
  const out = new Map<string, LiveOsmTagMarker[]>()
  for (const result of results) {
    const marker = liveOsmResultMarker(result, officialProperties)
    for (const { key } of result.osm) {
      out.set(key, [...(out.get(key) ?? []), marker])
    }
  }
  return out
}
