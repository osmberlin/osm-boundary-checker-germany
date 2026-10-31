import { describe, expect, it } from 'vitest'
import { dtpCorrectionFormValues, dtpOverrideNotice, osmObjectText } from './dtpCorrection'

describe('dtpOverrideNotice', () => {
  it('returns null without an override comment', () => {
    expect(dtpOverrideNotice(null)).toBeNull()
    expect(dtpOverrideNotice({ dtp_reported_osm_ref: 'relation/1' })).toBeNull()
    expect(dtpOverrideNotice({ override_comment: '  ' })).toBeNull()
  })

  it('shows the reported and the used OSM object', () => {
    expect(
      dtpOverrideNotice({
        override_comment: 'Falsche Relation',
        dtp_reported_osm_ref: 'relation/1',
        override_osm_ref: 'relation/2',
      }),
    ).toEqual({
      comment: 'Falsche Relation',
      impact: null,
      osmRef: { reported: 'relation/1', used: 'relation/2' },
      wikidata: null,
    })
  })

  it('says we use no OSM object when the override removes the reference', () => {
    expect(
      dtpOverrideNotice({ override_comment: 'Kein Objekt in OSM', dtp_reported_osm_ref: 'way/9' }),
    ).toEqual({
      comment: 'Kein Objekt in OSM',
      impact: null,
      osmRef: { reported: 'way/9', used: null },
      wikidata: null,
    })
  })

  it('shows a wikidata line with the reported value', () => {
    expect(
      dtpOverrideNotice({
        override_comment: 'Wikidata',
        dtp_reported_wikidata: 'Q1',
        override_wikidata: 'Q2',
        wikidata: 'Q2',
      }),
    ).toEqual({
      comment: 'Wikidata',
      impact: null,
      osmRef: null,
      wikidata: { reported: 'Q1', used: 'Q2' },
    })
  })

  it('shows a wikidata line when DtP named no item', () => {
    expect(
      dtpOverrideNotice({
        override_comment: 'Wikidata fehlt',
        override_wikidata: 'Q2',
        wikidata: 'Q2',
      }),
    ).toEqual({
      comment: 'Wikidata fehlt',
      impact: null,
      osmRef: null,
      wikidata: { reported: null, used: 'Q2' },
    })
  })

  it('leaves out the wikidata line when the override did not change it', () => {
    expect(
      dtpOverrideNotice({
        override_comment: 'Nur OSM',
        wikidata: 'Q1',
        dtp_reported_osm_ref: 'relation/1',
        override_osm_ref: 'relation/2',
      })?.wikidata,
    ).toBeNull()
  })
})

describe('dtpOverrideNotice impact', () => {
  it('reads the impact of the override', () => {
    expect(
      dtpOverrideNotice({ override_comment: 'Grund', override_impact: 'informational' })?.impact,
    ).toBe('informational')
    expect(dtpOverrideNotice({ override_comment: 'Grund' })?.impact).toBeNull()
  })
})

describe('dtpCorrectionFormValues', () => {
  it('prefers the values DtP reported', () => {
    expect(
      dtpCorrectionFormValues({
        dtp_uuid: 'u-1',
        name: 'Gebiet',
        dtp_reported_osm_ref: 'relation/1',
        dtp_osm_ref: 'relation/2',
        wikidata: 'Q2',
      }),
    ).toEqual({
      dtpUuid: 'u-1',
      dtpName: 'Gebiet',
      dtpOsmRef: 'relation/1',
      dtpWikidata: 'Q2',
    })
  })

  it('does not report an override item as DtP data', () => {
    expect(
      dtpCorrectionFormValues({ dtp_uuid: 'u-1', override_wikidata: 'Q2', wikidata: 'Q2' })
        .dtpWikidata,
    ).toBeUndefined()
  })

  it('leaves empty values undefined', () => {
    expect(dtpCorrectionFormValues({ dtp_uuid: 'u-2', name: ' ' })).toEqual({
      dtpUuid: 'u-2',
      dtpName: undefined,
      dtpOsmRef: undefined,
      dtpWikidata: undefined,
    })
  })
})

describe('osmObjectText', () => {
  it('formats relation and way references', () => {
    expect(osmObjectText('123')).toBe('relation/123')
    expect(osmObjectText('relation/123')).toBe('relation/123')
    expect(osmObjectText('way/45')).toBe('way/45')
    expect(osmObjectText('node/4')).toBe('')
    expect(osmObjectText(undefined)).toBe('')
  })
})
