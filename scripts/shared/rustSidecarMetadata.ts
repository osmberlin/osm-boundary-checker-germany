import { z } from 'zod'

export const rustSidecarMetadataFileSchema = z.object({
  generatedAt: z.string(),
  rustSidecar: z.object({
    fingerprint: z.string().nullable(),
    inputHash: z.string().nullable(),
    rustcRelease: z.string().nullable(),
    rustcVersion: z.string().nullable(),
    changeStatus: z.string(),
    previousFingerprint: z.string().nullable(),
    cacheHit: z.boolean().nullable(),
  }),
})

export type RustSidecarMetadataFile = z.infer<typeof rustSidecarMetadataFileSchema>
