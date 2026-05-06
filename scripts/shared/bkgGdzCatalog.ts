/**
 * Parses BKG GDZ VG25 product page HTML for **Aktualitätsstand** (reference calendar date).
 * See `docs/processing-and-analysis.md` → “Source timestamp contract”.
 */

const AKTUALITAETSSTAND_RE = /Aktualit(?:ä|auml;|ae)tsstand:\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/i

/** Minimal HTML entity decode for German text around “Aktualitätsstand”. */
export function decodeCommonHtmlEntities(html: string): string {
  return html
    .replace(/&auml;/gi, 'ä')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&Auml;/g, 'Ä')
    .replace(/&Ouml;/g, 'Ö')
    .replace(/&Uuml;/g, 'Ü')
    .replace(/&szlig;/gi, 'ß')
    .replace(/&nbsp;/gi, ' ')
}

export type BkgGdzParsedStand = {
  /** `YYYY-MM-DD` calendar (Germany reference date). */
  sourceDateIsoDate: string
  displayDe: string
}

export function parseBkgVg25AktualitaetsstandFromHtml(html: string): BkgGdzParsedStand | null {
  const text = decodeCommonHtmlEntities(html)
  const m = text.match(AKTUALITAETSSTAND_RE)
  if (!m) return null
  const dd = Number(m[1])
  const mm = Number(m[2])
  const yyyy = Number(m[3])
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  const y = String(yyyy).padStart(4, '0')
  const mo = String(mm).padStart(2, '0')
  const d = String(dd).padStart(2, '0')
  return {
    sourceDateIsoDate: `${y}-${mo}-${d}`,
    displayDe: `${d}.${mo}.${y}`,
  }
}

export async function fetchBkgVg25GdzProductHtml(
  productPageUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(productPageUrl, {
    headers: {
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
  })
  if (!res.ok) {
    throw new Error(`BKG GDZ product page HTTP ${res.status} ${res.statusText}`)
  }
  return await res.text()
}
