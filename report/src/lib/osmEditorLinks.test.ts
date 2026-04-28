import { describe, expect, it } from 'vitest'
import type { ReportRow } from '../types/report'
import { buildOpenStreetMapIdEditUrl, ID_DISABLE_FEATURES } from './osmEditorLinks'

function makeReportRow(overrides: Partial<ReportRow> = {}): ReportRow {
  return {
    canonicalMatchKey: '11000002',
    nameLabel: 'Berlin Friedrichshain-Kreuzberg',
    category: 'matched',
    osmRelationId: '55764',
    metrics: null,
    mapBbox: [13.35, 52.45, 13.5, 52.56],
    officialForEditPath: null,
    officialProperties: null,
    osmProperties: null,
    ...overrides,
  }
}

describe('buildOpenStreetMapIdEditUrl', () => {
  it('returns standalone iD URL with hash parameters', () => {
    const url = buildOpenStreetMapIdEditUrl(
      makeReportRow(),
      'https://example.org/official_for_edit/11000002.geojson',
    )
    const parsed = new URL(url)
    const hash = new URLSearchParams(parsed.hash.slice(1))

    expect(parsed.origin).toBe('https://ideditor.netlify.app')
    expect(parsed.pathname).toBe('/')
    expect(parsed.search).toBe('')
    expect(hash.get('id')).toBe('r55764')
    expect(hash.get('map')).toMatch(/^\d+\/-?\d+\.\d{6}\/-?\d+\.\d{6}$/)
    expect(hash.get('disable_features')).toBe(ID_DISABLE_FEATURES)
    expect(hash.get('gpx')).toBe('https://example.org/official_for_edit/11000002.geojson')
  })

  it('omits id and map when row has no relation or bbox', () => {
    const url = buildOpenStreetMapIdEditUrl(
      makeReportRow({ osmRelationId: '', mapBbox: null }),
      null,
    )
    const parsed = new URL(url)
    const hash = new URLSearchParams(parsed.hash.slice(1))

    expect(hash.get('id')).toBeNull()
    expect(hash.get('map')).toBeNull()
    expect(hash.get('gpx')).toBeNull()
    expect(hash.get('disable_features')).toBe(ID_DISABLE_FEATURES)
  })
})
