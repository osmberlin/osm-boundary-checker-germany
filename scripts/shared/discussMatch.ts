/**
 * Discussion registry rows use GitHub issue titles as the match key.
 * Same normalization must be applied to browser pathnames when comparing.
 */
export function normalizeDiscussMatchString(input: string): string {
  const t = input.trim()
  if (t.length > 1 && t.endsWith('/')) {
    return t.slice(0, -1)
  }
  return t
}

/** `<prefix>/<areaId>/compare/<officialKey>/<osmKey>`; the prefix is an optional site base path. */
const COMPARE_PATH_PATTERN = /^(.*)\/([^/]+)\/compare\/([^/]+)\/([^/]+)$/

/**
 * Path of a detail page as the router reports it (decoded, no base path). Issue titles are such
 * paths, so a key with spaces or umlauts stays as it is.
 */
export function featureDiscussPath(areaId: string, featureKey: string, prefix = ''): string {
  return `${prefix}/${areaId}/feature/${featureKey}`
}

/** Path of the compare page of an official-only row and an unmatched OSM row (no base path). */
export function compareDiscussPath(areaId: string, officialKey: string, osmKey: string): string {
  return `/${areaId}/compare/${officialKey}/${osmKey}`
}

/**
 * Paths an issue title matches: the title itself and, for a compare page, the detail pages of
 * both rows. So one issue about a pair shows on the compare page and on both detail pages.
 */
export function discussMatchPaths(title: string): string[] {
  const match = normalizeDiscussMatchString(title)
  const [, prefix = '', areaId, officialKey, osmKey] = COMPARE_PATH_PATTERN.exec(match) ?? []
  if (!areaId || !officialKey || !osmKey) return [match]
  return [
    match,
    featureDiscussPath(areaId, officialKey, prefix),
    featureDiscussPath(areaId, osmKey, prefix),
  ]
}
