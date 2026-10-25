/**
 * Reviewed OSM-compatibility table for datasets whose licence differs per geometry (DtP protected areas).
 * The table lives in git (`data/license-compatibility/<tableId>.json`) and has two levels:
 *
 * - `licenseRules`: default per licence name (for example "CC0 1.0" → `yes_licence`).
 * - `sourceOverrides`: per geometry source and licence name; a release (Freigabe) is given by a data
 *   holder, not by a licence, so an override wins over the licence rule.
 *
 * `resolveGeometryLicense` is pure; `loadLicenseCompatibilityTable` reads and validates the JSON file.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import { datasetLicenseIdSchema, osmLicenseCompatibilitySchema } from './sourceMetadata.ts'

export const LICENSE_COMPATIBILITY_DIRECTORY = 'data/license-compatibility'

const trimmed = z.string().trim().min(1)

/** Per-geometry compatibility is never `partial` (that value only describes a whole dataset). */
const rowOsmCompatibilitySchema = osmLicenseCompatibilitySchema.exclude(['partial'])
export type RowOsmCompatibility = z.infer<typeof rowOsmCompatibilitySchema>

const entryBaseShape = {
  id: trimmed,
  osmCompatibility: rowOsmCompatibilitySchema,
  evidenceUrl: z.url().optional(),
  /** German, shown in the report. */
  comment: trimmed,
  decidedAt: z.iso.date(),
}

export const licenseRuleSchema = z
  .object({
    /** Exact licence name as delivered by the source (`geometry_license_name`). */
    licenseName: trimmed,
    licenseId: datasetLicenseIdSchema.default('custom'),
    ...entryBaseShape,
  })
  .strict()
export type LicenseRule = z.infer<typeof licenseRuleSchema>

export const sourceOverrideSchema = z
  .object({
    /** Exact geometry source name as delivered by the source (`geometry_source_name`). */
    sourceName: trimmed,
    licenseName: trimmed,
    ...entryBaseShape,
  })
  .strict()
export type SourceOverride = z.infer<typeof sourceOverrideSchema>

export const licenseCompatibilityTableSchema = z
  .object({
    licenseRules: z.array(licenseRuleSchema),
    sourceOverrides: z.array(sourceOverrideSchema).default([]),
  })
  .strict()
  .superRefine((table, ctx) => {
    const seenIds = new Set<string>()
    for (const [group, entries] of [
      ['licenseRules', table.licenseRules],
      ['sourceOverrides', table.sourceOverrides],
    ] as const) {
      entries.forEach((entry, index) => {
        if (seenIds.has(entry.id)) {
          ctx.addIssue({
            code: 'custom',
            path: [group, index, 'id'],
            message: `Duplicate id "${entry.id}"`,
          })
        }
        seenIds.add(entry.id)
      })
    }
    const seenLicenses = new Set<string>()
    table.licenseRules.forEach((rule, index) => {
      if (seenLicenses.has(rule.licenseName)) {
        ctx.addIssue({
          code: 'custom',
          path: ['licenseRules', index, 'licenseName'],
          message: `Duplicate licence rule for "${rule.licenseName}"`,
        })
      }
      seenLicenses.add(rule.licenseName)
    })
    const seenOverrides = new Set<string>()
    table.sourceOverrides.forEach((override, index) => {
      const key = `${override.sourceName}\x1f${override.licenseName}`
      if (seenOverrides.has(key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['sourceOverrides', index],
          message: `Duplicate source override for "${override.sourceName}" + "${override.licenseName}"`,
        })
      }
      seenOverrides.add(key)
    })
  })
export type LicenseCompatibilityTable = z.infer<typeof licenseCompatibilityTableSchema>

export type GeometryLicenseInput = {
  licenseName: string | null | undefined
  sourceName: string | null | undefined
}

export type GeometryLicenseResolution = {
  osmCompatibility: RowOsmCompatibility
  licenseId: z.infer<typeof datasetLicenseIdSchema>
  /** Which entry of the table applied; absent when the licence is not in the table. */
  ruleId?: string
  evidenceUrl?: string
  comment?: string
  decidedAt?: string
}

function normalizedName(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

/** Source override (source + licence) wins over the licence rule; otherwise `unknown`. */
export function resolveGeometryLicense(
  table: LicenseCompatibilityTable,
  input: GeometryLicenseInput,
): GeometryLicenseResolution {
  const licenseName = normalizedName(input.licenseName)
  const sourceName = normalizedName(input.sourceName)
  const rule = licenseName
    ? table.licenseRules.find((entry) => entry.licenseName === licenseName)
    : undefined
  const override =
    licenseName && sourceName
      ? table.sourceOverrides.find(
          (entry) => entry.sourceName === sourceName && entry.licenseName === licenseName,
        )
      : undefined
  const licenseId = rule?.licenseId ?? 'custom'
  const applied = override ?? rule
  if (!applied) return { osmCompatibility: 'unknown', licenseId }
  return {
    osmCompatibility: applied.osmCompatibility,
    licenseId,
    ruleId: applied.id,
    ...(applied.evidenceUrl ? { evidenceUrl: applied.evidenceUrl } : {}),
    comment: applied.comment,
    decidedAt: applied.decidedAt,
  }
}

export function licenseCompatibilityTablePath(workspaceRoot: string, tableId: string): string {
  return join(workspaceRoot, LICENSE_COMPATIBILITY_DIRECTORY, `${tableId}.json`)
}

export function loadLicenseCompatibilityTable(
  workspaceRoot: string,
  tableId: string,
): LicenseCompatibilityTable {
  const path = licenseCompatibilityTablePath(workspaceRoot, tableId)
  if (!existsSync(path)) {
    throw new Error(`Missing licence compatibility table: ${path}`)
  }
  const parsed = licenseCompatibilityTableSchema.safeParse(JSON.parse(readFileSync(path, 'utf-8')))
  if (!parsed.success) {
    throw new Error(`Invalid licence compatibility table ${path}: ${parsed.error.message}`)
  }
  return parsed.data
}

/** Dataset-level value from row counts: all compatible → `yes_licence`, none → `no`, otherwise `partial`. */
export function deriveDatasetOsmCompatibility(counts: {
  compatible: number
  total: number
}): 'no' | 'yes_licence' | 'partial' | 'unknown' {
  if (counts.total <= 0) return 'unknown'
  if (counts.compatible === counts.total) return 'yes_licence'
  if (counts.compatible === 0) return 'no'
  return 'partial'
}

export function isOsmCompatible(value: string | null | undefined): boolean {
  return value === 'yes_licence' || value === 'yes_waiver'
}
