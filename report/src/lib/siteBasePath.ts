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

/** Matches `base` in vite.config.ts (GitHub Pages project site). */
export const GITHUB_PAGES_SITE_PATH = '/osm-boundary-checker-germany'

export const GITHUB_PAGES_ORIGIN = 'https://osmberlin.github.io'

/** Absolute URL for Open Graph / Twitter (PNG under `public/`). */
export function socialSharingImageAbsoluteUrl(): string {
  return `${GITHUB_PAGES_ORIGIN}${GITHUB_PAGES_SITE_PATH}/social-sharing-osm-grenzabgleich-2025.png`
}
