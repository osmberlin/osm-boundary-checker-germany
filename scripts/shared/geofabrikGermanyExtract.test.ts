import { describe, expect, test } from 'bun:test'
import {
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

  test('falls back to germany-latest when state fetch fails', async () => {
    const r = await resolveGeofabrikGermanyPbfUrl({
      fetchFn: async () => new Response('', { status: 500 }),
    })
    expect(r.resolvedVia).toBe('latest_fallback')
    expect(r.basename).toBe('germany-latest.osm.pbf')
  })
})
