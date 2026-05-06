import { describe, expect, test } from 'bun:test'
import type { DownloadOfficialHttp } from './downloadOfficialConfig.ts'
import { resolveHttpOfficialUpstream } from './officialUpstreamResolution.ts'

function xmlResponse(body: string): Response {
  return new Response(body, { status: 200, headers: { 'content-type': 'application/xml' } })
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

const wfsInspireSpec = (url: string): DownloadOfficialHttp => ({
  kind: 'http',
  url,
  format: 'geojson',
  upstreamDateResolver: 'wfs_inspire_iso19139',
})

const ogcTemporalSpec = (url: string): DownloadOfficialHttp => ({
  kind: 'http',
  url,
  format: 'geojson',
  upstreamDateResolver: 'ogc_api_features_temporal_end',
})

const iso19139Spec = (
  url: string,
  metadataUrl: string,
  upstreamDateSourceKind: 'wfs_capabilities' | 'ogc_api_features_collection',
): DownloadOfficialHttp => ({
  kind: 'http',
  url,
  format: 'geojson',
  upstreamDateResolver: 'iso19139_xml',
  upstreamMetadataUrl: metadataUrl,
  upstreamDateSourceKind,
})

describe('resolveHttpOfficialUpstream', () => {
  test('resolves WFS INSPIRE metadata URL via GetCapabilities', async () => {
    const capabilitiesXml = `
      <wfs:WFS_Capabilities xmlns:wfs="http://www.opengis.net/wfs/2.0" xmlns:inspire_common="http://inspire.ec.europa.eu/schemas/common/1.0">
        <inspire_common:URL>https://example.test/berlin-metadata.xml</inspire_common:URL>
      </wfs:WFS_Capabilities>
    `
    const metadataXml = `
      <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:dateStamp><gco:DateTime>2026-04-20T09:37:55Z</gco:DateTime></gmd:dateStamp>
        <gmd:CI_Date>
          <gmd:date><gco:Date>2025-12-31</gco:Date></gmd:date>
          <gmd:dateType><gmd:CI_DateTypeCode codeListValue="revision"/></gmd:dateType>
        </gmd:CI_Date>
      </gmd:MD_Metadata>
    `
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('request=GetCapabilities')) return xmlResponse(capabilitiesXml)
      if (url === 'https://example.test/berlin-metadata.xml') return xmlResponse(metadataXml)
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch

    const out = await resolveHttpOfficialUpstream(
      wfsInspireSpec(
        'https://gdi.berlin.de/services/wfs/alkis_bezirke?service=WFS&version=2.0.0&request=GetFeature',
      ),
      fetchMock,
    )
    expect(out.sourceUpdatedAt).toBe('2025-12-31T00:00:00.000Z')
    expect(out.sourceDateSource).toBe('wfs_capabilities')
  })

  test('resolves ISO19139 from configured metadata URL (WFS provenance)', async () => {
    const metadataXml = `
      <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:dateStamp><gco:DateTime>2026-03-01T12:00:00Z</gco:DateTime></gmd:dateStamp>
      </gmd:MD_Metadata>
    `
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url === 'https://example.test/bb-metadata.xml') return xmlResponse(metadataXml)
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch

    const out = await resolveHttpOfficialUpstream(
      iso19139Spec(
        'https://isk.geobasis-bb.de/ows/vg_wfs?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature',
        'https://example.test/bb-metadata.xml',
        'wfs_capabilities',
      ),
      fetchMock,
    )
    expect(out.sourceUpdatedAt).toBe('2026-03-01T12:00:00.000Z')
    expect(out.sourceDateSource).toBe('wfs_capabilities')
  })

  test('resolves OGC API Features collection temporal interval end', async () => {
    const fetchMock = (async () =>
      jsonResponse({
        extent: {
          temporal: {
            interval: [['2013-12-31T00:00:00Z', '2024-12-31T00:00:00Z']],
          },
        },
      })) as unknown as typeof fetch

    const out = await resolveHttpOfficialUpstream(
      ogcTemporalSpec(
        'https://api.hamburg.de/datasets/v1/regionalstatistische_daten_bezirke/collections/regionalstatistische_daten_bezirke/items?f=json',
      ),
      fetchMock,
    )
    expect(out.sourceUpdatedAt).toBe('2024-12-31T00:00:00.000Z')
    expect(out.sourceDateSource).toBe('ogc_api_features_collection')
  })

  test('resolves ISO19139 from configured metadata URL (OGC collection provenance)', async () => {
    const metadataXml = `
      <gmd:MD_Metadata xmlns:gmd="http://www.isotc211.org/2005/gmd" xmlns:gco="http://www.isotc211.org/2005/gco">
        <gmd:CI_Date>
          <gmd:date><gco:Date>2024-09-15</gco:Date></gmd:date>
          <gmd:dateType><gmd:CI_DateTypeCode codeListValue="revision"/></gmd:dateType>
        </gmd:CI_Date>
      </gmd:MD_Metadata>
    `
    const fetchMock = (async (input: RequestInfo | URL) => {
      const url = String(input)
      if (
        url ===
        'https://geoportal.brandenburg.de/gs-json/xml?fileid=b90acca9-e512-4c6c-a45e-ecc04a1e580c'
      ) {
        return xmlResponse(metadataXml)
      }
      return new Response('not found', { status: 404 })
    }) as unknown as typeof fetch

    const out = await resolveHttpOfficialUpstream(
      iso19139Spec(
        'https://ogc-api.geobasis-bb.de/datasets/plz/collections/plz_bebb/items?bulk=true&f=json',
        'https://geoportal.brandenburg.de/gs-json/xml?fileid=b90acca9-e512-4c6c-a45e-ecc04a1e580c',
        'ogc_api_features_collection',
      ),
      fetchMock,
    )
    expect(out.sourceUpdatedAt).toBe('2024-09-15T00:00:00.000Z')
    expect(out.sourceDateSource).toBe('ogc_api_features_collection')
  })
})
