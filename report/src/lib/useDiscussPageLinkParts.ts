import { useRouter, useRouterState } from '@tanstack/react-router'
import { normalizeDiscussMatchString } from '../../../scripts/shared/discussMatch.ts'

/**
 * GitHub issue title = canonical path (no query/hash): router `pathname`.
 * Issue body = absolute URL: router `origin` + `location.href`.
 *
 * `ParsedLocation.href` is path + search + hash only (no origin) by design.
 * The router exposes resolved `origin` (from `createRouter({ origin })` or, in the
 * browser, the same value as `window.location.origin` — see Router core initialization).
 */
export function useDiscussPageLinkParts(): { matchKey: string; pageUrlAbsolute: string } {
  const router = useRouter()
  return useRouterState({
    select: (state) => {
      const { pathname, href } = state.location
      const matchKey = normalizeDiscussMatchString(pathname)
      const origin = router.origin ?? ''
      const pageUrlAbsolute = origin !== '' ? `${origin}${href}` : href
      return { matchKey, pageUrlAbsolute }
    },
  })
}
