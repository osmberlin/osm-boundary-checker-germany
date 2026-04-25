/**
 * Optional WFS endpoints embedded in comparison_table.json for live property inspection.
 */
import { z } from 'zod'

const trimmedOptionalString = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}, z.string().optional())

export const ogcWfsInspectSourceSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  type: z.literal('wfs'),
  /** Service root, e.g. https://sgx.geodatenzentrum.de/wfs_vg25 */
  baseUrl: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.replace(/\/$/, '')),
  /** WFS 1.1 `typeName` / 2.0 `typeNames` (single layer). */
  typeName: z.string().trim().min(1),
  /** Default 1.1.0. Use 2.0.0 for services that require WFS 2 params (`typeNames`, `count`, …). */
  wfsVersion: z.enum(['1.1.0', '2.0.0']).optional(),
  /**
   * BBOX axis order for [west, south, east, north] from the report.
   * BKG WFS 1.1: lon,lat. Some WFS 2 + EPSG:4326 endpoints expect lat,lon.
   */
  bboxAxisOrder: z.enum(['lonlat', 'latlon']).optional(),
  srsName: trimmedOptionalString,
  outputFormat: trimmedOptionalString,
  /** WFS 1.1 `maxFeatures` / 2.0 `count` */
  maxFeatures: z
    .number()
    .finite()
    .positive()
    .transform((value) => Math.min(500, Math.floor(value)))
    .optional(),
})
export type OgcWfsInspectSource = z.infer<typeof ogcWfsInspectSourceSchema>

const ogcInspectSourcesSchema = z.array(ogcWfsInspectSourceSchema)

function issuePath(issue: z.core.$ZodIssue): string {
  if (issue.path.length === 0) return '(root)'
  return issue.path.map(String).join('.')
}

/** Parse `ogcInspectSources` from area config (JSONC root). */
export function parseOgcInspectSourcesFromConfig(configRoot: unknown): OgcWfsInspectSource[] {
  if (configRoot == null || typeof configRoot !== 'object') return []
  const raw = (configRoot as Record<string, unknown>).ogcInspectSources
  if (raw === undefined) return []
  const parsed = ogcInspectSourcesSchema.safeParse(raw)
  if (parsed.success) return parsed.data
  const details = parsed.error.issues
    .map((issue) => `ogcInspectSources.${issuePath(issue)}: ${issue.message}`)
    .join('; ')
  throw new Error(details)
}
