import { describe, expect, it } from 'bun:test'
import { decodeCommonHtmlEntities, parseBkgVg25AktualitaetsstandFromHtml } from './bkgGdzCatalog.ts'

describe('parseBkgVg25AktualitaetsstandFromHtml', () => {
  it('parses unicode Aktualitätsstand line', () => {
    const html =
      '<section><h3>Aktualität</h3><p>Fortführungszyklus: 1 Jahr Aktualitätsstand: 31.12.2024</p></section>'
    expect(parseBkgVg25AktualitaetsstandFromHtml(html)).toEqual({
      sourceDateIsoDate: '2024-12-31',
      displayDe: '31.12.2024',
    })
  })

  it('parses HTML entity form', () => {
    const html = '<p>Aktualit&auml;tsstand: 7.1.2025 und mehr Text</p>'
    expect(parseBkgVg25AktualitaetsstandFromHtml(html)).toEqual({
      sourceDateIsoDate: '2025-01-07',
      displayDe: '07.01.2025',
    })
  })

  it('returns null when marker missing', () => {
    expect(parseBkgVg25AktualitaetsstandFromHtml('<html><body>nothing</body></html>')).toBeNull()
  })
})

describe('decodeCommonHtmlEntities', () => {
  it('normalizes auml for regex match', () => {
    expect(decodeCommonHtmlEntities('Aktualit&auml;tsstand')).toBe('Aktualitätsstand')
  })
})
