import { z } from 'zod'
import { normalizeDiscussMatchString } from './discussMatch.ts'

export const discussionRegistryIssueRowSchema = z.object({
  match: z.string().min(1),
  number: z.number().int().positive(),
  url: z.string().url(),
  state: z.enum(['open', 'closed']),
  lastTouchedAt: z.string().min(1),
})

export const discussionRegistryFileSchema = z.object({
  issues: z.array(discussionRegistryIssueRowSchema),
})

export type DiscussionRegistryIssueRow = z.infer<typeof discussionRegistryIssueRowSchema>
export type DiscussionRegistryFile = z.infer<typeof discussionRegistryFileSchema>

export function emptyDiscussionRegistryFile(): DiscussionRegistryFile {
  return { issues: [] }
}

export function discussionIssuesForPathMatch(
  registry: DiscussionRegistryFile,
  pathnameOrMatch: string,
): DiscussionRegistryIssueRow[] {
  const key = normalizeDiscussMatchString(pathnameOrMatch)
  return registry.issues.filter((row) => normalizeDiscussMatchString(row.match) === key)
}
