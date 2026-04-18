function trimTrailingSlash(path: string): string {
  if (path === '/') return ''
  return path.replace(/\/+$/, '')
}

type LocationLike = {
  hostname: string
  pathname: string
}

function currentLocation(): LocationLike | null {
  const maybeLocation = (globalThis as { location?: Partial<LocationLike> }).location
  if (maybeLocation == null) return null
  if (typeof maybeLocation.hostname !== 'string' || typeof maybeLocation.pathname !== 'string') {
    return null
  }
  return {
    hostname: maybeLocation.hostname,
    pathname: maybeLocation.pathname,
  }
}

export function detectSiteBasePathFromLocation(location: LocationLike | null | undefined): string {
  if (location == null) return ''
  const { hostname, pathname } = location
  if (!hostname.endsWith('.github.io')) return ''
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return ''
  return `/${segments[0]}`
}

/**
 * Resolve app base path for project-site deployments (e.g. GitHub Pages).
 * Local/dev hosts keep root-relative behavior.
 */
export function detectSiteBasePath(): string {
  return detectSiteBasePathFromLocation(currentLocation())
}

export function withSiteBasePath(pathnameWithLeadingSlash: string): string {
  const basePath = trimTrailingSlash(detectSiteBasePath())
  if (basePath === '') return pathnameWithLeadingSlash
  return `${basePath}${pathnameWithLeadingSlash}`
}
