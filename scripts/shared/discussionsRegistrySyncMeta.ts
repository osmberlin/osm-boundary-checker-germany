import { z } from 'zod'

/** Written only after a successful discussions-registry sync (build/runtime); not committed. */
export const discussionRegistrySyncMetaSchema = z.object({
  registryCheckedAt: z.string().min(1),
})

export type DiscussionRegistrySyncMeta = z.infer<typeof discussionRegistrySyncMetaSchema>
