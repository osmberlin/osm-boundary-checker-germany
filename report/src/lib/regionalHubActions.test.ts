import { describe, expect, it } from 'vitest'
import { regionalHubEditorHrefs } from './regionalHubActions'

describe('regionalHubEditorHrefs', () => {
  it('opens iD and JOSM on the relation without pre-filled writes', () => {
    const hrefs = regionalHubEditorHrefs({ relationId: '62422', wdQid: 'Q64' })
    expect(hrefs.id).toContain('ideditor.netlify.app')
    expect(hrefs.id).toContain('id=r62422')
    expect(hrefs.id).not.toMatch(/addTags/i)
    expect(hrefs.josm).toContain('127.0.0.1:8111/load_object')
    expect(hrefs.josm).toContain('objects=r62422')
    expect(hrefs.josm).not.toMatch(/addtags/i)
    expect(hrefs.wikidata).toBe('https://www.wikidata.org/wiki/Q64')
    expect(hrefs.id).not.toContain('quickstatements')
    expect(hrefs.wikidata).not.toContain('quickstatements')
  })

  it('opens Wikidata from the OSM tag when P1388 did not hit', () => {
    expect(
      regionalHubEditorHrefs({
        relationId: '27019',
        wdQid: undefined,
        osmWikidata: 'Q2937',
      }).wikidata,
    ).toBe('https://www.wikidata.org/wiki/Q2937')
  })

  it('omits OSM editors when there is no relation', () => {
    const hrefs = regionalHubEditorHrefs({ relationId: undefined, wdQid: 'Q64' })
    expect(hrefs.id).toBeNull()
    expect(hrefs.josm).toBeNull()
    expect(hrefs.wikidata).toBe('https://www.wikidata.org/wiki/Q64')
  })
})
