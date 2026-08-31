export type OfficialExtractFilter = {
  property: string
  valuePrefix: string
}

const ARS_PROPERTY = /^ars$/i

/**
 * Land/ARS prefix used to keep `unmatchedOsm` aligned with the official extract
 * (`ARS LIKE 'prefix%'`). Returns null when the unmatched prefix filter does not apply.
 */
export function resolveArsExtractPrefix(
  extractFilter: OfficialExtractFilter | undefined,
  isRsMode: boolean,
): string | null {
  if (!isRsMode) return null
  if (!extractFilter) return null
  const prefix = extractFilter.valuePrefix.trim()
  if (prefix.length === 0) return null
  if (!ARS_PROPERTY.test(extractFilter.property.trim())) return null
  return prefix
}

/**
 * Whether an OSM-only canonical key belongs in this area's unmatched report.
 * Short/malformed keys are kept so mapping errors stay visible.
 */
export function keepUnmatchedOsmForOfficialPrefix(
  canonicalMatchKey: string,
  officialPrefix: string | null,
): boolean {
  if (officialPrefix == null) return true
  if (canonicalMatchKey.length < officialPrefix.length) return true
  return canonicalMatchKey.startsWith(officialPrefix)
}
