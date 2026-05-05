import { describe, expect, it } from 'vitest'
import type { ReportRow } from '../types/report'
import {
  buildJosmEditorLinks,
  buildOpenStreetMapIdEditUrl,
  CHANGESET_HASHTAG_GRENZABGLEICH,
  ID_DISABLE_FEATURES,
} from './osmEditorLinks'

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
    expect(hash.get('hashtags')).toBe(CHANGESET_HASHTAG_GRENZABGLEICH)
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
    expect(hash.get('hashtags')).toBe(CHANGESET_HASHTAG_GRENZABGLEICH)
  })
})

describe('buildJosmEditorLinks', () => {
  it('includes changeset_hashtags on load_object and keeps objects query', () => {
    const { loadObject } = buildJosmEditorLinks(makeReportRow(), null)
    expect(loadObject).not.toBeNull()
    const parsed = new URL(loadObject!)
    expect(parsed.origin).toBe('http://127.0.0.1:8111')
    expect(parsed.pathname).toBe('/load_object')
    expect(parsed.searchParams.get('relation_members')).toBe('true')
    expect(parsed.searchParams.get('objects')).toBe('r55764')
    expect(parsed.searchParams.get('changeset_hashtags')).toBe(CHANGESET_HASHTAG_GRENZABGLEICH)
  })

  it('places changeset_hashtags before url on import', () => {
    const geoUrl = 'https://example.org/official_for_edit/11000002.geojson'
    const { importGeojson } = buildJosmEditorLinks(makeReportRow(), geoUrl)
    expect(importGeojson).not.toBeNull()
    expect(importGeojson).toMatch(
      /^http:\/\/127\.0\.0\.1:8111\/import\?new_layer=true&changeset_hashtags=grenzabgleich&url=/,
    )
    const parsed = new URL(importGeojson!)
    expect(parsed.searchParams.get('changeset_hashtags')).toBe(CHANGESET_HASHTAG_GRENZABGLEICH)
    expect(parsed.searchParams.get('url')).toBe(geoUrl)
  })

  it('returns null load_object when no relation id', () => {
    const { loadObject, importGeojson } = buildJosmEditorLinks(
      makeReportRow({ osmRelationId: '' }),
      'https://example.org/x.geojson',
    )
    expect(loadObject).toBeNull()
    expect(importGeojson).not.toBeNull()
    expect(new URL(importGeojson!).searchParams.get('changeset_hashtags')).toBe(
      CHANGESET_HASHTAG_GRENZABGLEICH,
    )
  })
})
