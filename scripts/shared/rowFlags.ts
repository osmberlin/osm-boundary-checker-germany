import { z } from 'zod'

const trimmedString = z.string().trim().min(1)

/**
 * Row flag from `rowFlags` in the dataset config: a row of the official data gets the flag when
 * `officialProperty` equals `equals`. The report shows a badge with `label` (tooltip `hint`).
 */
export const rowFlagConfigSchema = z
  .object({
    /** Stored in the `flags` array of table rows and feature shards. */
    id: z.string().regex(/^[a-z][a-zA-Z0-9]*(-[a-z0-9][a-zA-Z0-9]*)*$/),
    officialProperty: trimmedString,
    equals: z.union([z.boolean(), z.string(), z.number()]),
    label: trimmedString,
    hint: trimmedString,
    /** Rows with this flag come first in the default table order. */
    sortFirst: z.boolean().optional(),
    /** Official property shown as a line on the detail page of flagged rows (needs `detailLabel`). */
    detailProperty: trimmedString.optional(),
    detailLabel: trimmedString.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.detailProperty === undefined) !== (value.detailLabel === undefined)) {
      ctx.addIssue({
        code: 'custom',
        path: ['detailLabel'],
        message: 'detailProperty and detailLabel must be set together',
      })
    }
  })

export const rowFlagsConfigSchema = z.array(rowFlagConfigSchema).superRefine((flags, ctx) => {
  const seen = new Set<string>()
  flags.forEach((flag, index) => {
    if (seen.has(flag.id)) {
      ctx.addIssue({
        code: 'custom',
        path: [index, 'id'],
        message: `duplicate row flag id "${flag.id}"`,
      })
    }
    seen.add(flag.id)
  })
})

/** Flag as embedded once in `comparison_table.json`, with the number of flagged rows. */
export const rowFlagDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  hint: z.string(),
  sortFirst: z.boolean().optional(),
  detailProperty: z.string().optional(),
  detailLabel: z.string().optional(),
  count: z.number().int().nonnegative(),
})

export type RowFlagConfig = z.infer<typeof rowFlagConfigSchema>
export type RowFlagDefinition = z.infer<typeof rowFlagDefinitionSchema>

/** Source formats lose types (FlatGeobuf/JSON): `true`, `"true"` and `1` all count as true. */
function propertyEquals(actual: unknown, expected: boolean | string | number): boolean {
  if (actual == null) return false
  if (typeof expected === 'boolean') {
    const normalized = typeof actual === 'string' ? actual.trim().toLowerCase() : actual
    if (normalized === true || normalized === 1 || normalized === 'true' || normalized === '1') {
      return expected
    }
    if (normalized === false || normalized === 0 || normalized === 'false' || normalized === '0') {
      return !expected
    }
    return false
  }
  if (typeof expected === 'number') {
    return typeof actual === 'string' ? actual.trim() === String(expected) : actual === expected
  }
  return typeof actual === 'string' ? actual === expected : String(actual) === expected
}

/** Ids of the configured flags that apply to a row's official properties; empty when none. */
export function evaluateRowFlags(
  officialProperties: Record<string, unknown> | null,
  flags: readonly RowFlagConfig[],
): string[] {
  if (!officialProperties) return []
  return flags
    .filter((flag) => propertyEquals(officialProperties[flag.officialProperty], flag.equals))
    .map((flag) => flag.id)
}

/** Definitions with per-flag counts for the table payload; `undefined` when the dataset has no flags. */
export function buildRowFlagDefinitions(
  flags: readonly RowFlagConfig[],
  flagIdsPerRow: Iterable<readonly string[]>,
): RowFlagDefinition[] | undefined {
  if (flags.length === 0) return undefined
  const counts = new Map<string, number>()
  for (const ids of flagIdsPerRow) {
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return flags.map((flag) => ({
    id: flag.id,
    label: flag.label,
    hint: flag.hint,
    ...(flag.sortFirst ? { sortFirst: true } : {}),
    ...(flag.detailProperty
      ? { detailProperty: flag.detailProperty, detailLabel: flag.detailLabel }
      : {}),
    count: counts.get(flag.id) ?? 0,
  }))
}
