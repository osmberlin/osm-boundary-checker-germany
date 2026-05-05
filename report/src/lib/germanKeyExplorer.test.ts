import { describe, expect, test } from 'vitest'
import {
  ags8FromArs12Digits,
  brandenburgGemeinden8From12,
  digitsOnly,
  parseArs12Segments,
  sourceKeyForPreset,
  statistikportalGemeindeUrl,
  tryBerlinBezirkCanonical5,
} from './germanKeyExplorer'

describe('germanKeyExplorer', () => {
  test('digitsOnly strips non-digits', () => {
    expect(digitsOnly('12 345 / x')).toBe('12345')
  })

  test('parseArs12Segments splits 12-digit ARS', () => {
    expect(parseArs12Segments('145213040530')).toEqual({
      bundesland: '14',
      regierungsbezirk: '5',
      kreis: '21',
      gemeindeverband: '3040',
      gemeinde: '530',
    })
  })

  test('ags8FromArs12Digits is first 8 digits', () => {
    expect(ags8FromArs12Digits('145213040530')).toBe('14521304')
  })

  test('brandenburgGemeinden8From12', () => {
    expect(brandenburgGemeinden8From12('120605003024')).toBe('12060024')
  })

  test('statistikportalGemeindeUrl', () => {
    expect(statistikportalGemeindeUrl('07233004')).toBe(
      'https://www.statistikportal.de/de/gemeindeverzeichnis/07233004',
    )
  })

  test('tryBerlinBezirkCanonical5', () => {
    expect(tryBerlinBezirkCanonical5('11001')).toEqual({ ok: true, value: '11000001' })
    expect(tryBerlinBezirkCanonical5('11000001').ok).toBe(false)
  })

  test('sourceKeyForPreset', () => {
    expect(sourceKeyForPreset('plz-5')).toBe('postal_code')
    expect(sourceKeyForPreset('text')).toBe('name')
    expect(sourceKeyForPreset('regional-12')).toBe('de:regionalschluessel')
  })
})
