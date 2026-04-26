import { z } from 'zod'
import { datasetLicenseIdSchema, osmLicenseCompatibilitySchema } from './sourceMetadata.ts'

const trimmedNonEmptyString = z.string().trim().min(1)
const emptyStringToUndefined = z
  .string()
  .trim()
  .length(0)
  .transform(() => undefined)
const trimmedOptionalString = z.union([trimmedNonEmptyString, emptyStringToUndefined]).optional()

const officialSourceFactsSchema = z
  .object({
    provider: trimmedOptionalString,
    dataset: trimmedOptionalString,
    layer: trimmedOptionalString,
    sourcePublicUrl: trimmedOptionalString,
    sourceDownloadUrl: trimmedOptionalString,
    note: trimmedOptionalString,
    licenseId: datasetLicenseIdSchema.optional(),
    licenseLabel: trimmedOptionalString,
    licenseSourceUrl: trimmedOptionalString,
    osmCompatibility: osmLicenseCompatibilitySchema.optional(),
    osmCompatibilitySourceUrl: trimmedOptionalString,
    osmCompatibilityComment: trimmedOptionalString,
    license: trimmedOptionalString,
  })
  .strict()

function issuePath(issue: z.core.$ZodIssue): string {
  if (issue.path.length === 0) return '(root)'
  return issue.path.map(String).join('.')
}

function parseWithSchema<T>(schema: z.ZodType<T>, raw: unknown, label: string): T {
  const parsed = schema.safeParse(raw)
  if (parsed.success) return parsed.data
  const details = parsed.error.issues
    .map((issue) => `${label}.${issuePath(issue)}: ${issue.message}`)
    .join('; ')
  throw new Error(details)
}

export type AreaOfficialSourceFacts = z.infer<typeof officialSourceFactsSchema>
const displayNameSchema = z.object({
  displayName: z.string().trim().min(1),
})

export function parseAreaOfficialSourceFacts(
  area: string,
  rawConfig: unknown,
): AreaOfficialSourceFacts | null {
  if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) return null
  const root = rawConfig as Record<string, unknown>
  const official = root.official
  if (!official || typeof official !== 'object' || Array.isArray(official)) return null
  const raw = (official as Record<string, unknown>).source
  if (raw === undefined) return null
  try {
    return parseWithSchema(officialSourceFactsSchema, raw, 'official.source')
  } catch (error) {
    throw new Error(`${area}: ${String(error)}`)
  }
}

export function parseAreaDisplayName(area: string, rawConfig: unknown): string {
  try {
    return parseWithSchema(displayNameSchema, rawConfig, 'config').displayName
  } catch (error) {
    throw new Error(`${area}: ${String(error)}`)
  }
}
