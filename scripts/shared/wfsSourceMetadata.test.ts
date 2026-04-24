import { describe, expect, test } from 'bun:test'
import { extractWfsDateMetadata } from './wfsSourceMetadata.ts'

describe('extractWfsDateMetadata', () => {
  test('returns empty metadata for non-WFS URLs', async () => {
    let called = false
    const fetchMock = (async () => {
      called = true
      return new Response('ignored', { status: 200 })
    }) as unknown as typeof fetch
    const out = await extractWfsDateMetadata('https://example.com/data.geojson', fetchMock)
    expect(out).toEqual({})
    expect(called).toBe(false)
  })

  test('reads source updated/published dates from GetCapabilities XML', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs">
  <ows:ServiceIdentification xmlns:ows="http://www.opengis.net/ows">
    <ows:Title>Example</ows:Title>
  </ows:ServiceIdentification>
  <inspire_common:MetadataDate xmlns:inspire_common="http://inspire.ec.europa.eu/schemas/common/1.0">2024-05-10</inspire_common:MetadataDate>
  <gmd:publicationDate xmlns:gmd="http://www.isotc211.org/2005/gmd">2020-01-15</gmd:publicationDate>
</wfs:WFS_Capabilities>`

    const requested: string[] = []
    const fetchMock = (async (input: RequestInfo | URL) => {
      requested.push(String(input))
      return new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } })
    }) as unknown as typeof fetch

    const out = await extractWfsDateMetadata(
      'https://example.com/wfs?service=WFS&request=GetFeature&typeName=foo:bar&version=2.0.0',
      fetchMock,
    )

    expect(requested).toEqual([
      'https://example.com/wfs?service=WFS&request=GetCapabilities&version=2.0.0',
    ])
    expect(out.sourceDateSource).toBe('wfs_capabilities')
    expect(out.sourceUpdatedAt).toBe('2024-05-10T00:00:00.000Z')
    expect(out.sourcePublishedAt).toBe('2020-01-15T00:00:00.000Z')
  })
})
