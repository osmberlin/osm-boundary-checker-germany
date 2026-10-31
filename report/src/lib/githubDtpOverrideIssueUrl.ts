import { GITHUB_REPO_ROOT } from './githubRepo'

const DTP_OVERRIDE_TEMPLATE = 'dtp-override.yml'

/**
 * Opens GitHub's new-issue form of the `dtp-override` template with the fields prefilled. The
 * title is the discussion path (no query), so the issue links to the page like a discussion.
 * Labels come from the template: GitHub drops a `labels` parameter for people without write access.
 * Empty values are left out.
 */
export function githubNewDtpOverrideIssueUrl(params: {
  title: string
  page: string
  dtpUuid: string
  dtpName?: string
  dtpOsmRef?: string
  dtpWikidata?: string
  osmRef?: string
}): string {
  const u = new URL(`${GITHUB_REPO_ROOT}/issues/new`)
  u.searchParams.set('template', DTP_OVERRIDE_TEMPLATE)
  u.searchParams.set('title', params.title)
  const fields: [string, string | undefined][] = [
    ['page', params.page],
    ['dtp_uuid', params.dtpUuid],
    ['dtp_name', params.dtpName],
    ['dtp_osm_ref', params.dtpOsmRef],
    ['dtp_wikidata', params.dtpWikidata],
    ['osm_ref', params.osmRef],
  ]
  for (const [id, value] of fields) {
    const trimmed = value?.trim()
    if (trimmed) u.searchParams.set(id, trimmed)
  }
  return u.toString()
}
