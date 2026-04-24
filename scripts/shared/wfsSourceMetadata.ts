import { z } from 'zod'

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const ISO_DATETIME_PREFIX = /^\d{4}-\d{2}-\d{2}T/
const XML_TEXT_TAG_PATTERN =
  /<([A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)\b[^>]*>([^<]{4,120})<\/(?:[A-Za-z_][\w.-]*:)?([A-Za-z_][\w.-]*)>/g

const WFS_DATE_METADATA_SCHEMA = z.object({
  sourcePublishedAt: z.string().regex(ISO_DATETIME_PREFIX).optional(),
  sourceUpdatedAt: z.string().regex(ISO_DATETIME_PREFIX).optional(),
  sourceDateSource: z.literal('wfs_capabilities').optional(),
})

export type WfsDateMetadata = z.infer<typeof WFS_DATE_METADATA_SCHEMA>

function normalizeDateCandidate(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (ISO_DATE_ONLY.test(trimmed)) return `${trimmed}T00:00:00.000Z`
  const ts = Date.parse(trimmed)
  if (!Number.isFinite(ts)) return null
  return new Date(ts).toISOString()
}

function isLikelyWfsSourceUrl(rawUrl: string): boolean {
  const lower = rawUrl.toLowerCase()
  return (
    lower.includes('service=wfs') || lower.includes('request=getfeature') || lower.includes('/wfs')
  )
}

function toGetCapabilitiesUrl(rawUrl: string): string | null {
  try {
    const original = new URL(rawUrl)
    const version = original.searchParams.get('version')?.trim()
    const out = new URL(original.origin + original.pathname)
    out.searchParams.set('service', 'WFS')
    out.searchParams.set('request', 'GetCapabilities')
    if (version) out.searchParams.set('version', version)
    return out.toString()
  } catch {
    return null
  }
}

function pickDateMetadataFromXml(xmlText: string): WfsDateMetadata {
  let sourceUpdatedAt: string | undefined
  let sourcePublishedAt: string | undefined
  let match: RegExpExecArray | null
  while ((match = XML_TEXT_TAG_PATTERN.exec(xmlText)) !== null) {
    const openingTag = match[2]?.toLowerCase()
    const closingTag = match[4]?.toLowerCase()
    const value = match[3]
    if (!openingTag || !closingTag || openingTag !== closingTag || value == null) continue
    const normalized = normalizeDateCandidate(value)
    if (!normalized) continue

    const isPublishedTag =
      openingTag.includes('publication') ||
      openingTag.includes('published') ||
      openingTag.includes('issued') ||
      openingTag.includes('creation')
    const isUpdatedTag =
      openingTag.includes('revision') ||
      openingTag.includes('modified') ||
      openingTag.includes('updated') ||
      openingTag.includes('lastupdate') ||
      openingTag.includes('datestamp') ||
      openingTag.includes('metadatadate')

    if (!sourcePublishedAt && isPublishedTag) sourcePublishedAt = normalized
    if (!sourceUpdatedAt && isUpdatedTag) sourceUpdatedAt = normalized

    // Generic fallback if capabilities expose unnamed date fields.
    if (!sourceUpdatedAt && !sourcePublishedAt && openingTag === 'date') {
      sourceUpdatedAt = normalized
    }
  }

  return WFS_DATE_METADATA_SCHEMA.parse({
    sourcePublishedAt,
    sourceUpdatedAt,
    sourceDateSource:
      sourcePublishedAt != null || sourceUpdatedAt != null ? 'wfs_capabilities' : undefined,
  })
}

export async function extractWfsDateMetadata(
  sourceUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<WfsDateMetadata> {
  if (!isLikelyWfsSourceUrl(sourceUrl)) return WFS_DATE_METADATA_SCHEMA.parse({})
  const capabilitiesUrl = toGetCapabilitiesUrl(sourceUrl)
  if (!capabilitiesUrl) return WFS_DATE_METADATA_SCHEMA.parse({})
  const response = await fetchImpl(capabilitiesUrl, {
    headers: {
      Accept: 'application/xml, text/xml;q=0.9, application/gml+xml;q=0.8, */*;q=0.1',
    },
  })
  if (!response.ok) return WFS_DATE_METADATA_SCHEMA.parse({})
  const xmlText = await response.text()
  return pickDateMetadataFromXml(xmlText)
}
