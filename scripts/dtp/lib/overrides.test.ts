import { describe, expect, test } from 'bun:test'
import { type DtpOverride, dtpOverrideSchema } from '../../shared/dtpOverrides.ts'
import type { DtpOfficialFeature, DtpOfficialProperties } from './officialRows.ts'
import { applyDtpOverrides } from './overrides.ts'

const UUID = 'a6ca9152-f47f-4139-b02d-21eee9196c63'
const OTHER_UUID = '6bc7b12c-ef9d-450f-b789-c67ef619714b'

function feature(uuid: string, props: Partial<DtpOfficialProperties> = {}): DtpOfficialFeature {
  return {
    type: 'Feature',
    properties: {
      match_key: `dtp-${uuid}`,
      wdpa: '',
      dtp_uuid: uuid,
      name: 'Gebiet',
      category_id: 2,
      category_name: 'Naturpark',
      dtp_osm_ref: null,
      wikidata: null,
      natura2000_code: null,
      parent_uuid: null,
      state_ids: null,
      dtp_managed: false,
      geometry_source_name: null,
      geometry_source_url: null,
      geometry_license_name: null,
      geometry_license_url: null,
      dtp_url: `https://example.test/${uuid}`,
      ...props,
    },
    geometry: { type: 'MultiPolygon', coordinates: [] },
  }
}

function entry(props: Record<string, unknown>): DtpOverride {
  return dtpOverrideSchema.parse({
    dtpUuid: UUID,
    name: 'Stechlin-Ruppiner Land',
    comment: 'Begründung',
    decidedAt: '2026-10-31',
    ...props,
  })
}

const osmChange = { osmRef: 'relation/18068246', reportedOsmRef: 'way/137159334' }
const wikidataChange = { wikidata: 'Q1970418', reportedWikidata: null }

describe('applyDtpOverrides', () => {
  test('osmRef: applies while DtP still has the reviewed reference, keeps DtP value as reported', () => {
    const input = [feature(UUID, { dtp_osm_ref: 'way/137159334' })]
    const { features, applied, outdated } = applyDtpOverrides(input, [entry(osmChange)])
    expect(features[0]?.properties).toMatchObject({
      dtp_osm_ref: null,
      dtp_reported_osm_ref: 'way/137159334',
      override_osm_ref: 'relation/18068246',
      override_comment: 'Begründung',
    })
    expect(features[0]?.properties).not.toHaveProperty('dtp_reported_wikidata')
    expect(applied).toEqual([{ dtpUuid: UUID, name: 'Stechlin-Ruppiner Land', parts: ['osmRef'] }])
    expect(outdated).toEqual([])
  })

  test('osmRef: the guard compares normalized refs (osm.org URL equals the reviewed ref)', () => {
    const input = [feature(UUID, { dtp_osm_ref: 'https://www.openstreetmap.org/Way/137159334' })]
    const { applied } = applyDtpOverrides(input, [entry(osmChange)])
    expect(applied).toHaveLength(1)
  })

  test('osmRef: a DtP value that changed makes the change outdated and leaves the feature as DtP has it', () => {
    const input = [feature(UUID, { dtp_osm_ref: 'relation/999' })]
    const { features, applied, outdated } = applyDtpOverrides(input, [entry(osmChange)])
    expect(features[0]).toBe(input[0]!)
    expect(features[0]?.properties).not.toHaveProperty('override_osm_ref')
    expect(features[0]?.properties).not.toHaveProperty('override_comment')
    expect(applied).toEqual([])
    expect(outdated).toEqual([{ dtpUuid: UUID, name: 'Stechlin-Ruppiner Land', parts: ['osmRef'] }])
  })

  test('osmRef null deletes DtP reference without an override_osm_ref property (null-safe guard)', () => {
    const e = entry({ osmRef: null, reportedOsmRef: null })
    const { features, applied, outdated } = applyDtpOverrides([feature(UUID)], [e])
    expect(features[0]?.properties.dtp_osm_ref).toBeNull()
    expect(features[0]?.properties.dtp_reported_osm_ref).toBeNull()
    expect(features[0]?.properties).not.toHaveProperty('override_osm_ref')
    expect(features[0]?.properties.override_comment).toBe('Begründung')
    expect(applied).toHaveLength(1)
    expect(outdated).toEqual([])
  })

  test('osmRef null with a DtP reference that changed is outdated', () => {
    const e = entry({ osmRef: null, reportedOsmRef: 'relation/5' })
    const { features, outdated } = applyDtpOverrides(
      [feature(UUID, { dtp_osm_ref: 'relation/6' })],
      [e],
    )
    expect(features[0]?.properties.dtp_osm_ref).toBe('relation/6')
    expect(outdated).toHaveLength(1)
  })

  test('wikidata: applies while DtP names no item (reportedWikidata null), keeps DtP value', () => {
    const { features, applied } = applyDtpOverrides([feature(UUID)], [entry(wikidataChange)])
    expect(features[0]?.properties).toMatchObject({
      wikidata: 'Q1970418',
      override_wikidata: 'Q1970418',
      dtp_reported_wikidata: null,
      override_comment: 'Begründung',
    })
    expect(applied).toEqual([
      { dtpUuid: UUID, name: 'Stechlin-Ruppiner Land', parts: ['wikidata'] },
    ])
  })

  test('wikidata: a DtP item that changed makes the change outdated', () => {
    const e = entry({ wikidata: 'Q1970418', reportedWikidata: 'Q1' })
    const { features, applied, outdated } = applyDtpOverrides(
      [feature(UUID, { wikidata: 'Q2' })],
      [e],
    )
    expect(features[0]?.properties.wikidata).toBe('Q2')
    expect(applied).toEqual([])
    expect(outdated).toEqual([
      { dtpUuid: UUID, name: 'Stechlin-Ruppiner Land', parts: ['wikidata'] },
    ])
  })

  test('both changes on one entry; one outdated part does not block the other', () => {
    const e = entry({ ...osmChange, ...wikidataChange })
    const both = applyDtpOverrides([feature(UUID, { dtp_osm_ref: 'way/137159334' })], [e])
    expect(both.features[0]?.properties).toMatchObject({
      override_osm_ref: 'relation/18068246',
      wikidata: 'Q1970418',
      dtp_reported_wikidata: null,
    })
    expect(both.applied[0]?.parts).toEqual(['osmRef', 'wikidata'])

    const partial = applyDtpOverrides([feature(UUID, { dtp_osm_ref: 'relation/999' })], [e])
    expect(partial.features[0]?.properties).toMatchObject({
      dtp_osm_ref: 'relation/999',
      wikidata: 'Q1970418',
    })
    expect(partial.features[0]?.properties).not.toHaveProperty('override_osm_ref')
    expect(partial.applied[0]?.parts).toEqual(['wikidata'])
    expect(partial.outdated[0]?.parts).toEqual(['osmRef'])
  })

  test('features of other areas are returned unchanged and the input is not mutated', () => {
    const other = feature(OTHER_UUID, { dtp_osm_ref: 'way/137159334' })
    const mine = feature(UUID, { dtp_osm_ref: 'way/137159334' })
    const input = [other, mine]
    const snapshot = structuredClone(input)
    const { features } = applyDtpOverrides(input, [entry(osmChange)])
    expect(features[0]).toBe(other)
    expect(input).toEqual(snapshot)
  })

  test('no entries: nothing applied or outdated', () => {
    const input = [feature(UUID)]
    const { features, applied, outdated } = applyDtpOverrides(input, [])
    expect(features).toEqual(input)
    expect(applied).toEqual([])
    expect(outdated).toEqual([])
  })
})
