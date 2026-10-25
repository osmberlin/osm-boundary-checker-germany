import { z } from 'zod'

/** Value of `officialProfile` in `config.jsonc` that selects DtP protected areas as the official source. */
export const DTP_OFFICIAL_PROFILE_ID = 'dtp_protected_areas'

/**
 * `official.dtp` in a dataset config: which cached DtP areas feed the dataset.
 * Category ids come from `.cache/dtp/protected-area-categories.json`.
 */
export const dtpSelectionSchema = z
  .object({
    categoryIds: z.array(z.number().int().positive()).min(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Set(value.categoryIds).size !== value.categoryIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['categoryIds'],
        message: 'official.dtp.categoryIds must not contain duplicates',
      })
    }
  })
export type DtpSelection = z.infer<typeof dtpSelectionSchema>

/**
 * Join key (`match_key`) of an official DtP feature: the WDPA id, or `dtp-<uuid>` for areas without
 * one. The `wdpa` id preset accepts both on the official side; OSM `ref:WDPA` never carries the
 * second form, so keyless areas can only be paired through the OSM reference or tag rules of the dataset config.
 */
export const DTP_MATCH_KEY_PROPERTY = 'match_key'
export const DTP_KEYLESS_MATCH_KEY_PREFIX = 'dtp-'

export function dtpMatchKey(wdpa: string | null, uuid: string): string {
  return wdpa ? wdpa : `${DTP_KEYLESS_MATCH_KEY_PREFIX}${uuid.toLowerCase()}`
}

/** Provider facts written to `source/metadata.json` `official` by `dtp/extract.ts`. */
export const DTP_OFFICIAL_SOURCE = {
  provider: 'Digitize the Planet e.V.',
  dataset: 'Schutzgebiete (API v2)',
  sourcePublicUrl: 'https://platform.digitizetheplanet.org/de/api/dokumentation/',
  sourceDownloadUrl: 'https://platform.digitizetheplanet.org/api/v2/protected-areas',
  licenseId: 'mixed',
  licenseSourceUrl: 'https://digitizetheplanet.org/nutzungsbedingungen/',
  /** Replaced by per-row licenses (`partial`) in a later step. */
  osmCompatibility: 'unknown',
  osmCompatibilityComment:
    'Jede Geometrie hat bei DtP eine eigene Lizenz und Quelle; die Kompatibilitaet mit OSM haengt vom einzelnen Gebiet ab.',
} as const

/** Public API URL of one DtP protected area (the cache holds no `dtp_url`). */
export function dtpAreaApiUrl(uuid: string): string {
  return `${DTP_OFFICIAL_SOURCE.sourceDownloadUrl}/${uuid}`
}
