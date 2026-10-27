import { z } from 'zod'
import { discussMatchPaths, normalizeDiscussMatchString } from './discussMatch.ts'

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

/**
 * Issues whose title matches any of the page paths, each issue once, in registry order. A
 * compare-page title also matches the detail pages of both keys.
 */
export function discussionIssuesForPaths(
  registry: DiscussionRegistryFile,
  pathnames: readonly string[],
): DiscussionRegistryIssueRow[] {
  const keys = new Set(pathnames.map(normalizeDiscussMatchString))
  return registry.issues.filter((row) => discussMatchPaths(row.match).some((p) => keys.has(p)))
}
