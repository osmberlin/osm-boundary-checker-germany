export const GITHUB_REPO_ROOT = 'https://github.com/osmberlin/osm-boundary-checker-germany'

export function githubCommitUrl(ref: string): string {
  const trimmed = ref.replace(/^\/+/, '')
  return `${GITHUB_REPO_ROOT}/commit/${trimmed}`
}
