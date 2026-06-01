export const GITHUB_REPO_ROOT = 'https://github.com/osmberlin/osm-boundary-checker-germany'

export const GITHUB_ACTIONS_URL = `${GITHUB_REPO_ROOT}/actions`

export const GITHUB_DEFAULT_BRANCH = 'main'

export function githubCommitUrl(ref: string): string {
  const trimmed = ref.replace(/^\/+/, '')
  return `${GITHUB_REPO_ROOT}/commit/${trimmed}?branch=${encodeURIComponent(GITHUB_DEFAULT_BRANCH)}`
}
