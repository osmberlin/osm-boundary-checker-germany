/**
 * Machine-readable `official.download` in area `config.jsonc`.
 * Config is trusted: use valid URLs and lowercase `format` / `kind` literals (no blank or whitespace-only values).
 */

import { z } from 'zod'

export const upstreamDateResolverIds = [
  'wfs_inspire_iso19139',
  'iso19139_xml',
  'ogc_api_features_temporal_end',
] as const
export type UpstreamDateResolverId = (typeof upstreamDateResolverIds)[number]

/** Provenance value stored on `official.sourceDateSource` after resolution (subset of pipeline contract). */
export const upstreamDateSourceKindIds = [
  'wfs_capabilities',
  'ogc_api_features_collection',
] as const
export type UpstreamDateSourceKind = (typeof upstreamDateSourceKindIds)[number]

const upstreamDateSourceKindSchema = z.enum(upstreamDateSourceKindIds)

const sharedDownloadFields = {
  kind: z.literal('http').default('http'),
  url: z.url(),
  format: z.enum(['geojson', 'gml']).default('geojson'),
  crs: z.string().min(1).optional(),
}

/**
 * Strict `official.download` for HTTP sources (also embedded in full area config validation).
 */
export const officialHttpDownloadSchema = z.discriminatedUnion('upstreamDateResolver', [
  z.strictObject({
    ...sharedDownloadFields,
    upstreamDateResolver: z.literal('wfs_inspire_iso19139'),
  }),
  z.strictObject({
    ...sharedDownloadFields,
    upstreamDateResolver: z.literal('iso19139_xml'),
    upstreamMetadataUrl: z.url(),
    upstreamDateSourceKind: upstreamDateSourceKindSchema,
  }),
  z.strictObject({
    ...sharedDownloadFields,
    upstreamDateResolver: z.literal('ogc_api_features_temporal_end'),
  }),
])

export type DownloadOfficialHttp = z.infer<typeof officialHttpDownloadSchema>

/** JSON object with string keys (rejects arrays and primitives). */
const jsonRecordSchema = z.record(z.string(), z.unknown())

/**
 * Loose root: only `official.download` is read; sibling keys must not cause parse failure.
 * `download` is validated here so the inner step only runs on a plain object or absent/null.
 */
const officialDownloadRootSchema = z.looseObject({
  official: z
    .looseObject({
      download: z.union([z.null(), z.undefined(), jsonRecordSchema]).optional(),
    })
    .optional(),
})

function formatZodIssues(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ')
}

/**
 * Returns `null` when `official.download` is absent.
 * Throws when `official.download` is present but invalid.
 */
export function parseDownloadOfficial(doc: unknown): DownloadOfficialHttp | null {
  const root = officialDownloadRootSchema.safeParse(doc)
  if (!root.success) return null

  const rawDownload = root.data.official?.download
  if (rawDownload == null) return null

  const parsed = officialHttpDownloadSchema.safeParse(rawDownload)
  if (!parsed.success) {
    throw new Error(`official.download: ${formatZodIssues(parsed.error)}`)
  }

  return parsed.data
}
