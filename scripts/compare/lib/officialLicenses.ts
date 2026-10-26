/**
 * Per-geometry licences for datasets whose official rows carry `geometry_license_*` /
 * `geometry_source_*` properties (DtP protected areas). Resolves each row against the reviewed
 * compatibility table and aggregates the dataset-level breakdown.
 * Datasets without these properties get `null` and keep their single dataset licence untouched.
 */
import type { LicenseBreakdownEntry, OfficialLicense } from '../../shared/comparisonPayload.ts'
import {
  deriveDatasetOsmCompatibility,
  resolveGeometryLicense,
  type LicenseCompatibilityTable,
} from '../../shared/licenseCompatibility.ts'
import { isOsmCompatible } from '../../shared/sourceMetadata.ts'

export const UNKNOWN_LICENSE_LABEL = 'unknown'
const UNKNOWN_SOURCE_KEY = 'unknown'

export type OfficialLicenseOutputs = {
  /** By `canonicalMatchKey`; only rows with official properties. */
  byKey: Map<string, OfficialLicense>
  /** One entry per `groupKey`, sorted by `rowCount` descending. */
  breakdown: LicenseBreakdownEntry[]
  datasetOsmCompatibility: 'no' | 'yes_licence' | 'partial' | 'unknown'
  compatibleCount: number
  totalCount: number
  /** Licence names (and row counts) that are not in the compatibility table. */
  unknownLicenses: Map<string, number>
}

type LicenseRow = {
  canonicalMatchKey: string
  officialProperties: Record<string, unknown> | null
}

function stringProperty(props: Record<string, unknown>, key: string): string | undefined {
  const value = props[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

export function officialLicenseGroupKey(sourceName: string | undefined, licenseLabel: string) {
  return `${sourceName ?? UNKNOWN_SOURCE_KEY}|${licenseLabel}`
}

export function buildOfficialLicenseOutputs(
  rows: readonly LicenseRow[],
  table: LicenseCompatibilityTable,
): OfficialLicenseOutputs | null {
  const hasRowLicense = rows.some(
    (row) =>
      row.officialProperties != null &&
      stringProperty(row.officialProperties, 'geometry_license_name') != null,
  )
  if (!hasRowLicense) return null

  const byKey = new Map<string, OfficialLicense>()
  const breakdownByGroup = new Map<string, LicenseBreakdownEntry>()
  const unknownLicenses = new Map<string, number>()
  let compatibleCount = 0
  let totalCount = 0

  for (const row of rows) {
    const props = row.officialProperties
    if (props == null) continue
    const licenseName = stringProperty(props, 'geometry_license_name')
    const sourceName = stringProperty(props, 'geometry_source_name')
    const sourceUrl = stringProperty(props, 'geometry_source_url')
    const licenseSourceUrl = stringProperty(props, 'geometry_license_url')
    const resolution = resolveGeometryLicense(table, { licenseName, sourceName })
    const licenseLabel = licenseName ?? UNKNOWN_LICENSE_LABEL
    const groupKey = officialLicenseGroupKey(sourceName, licenseLabel)
    const license: OfficialLicense = {
      licenseId: licenseName == null ? 'unknown' : resolution.licenseId,
      licenseLabel,
      ...(licenseSourceUrl ? { licenseSourceUrl } : {}),
      osmCompatibility: resolution.osmCompatibility,
      ...(resolution.evidenceUrl ? { osmCompatibilitySourceUrl: resolution.evidenceUrl } : {}),
      ...(resolution.comment ? { osmCompatibilityComment: resolution.comment } : {}),
      ...(sourceName ? { sourceName } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
      ...(resolution.ruleId ? { ruleId: resolution.ruleId } : {}),
      groupKey,
    }
    byKey.set(row.canonicalMatchKey, license)
    totalCount++
    if (isOsmCompatible(license.osmCompatibility)) compatibleCount++
    if (resolution.ruleId == null) {
      unknownLicenses.set(licenseLabel, (unknownLicenses.get(licenseLabel) ?? 0) + 1)
    }

    const existing = breakdownByGroup.get(groupKey)
    if (existing) {
      existing.rowCount++
      // Rows of one group share source and licence name; the URLs may differ, keep the first seen.
      if (!existing.licenseSourceUrl && licenseSourceUrl) {
        existing.licenseSourceUrl = licenseSourceUrl
      }
      if (!existing.sourceUrl && sourceUrl) existing.sourceUrl = sourceUrl
    } else {
      breakdownByGroup.set(groupKey, {
        ...license,
        rowCount: 1,
        ...(resolution.decidedAt ? { decidedAt: resolution.decidedAt } : {}),
      })
    }
  }

  const breakdown = [...breakdownByGroup.values()].sort(
    (a, b) => b.rowCount - a.rowCount || a.groupKey.localeCompare(b.groupKey, 'de'),
  )
  return {
    byKey,
    breakdown,
    datasetOsmCompatibility: deriveDatasetOsmCompatibility({
      compatible: compatibleCount,
      total: totalCount,
    }),
    compatibleCount,
    totalCount,
    unknownLicenses,
  }
}
