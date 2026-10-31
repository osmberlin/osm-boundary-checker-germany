import { describe, expect, it } from 'vitest'
import { githubNewDtpOverrideIssueUrl } from './githubDtpOverrideIssueUrl'

describe('githubNewDtpOverrideIssueUrl', () => {
  it('opens the dtp-override template with the discussion title and the form fields', () => {
    const u = new URL(
      githubNewDtpOverrideIssueUrl({
        title: '/de-natura2000/feature/160625054009',
        page: 'https://example.com/de-natura2000/feature/160625054009',
        dtpUuid: 'abc-123',
        dtpName: 'Beispielgebiet',
        dtpOsmRef: 'relation/1',
        dtpWikidata: 'Q42',
        osmRef: 'relation/2',
      }),
    )
    expect(u.origin + u.pathname).toBe(
      'https://github.com/osmberlin/osm-boundary-checker-germany/issues/new',
    )
    expect(u.searchParams.get('template')).toBe('dtp-override.yml')
    expect(u.searchParams.get('title')).toBe('/de-natura2000/feature/160625054009')
    expect(u.searchParams.get('page')).toBe(
      'https://example.com/de-natura2000/feature/160625054009',
    )
    expect(u.searchParams.get('dtp_uuid')).toBe('abc-123')
    expect(u.searchParams.get('dtp_name')).toBe('Beispielgebiet')
    expect(u.searchParams.get('dtp_osm_ref')).toBe('relation/1')
    expect(u.searchParams.get('dtp_wikidata')).toBe('Q42')
    expect(u.searchParams.get('osm_ref')).toBe('relation/2')
  })

  it('leaves out empty values and does not set labels', () => {
    const u = new URL(
      githubNewDtpOverrideIssueUrl({
        title: '/x',
        page: 'https://example.com/x',
        dtpUuid: 'abc',
        dtpName: '',
        dtpOsmRef: undefined,
        dtpWikidata: '  ',
        osmRef: '',
      }),
    )
    expect([...u.searchParams.keys()].sort()).toEqual(['dtp_uuid', 'page', 'template', 'title'])
    expect(u.searchParams.has('labels')).toBe(false)
  })
})
