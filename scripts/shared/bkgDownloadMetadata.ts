/**
 * Typed `.cache/bkg/download-metadata.json` produced by `bkg/download.ts`, consumed by `bkg/extract.ts`.
 * Field meanings: [`docs/processing-and-analysis.md`](../../docs/processing-and-analysis.md).
 */

import { z } from 'zod'

export const bkgDownloadMetadataSchema = z.object({
  /** VG25 **Aktualitätsstand** from GDZ product page, normalized to ISO instant. */
  sourceUpdatedAt: z.string().trim().min(1),
  /** Last successful GDZ HTML fetch + parse that confirmed `sourceUpdatedAt`. */
  sourceUpdatedAtVerifiedAt: z.string().trim().min(1),
  /** When ZIP bytes were last fetched from `sourceUrl` (aligns with `official.downloadedAt`). */
  downloadedAt: z.string().trim().min(1),
  sourceUrl: z.string().trim().url(),
  zipRelativePath: z.string().trim().min(1),
  gpkgRelativePath: z.string().trim().min(1),
})

export type BkgDownloadMetadata = z.infer<typeof bkgDownloadMetadataSchema>
