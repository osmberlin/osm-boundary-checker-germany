import { describe, expect, test } from 'bun:test'
import {
  type GeofabrikGermanyFetchFn,
  germanyPbfBasenameFromReplicationTimestamp,
  germanyPbfUrlFromBasename,
  parseGermanyUpdatesState,
  resolveGeofabrikGermanyPbfUrl,
} from './geofabrikGermanyExtract.ts'

describe('parseGermanyUpdatesState', () => {
  test('parses escaped colons in timestamp', () => {
    const text = `# comment
timestamp=2026-06-02T20\\:20\\:36Z
sequenceNumber=4802`
    expect(parseGermanyUpdatesState(text)).toBe('2026-06-02T20:20:36Z')
  })
})

describe('germanyPbfBasenameFromReplicationTimestamp', () => {
  test('maps UTC replication time to YYMMDD basename', () => {
    expect(germanyPbfBasenameFromReplicationTimestamp('2026-06-02T20:20:36Z')).toBe(
      'germany-260602.osm.pbf',
    )
  })
})

describe('resolveGeofabrikGermanyPbfUrl', () => {
  test('honours explicit URL', async () => {
    const r = await resolveGeofabrikGermanyPbfUrl({
      explicitUrl: 'https://example.invalid/custom.osm.pbf',
    })
    expect(r.resolvedVia).toBe('explicit')
    expect(r.url).toContain('custom.osm.pbf')
  })

  test('uses dated file from state.txt', async () => {
    const r = await resolveGeofabrikGermanyPbfUrl({
      fetchFn: async () =>
        new Response('timestamp=2026-06-02T20\\:20\\:36Z\nsequenceNumber=1\n', { status: 200 }),
    })
    expect(r.resolvedVia).toBe('dated_from_state')
    expect(r.basename).toBe('germany-260602.osm.pbf')
    expect(r.url).toBe(germanyPbfUrlFromBasename('germany-260602.osm.pbf'))
  })

  const stateText = 'timestamp=2026-10-31T21\\:23\\:06Z\nsequenceNumber=1\n'
  const fetchWithLatest =
    (latest: () => Response): GeofabrikGermanyFetchFn =>
    async (_input, init) =>
      init?.method === 'HEAD' ? latest() : new Response(stateText, { status: 200 })

  test('keeps the dated file when germany-latest is older than the state', async () => {
    const r = await resolveGeofabrikGermanyPbfUrl({
      fetchFn: fetchWithLatest(
        () =>
          new Response(null, {
            status: 200,
            headers: { 'last-modified': 'Sat, 31 Oct 2026 04:12:09 GMT' },
          }),
      ),
    })
    expect(r.resolvedVia).toBe('dated_from_state')
    expect(r.basename).toBe('germany-261031.osm.pbf')
    expect(r.latestModifiedAt).toBe('2026-10-31T04:12:09.000Z')
  })

  test('uses germany-latest when it is newer than the state', async () => {
    const r = await resolveGeofabrikGermanyPbfUrl({
      fetchFn: fetchWithLatest(
        () =>
          new Response(null, {
            status: 200,
            headers: { 'last-modified': 'Sun, 01 Nov 2026 04:12:09 GMT' },
          }),
      ),
    })
    expect(r.resolvedVia).toBe('latest_newer_than_state')
    expect(r.basename).toBe('germany-latest.osm.pbf')
    expect(r.replicationTimestamp).toBe('2026-10-31T21:23:06Z')
  })

  test('keeps the dated file when germany-latest cannot be checked', async () => {
    const r = await resolveGeofabrikGermanyPbfUrl({
      fetchFn: fetchWithLatest(() => {
        throw new Error('mirror down')
      }),
    })
    expect(r.resolvedVia).toBe('dated_from_state')
    expect(r.latestModifiedAt).toBeNull()
  })

  test('falls back to germany-latest when state fetch fails', async () => {
    const r = await resolveGeofabrikGermanyPbfUrl({
      fetchFn: async () => new Response('', { status: 500 }),
    })
    expect(r.resolvedVia).toBe('latest_fallback')
    expect(r.basename).toBe('germany-latest.osm.pbf')
  })
})
