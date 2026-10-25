import type {
  DatasetLicenseId,
  OsmLicenseCompatibility,
} from '../../../scripts/shared/sourceMetadata.ts'
import type { ComparisonForReport, ReportRow } from '../types/report'

export type ResolvedLicense = {
  licenseId?: DatasetLicenseId
  licenseLabel?: string
  licenseSourceUrl?: string
  osmCompatibility: OsmLicenseCompatibility
  osmCompatibilitySourceUrl?: string
  osmCompatibilityComment?: string
  /** Geometry source (DtP); only when the licence comes from the row. */
  sourceName?: string
  sourceUrl?: string
  /** Entry of the compatibility table that applied (row licence only). */
  ruleId?: string
  /** True when the row carries its own licence (`officialLicense`), false for the dataset licence. */
  isRowLicense: boolean
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Licence that applies to one row: the row's own licence when present, otherwise the dataset licence.
 * Every UI part that shows or checks a licence reads it through this function.
 */
export function resolveRowLicense(
  row: Pick<ReportRow, 'officialLicense'> | null | undefined,
  sourceMetadata: Pick<ComparisonForReport['sourceMetadata'], 'official'> | null | undefined,
): ResolvedLicense {
  const rowLicense = row?.officialLicense
  if (rowLicense) {
    return {
      licenseId: rowLicense.licenseId,
      licenseLabel: nonEmpty(rowLicense.licenseLabel),
      licenseSourceUrl: nonEmpty(rowLicense.licenseSourceUrl),
      osmCompatibility: rowLicense.osmCompatibility,
      osmCompatibilitySourceUrl: nonEmpty(rowLicense.osmCompatibilitySourceUrl),
      osmCompatibilityComment: nonEmpty(rowLicense.osmCompatibilityComment),
      sourceName: nonEmpty(rowLicense.sourceName),
      sourceUrl: nonEmpty(rowLicense.sourceUrl),
      ruleId: rowLicense.ruleId,
      isRowLicense: true,
    }
  }
  const off = sourceMetadata?.official
  return {
    licenseId: off?.licenseId,
    licenseLabel: nonEmpty(off?.licenseLabel) ?? nonEmpty(off?.license),
    licenseSourceUrl: nonEmpty(off?.licenseSourceUrl),
    osmCompatibility: off?.osmCompatibility ?? 'unknown',
    osmCompatibilitySourceUrl: nonEmpty(off?.osmCompatibilitySourceUrl),
    osmCompatibilityComment: nonEmpty(off?.osmCompatibilityComment),
    isRowLicense: false,
  }
}
