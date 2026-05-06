/**
 * Resolve authoritative **`sourceUpdatedAt`** for HTTP official downloads before geometry fetch.
 * Contract: [`docs/processing-and-analysis.md`](../../docs/processing-and-analysis.md) → Source timestamp contract.
 */

import { z } from 'zod'
import type { DownloadOfficialHttp } from './downloadOfficialConfig.ts'

const COLLECTION_MARKER = '/collections/'

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

type IsoMetadataDates = {
  sourceUpdatedAt?: string
  sourcePublishedAt?: string
}

const ogcCollectionTemporalSchema = z.object({
  extent: z.object({
    temporal: z.object({
      interval: z.array(z.tuple([z.string().nullable(), z.string().nullable()])),
    }),
  }),
})

function parseTemporalIntervalEnd(json: unknown): string | null {
  const parsed = ogcCollectionTemporalSchema.safeParse(json)
  if (!parsed.success) return null
  const first = parsed.data.extent.temporal.interval[0]
  if (!first) return null
  const end = first[1]
  const trimmed = end?.trim()
  return trimmed ? trimmed : null
}

function normalizeDateCandidate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (ISO_DATE_ONLY.test(trimmed)) return `${trimmed}T00:00:00.000Z`
  const ts = Date.parse(trimmed)
  if (!Number.isFinite(ts)) return null
  return new Date(ts).toISOString()
}

function parseIso19139Dates(xmlText: string): IsoMetadataDates {
  const out: IsoMetadataDates = {}
  const dateStampMatch = xmlText.match(
    /<gmd:dateStamp\b[\s\S]*?<gco:(?:DateTime|Date)\b[^>]*>([^<]+)<\/gco:(?:DateTime|Date)>[\s\S]*?<\/gmd:dateStamp>/i,
  )
  const dateStampIso = dateStampMatch?.[1] ? normalizeDateCandidate(dateStampMatch[1]) : null
  if (dateStampIso) out.sourceUpdatedAt = dateStampIso

  const ciDatePattern =
    /<gmd:CI_Date\b[\s\S]*?<gmd:date\b[\s\S]*?<gco:(?:DateTime|Date)\b[^>]*>([^<]+)<\/gco:(?:DateTime|Date)>[\s\S]*?<gmd:CI_DateTypeCode\b[^>]*codeListValue=['"]([^'"]+)['"][\s\S]*?<\/gmd:CI_Date>/gi
  for (const match of xmlText.matchAll(ciDatePattern)) {
    const dateRaw = match[1]?.trim()
    const typeRaw = match[2]?.trim().toLowerCase()
    if (!dateRaw || !typeRaw) continue
    const iso = normalizeDateCandidate(dateRaw)
    if (!iso) continue
    if (typeRaw === 'revision') {
      out.sourceUpdatedAt = iso
    } else if (
      (typeRaw === 'publication' || typeRaw === 'creation') &&
      out.sourcePublishedAt === undefined
    ) {
      out.sourcePublishedAt = iso
    }
  }
  return out
}

function toGetCapabilitiesUrl(rawUrl: string): string {
  const original = new URL(rawUrl)
  const version = original.searchParams.get('version')?.trim()
  const out = new URL(original.origin + original.pathname)
  out.searchParams.set('service', 'WFS')
  out.searchParams.set('request', 'GetCapabilities')
  if (version) out.searchParams.set('version', version)
  return out.toString()
}

function toCollectionDocUrlFromItems(itemsUrl: string): string {
  const u = new URL(itemsUrl)
  const idx = u.pathname.indexOf(COLLECTION_MARKER)
  if (idx === -1) {
    throw new Error(`Could not derive collection URL from items URL: ${itemsUrl}`)
  }
  const basePath = u.pathname.slice(0, idx)
  const rest = u.pathname.slice(idx + COLLECTION_MARKER.length)
  const collectionId = rest.split('/')[0]?.trim()
  if (!collectionId) {
    throw new Error(`Could not derive collection ID from items URL: ${itemsUrl}`)
  }
  return `${u.origin}${basePath}${COLLECTION_MARKER}${collectionId}`
}

