/**
 * Reviewed corrections for Digitize the Planet (DtP) data: `data/dtp-overrides/overrides.json`.
 * Each entry says what we believe DtP should change, with a reason. We do not patch DtP; `dtp/extract.ts`
 * applies the entries (`dtp/lib/overrides.ts`) until a guard shows that DtP changed the reviewed value.
 * See `data/dtp-overrides/README.md`.
 *
 * `loadDtpOverrides` reads and validates the tracked file (a missing file is an error).
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

export const DTP_OVERRIDES_FILE = 'data/dtp-overrides/overrides.json'

const trimmed = z.string().trim().min(1)
/** `way/123` or `relation/123`, the form DtP uses for its `osm` reference. */
const osmObjectRefSchema = z
  .string()
  .regex(/^(way|relation)\/\d+$/, 'expected way/<id> or relation/<id>')
const wikidataIdSchema = z.string().regex(/^Q\d+$/, 'expected Q<id>')

export const dtpOverrideSchema = z
  .object({
    /** Lower case, the form of DtP's `dtp_uuid` and of the join keys. */
    dtpUuid: z.uuid().transform((uuid) => uuid.toLowerCase()),
    /** DtP name of the area, for the log and the README. */
    name: trimmed,
    /** `matching`: the row pairs wrongly or not at all without this entry. `informational`: it does not. */
    impact: z.enum(['matching', 'informational']),
    /** German, shown in the report. */
    comment: trimmed,
    decidedAt: z.iso.date(),
    /** The GitHub issue (label `dtp-override`) this entry came from. */
    issueUrl: z.url().optional(),
    /** The OSM object that DtP should name; `null` deletes DtP's reference without a replacement. */
    osmRef: osmObjectRefSchema.nullable().optional(),
    /** DtP's `osm` reference as it was when we reviewed it (string or null); guards the `osmRef` change. */
    reportedOsmRef: z.string().nullable().optional(),
    /** The Wikidata item that DtP should carry. */
    wikidata: wikidataIdSchema.optional(),
    /** DtP's Wikidata id as it was when we reviewed it (null when DtP names none); guards `wikidata`. */
    reportedWikidata: trimmed.nullable().optional(),
  })
  .strict()
  .superRefine((entry, ctx) => {
    if (entry.osmRef === undefined && entry.wikidata === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['osmRef'],
        message: 'Needs osmRef or wikidata (or both)',
      })
    }
    if (entry.osmRef !== undefined && entry.reportedOsmRef === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reportedOsmRef'],
        message: 'Required with osmRef (DtP value when reviewed, null if none)',
      })
    }
    if (entry.osmRef === undefined && entry.reportedOsmRef !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reportedOsmRef'],
        message: 'Only allowed with osmRef',
      })
    }
    if (entry.wikidata !== undefined && entry.reportedWikidata === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reportedWikidata'],
        message: 'Required with wikidata (DtP value when reviewed, null if none)',
      })
    }
    if (entry.wikidata === undefined && entry.reportedWikidata !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['reportedWikidata'],
        message: 'Only allowed with wikidata',
      })
    }
  })
export type DtpOverride = z.infer<typeof dtpOverrideSchema>

export const dtpOverridesFileSchema = z
  .object({ overrides: z.array(dtpOverrideSchema) })
  .strict()
  .superRefine((file, ctx) => {
    const seen = new Set<string>()
    file.overrides.forEach((entry, index) => {
      if (seen.has(entry.dtpUuid)) {
        ctx.addIssue({
          code: 'custom',
          path: ['overrides', index, 'dtpUuid'],
          message: `Duplicate dtpUuid "${entry.dtpUuid}"`,
        })
      }
      seen.add(entry.dtpUuid)
    })
  })
export type DtpOverridesFile = z.infer<typeof dtpOverridesFileSchema>

export function loadDtpOverrides(workspaceRoot: string): DtpOverride[] {
  const path = join(workspaceRoot, DTP_OVERRIDES_FILE)
  if (!existsSync(path)) {
    throw new Error(`Missing DtP overrides file: ${path}`)
  }
  const parsed = dtpOverridesFileSchema.safeParse(JSON.parse(readFileSync(path, 'utf-8')))
  if (!parsed.success) {
    throw new Error(`Invalid DtP overrides file ${path}: ${parsed.error.message}`)
  }
  return parsed.data.overrides
}
