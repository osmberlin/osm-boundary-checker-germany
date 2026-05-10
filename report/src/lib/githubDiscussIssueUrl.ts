import { GITHUB_REPO_ROOT } from './githubRepo'

const DISCUSS_LABEL = 'discussion'

/**
 * Opens GitHub's new-issue form with prefilled title (canonical path, no query),
 * body (full page URL including query/hash), and label `discussion`.
 */
export function githubNewDiscussIssueUrl(params: { title: string; body: string }): string {
  const u = new URL(`${GITHUB_REPO_ROOT}/issues/new`)
  u.searchParams.set('labels', DISCUSS_LABEL)
  u.searchParams.set('title', params.title)
  u.searchParams.set('body', params.body)
  return u.toString()
}