async function fetchText(url: string, fetchImpl: typeof fetch, accept: string): Promise<string> {
  const response = await fetchImpl(url, {
    headers: { Accept: accept },
    redirect: 'follow',
  })
  if (!response.ok) {
    const body = (await response.text()).trim().slice(0, 220)
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${url}${body ? ` :: ${body}` : ''}`,
    )
  }
  return await response.text()
}

async function fetchJson(url: string, fetchImpl: typeof fetch): Promise<unknown> {
  const response = await fetchImpl(url, {
    headers: { Accept: 'application/json' },
    redirect: 'follow',
  })
  if (!response.ok) {
    const body = (await response.text()).trim().slice(0, 220)
    throw new Error(
      `HTTP ${response.status} ${response.statusText} for ${url}${body ? ` :: ${body}` : ''}`,
    )
  }
  return await response.json()
}

function extractInspireMetadataUrl(capabilitiesXml: string): string | null {
  const inspireUrl = capabilitiesXml.match(
    /<inspire_common:URL>\s*([^<]+)\s*<\/inspire_common:URL>/i,
  )?.[1]
  if (inspireUrl?.trim()) return decodeXmlEntities(inspireUrl.trim())
  return null
}

function decodeXmlEntities(input: string): string {
  return input
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function pickUpdatedOrThrow(
  dates: IsoMetadataDates,
  sourceLabel: string,
): {
  sourceUpdatedAt: string
  sourcePublishedAt?: string
} {
  const sourceUpdatedAt = dates.sourceUpdatedAt ?? dates.sourcePublishedAt
  if (!sourceUpdatedAt) {
    throw new Error(`${sourceLabel} returned no usable updated/publication date in metadata XML`)
  }
  return {
    sourceUpdatedAt,
    sourcePublishedAt: dates.sourcePublishedAt,
  }
}

export type ResolvedOfficialUpstream = {
  sourceUpdatedAt: string
  sourcePublishedAt?: string
  sourceDateSource: 'wfs_capabilities' | 'ogc_api_features_collection'
}

async function resolveIso19139FromUrl(
  metadataUrl: string,
  fetchImpl: typeof fetch,
  sourceDateSource: ResolvedOfficialUpstream['sourceDateSource'],
): Promise<ResolvedOfficialUpstream> {
  const metadataXml = await fetchText(
    metadataUrl,
    fetchImpl,
    'application/xml, text/xml;q=0.9, */*;q=0.1',
  )
  const pick = pickUpdatedOrThrow(
    parseIso19139Dates(metadataXml),
    `ISO19139 metadata ${metadataUrl}`,
  )
  return {
    sourceUpdatedAt: pick.sourceUpdatedAt,
    sourcePublishedAt: pick.sourcePublishedAt,
    sourceDateSource,
  }
}

async function resolveWfsInspireIso19139(
  officialDownloadUrl: string,
  fetchImpl: typeof fetch,
): Promise<ResolvedOfficialUpstream> {
  const capsUrl = toGetCapabilitiesUrl(officialDownloadUrl)
  const capsXml = await fetchText(capsUrl, fetchImpl, 'application/xml, text/xml;q=0.9, */*;q=0.1')
  const metadataUrl = extractInspireMetadataUrl(capsXml)
  if (!metadataUrl) {
    throw new Error(`WFS GetCapabilities missing inspire_common:URL metadata link (${capsUrl})`)
  }
  return await resolveIso19139FromUrl(metadataUrl, fetchImpl, 'wfs_capabilities')
}

async function resolveOgcApiFeaturesTemporalEnd(
  officialDownloadUrl: string,
  fetchImpl: typeof fetch,
): Promise<ResolvedOfficialUpstream> {
  const collectionUrl = toCollectionDocUrlFromItems(officialDownloadUrl)
  const jsonUrl = `${collectionUrl}?f=json`
  const json = await fetchJson(jsonUrl, fetchImpl)
  const endIso = parseTemporalIntervalEnd(json)
  if (!endIso) {
    throw new Error(
      `OGC API Features collection JSON missing extent.temporal.interval end (${jsonUrl})`,
    )
  }
  return {
    sourceUpdatedAt: new Date(endIso).toISOString(),
    sourceDateSource: 'ogc_api_features_collection',
  }
}

export async function resolveHttpOfficialUpstream(
  spec: DownloadOfficialHttp,
  fetchImpl: typeof fetch = fetch,
): Promise<ResolvedOfficialUpstream> {
  switch (spec.upstreamDateResolver) {
    case 'wfs_inspire_iso19139':
      return await resolveWfsInspireIso19139(spec.url, fetchImpl)
    case 'iso19139_xml':
      return await resolveIso19139FromUrl(
        spec.upstreamMetadataUrl,
        fetchImpl,
        spec.upstreamDateSourceKind,
      )
    case 'ogc_api_features_temporal_end':
      return await resolveOgcApiFeaturesTemporalEnd(spec.url, fetchImpl)
  }
}
