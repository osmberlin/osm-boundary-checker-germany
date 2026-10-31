import { describe, expect, test } from 'bun:test'
import { DTP_OVERRIDES_FILE, dtpOverridesFileSchema, loadDtpOverrides } from './dtpOverrides.ts'
import { workspaceRootFromHere } from './workspaceRoot.ts'

const workspaceRoot = workspaceRootFromHere(import.meta.url)

const base = {
  dtpUuid: 'A6CA9152-F47F-4139-B02D-21EEE9196C63',
  name: 'Stechlin-Ruppiner Land',
  comment: 'Begründung',
  decidedAt: '2026-10-31',
}
const osmEntry = { ...base, osmRef: 'relation/18068246', reportedOsmRef: 'way/137159334' }
const wikidataEntry = { ...base, wikidata: 'Q1970418', reportedWikidata: null }

function parseEntries(overrides: unknown[]) {
  return dtpOverridesFileSchema.safeParse({ overrides })
}

describe('dtpOverridesFileSchema', () => {
  test('accepts an osmRef change and a wikidata change, lower-cases the uuid', () => {
    const parsed = parseEntries([
      osmEntry,
      { ...wikidataEntry, dtpUuid: 'b'.repeat(8) + '-0000-4000-8000-000000000000' },
    ])
    expect(parsed.success).toBe(true)
    expect(parsed.success && parsed.data.overrides[0]?.dtpUuid).toBe(
      'a6ca9152-f47f-4139-b02d-21eee9196c63',
    )
  })

  test('accepts osmRef null (delete DtP reference) and an optional issueUrl', () => {
    const parsed = parseEntries([
      {
        ...base,
        osmRef: null,
        reportedOsmRef: 'relation/5',
        issueUrl: 'https://github.com/x/y/issues/3',
      },
    ])
    expect(parsed.success).toBe(true)
  })

  test('needs osmRef or wikidata', () => {
    expect(parseEntries([base]).success).toBe(false)
  })

  test('osmRef must be way/<id> or relation/<id>', () => {
    for (const osmRef of [
      'node/5',
      'relation/',
      'https://www.openstreetmap.org/relation/5',
      'relation/5 ',
    ]) {
      expect(parseEntries([{ ...osmEntry, osmRef }]).success).toBe(false)
    }
  })

  test('wikidata must be Q<id>', () => {
    for (const wikidata of ['Q', '1970418', 'q1970418', 'Q12 3']) {
      expect(parseEntries([{ ...wikidataEntry, wikidata }]).success).toBe(false)
    }
  })

  test('reportedOsmRef is required with osmRef, reportedWikidata with wikidata', () => {
    const { reportedOsmRef: _a, ...noReportedRef } = osmEntry
    expect(parseEntries([noReportedRef]).success).toBe(false)
    const { reportedWikidata: _b, ...noReportedWikidata } = wikidataEntry
    expect(parseEntries([noReportedWikidata]).success).toBe(false)
  })

  test('reported values are not allowed without their change', () => {
    const { osmRef: _a, ...noOsm } = osmEntry
    expect(parseEntries([{ ...noOsm, wikidata: 'Q1' }]).success).toBe(false)
    const { wikidata: _b, reportedWikidata: _c, ...noWikidata } = wikidataEntry
    expect(parseEntries([{ ...noWikidata, osmRef: 'way/1', reportedOsmRef: null }]).success).toBe(
      true,
    )
    expect(parseEntries([{ ...noWikidata, osmRef: 'way/1' }]).success).toBe(false)
  })

  test('rejects duplicate dtpUuid (case-insensitive), unknown keys, empty comment, bad date and uuid', () => {
    expect(
      parseEntries([osmEntry, { ...wikidataEntry, dtpUuid: base.dtpUuid.toLowerCase() }]).success,
    ).toBe(false)
    expect(parseEntries([{ ...osmEntry, extra: 1 }]).success).toBe(false)
    expect(parseEntries([{ ...osmEntry, comment: '  ' }]).success).toBe(false)
    expect(parseEntries([{ ...osmEntry, decidedAt: '31.10.2026' }]).success).toBe(false)
    expect(parseEntries([{ ...osmEntry, dtpUuid: 'nope' }]).success).toBe(false)
    expect(parseEntries([{ ...osmEntry, issueUrl: 'not a url' }]).success).toBe(false)
  })
})

describe('loadDtpOverrides', () => {
  test('reads the tracked overrides file', () => {
    expect(DTP_OVERRIDES_FILE).toBe('data/dtp-overrides/overrides.json')
    const entries = loadDtpOverrides(workspaceRoot)
    expect(entries.map((entry) => entry.name)).toEqual([
      'Stechlin-Ruppiner Land',
      'Am Stettiner Haff',
    ])
    expect(entries[0]?.osmRef).toBe('relation/18068246')
    expect(entries[1]?.wikidata).toBe('Q1970418')
    expect(entries[1]?.reportedWikidata).toBeNull()
  })

  test('a missing file is an error', () => {
    expect(() => loadDtpOverrides('/nonexistent-workspace-for-dtp-overrides-test')).toThrow(
      /Missing DtP overrides file/,
    )
  })
})
