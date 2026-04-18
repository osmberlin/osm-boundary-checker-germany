import { describe, expect, it } from 'vitest'
import { detectSiteBasePathFromLocation } from './siteBasePath'

describe('detectSiteBasePathFromLocation', () => {
  it('returns repository prefix on github.io project pages', () => {
    expect(
      detectSiteBasePathFromLocation({
        hostname: 'osmberlin.github.io',
        pathname: '/osm-boundary-checker-germany/',
      }),
    ).toBe('/osm-boundary-checker-germany')
  })

  it('returns empty path on non-github hosts', () => {
    expect(
      detectSiteBasePathFromLocation({
        hostname: 'localhost',
        pathname: '/berlin-bezirke',
      }),
    ).toBe('')
  })
})
