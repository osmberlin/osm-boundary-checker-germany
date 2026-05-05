import { describe, expect, test } from 'vitest'
import germanKeyLookupBundle from '../data/germanKeyLookup.gen'
import {
  ags8FromArs12Digits,
  brandenburgGemeinden8From12,
  coerceSchluesselExplorerPreset,
  digitsOnly,
  formatNormalizationNotesForExplorerUi,
  isSchluesselExplorerPreset,
  lookupArsSegmentNames,
  lookupGemeindeNameByAgs,
  lookupNameForNormalizedPresetKey,
  parseArs12Segments,
  sourceKeyForPreset,
  statistikportalGemeindeUrl,
  tryBerlinBezirkCanonical5,
  type GermanKeyLookupTables,
} from './germanKeyExplorer'

function lookupTablesDefault(): GermanKeyLookupTables {
  const ds = germanKeyLookupBundle.datasets[germanKeyLookupBundle.defaultDatasetId]
  return {
    bundeslaender: ds.bundeslaender,
    regierungsbezirke: ds.regierungsbezirke,
    kreise: ds.kreise,
    gemeindeverbaende: ds.gemeindeverbaende,
    gemeindenByAgs: ds.gemeindenByAgs,
    gemeindenByArs: ds.gemeindenByArs,
  }
}

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

  test('ags8FromArs12Digits derives LLRKK + GGG from ARS', () => {
    expect(ags8FromArs12Digits('145213040530')).toBe('14521530')
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

  test('coerceSchluesselExplorerPreset', () => {
    expect(coerceSchluesselExplorerPreset('regional-12')).toBe('regional-12')
    expect(coerceSchluesselExplorerPreset('plz-5')).toBe('')
    expect(coerceSchluesselExplorerPreset(undefined)).toBe('')
  })

  test('isSchluesselExplorerPreset', () => {
    expect(isSchluesselExplorerPreset('amtlicher-8')).toBe(true)
    expect(isSchluesselExplorerPreset('plz-5')).toBe(false)
    expect(isSchluesselExplorerPreset(undefined)).toBe(false)
  })

  test('formatNormalizationNotesForExplorerUi maps known tokens', () => {
    expect(formatNormalizationNotesForExplorerUi(['bb-gemeinden-first5-plus-last3'])).toContain(
      'Brandenburg',
    )
    expect(formatNormalizationNotesForExplorerUi(['unexpected-digit-length:9'])).toContain('9')
    expect(formatNormalizationNotesForExplorerUi(['unknown-token'])).toBe('unknown-token')
  })

  test('lookup helpers resolve official names', () => {
    const tables = lookupTablesDefault()
    expect(lookupGemeindeNameByAgs(tables, '01001000')).toBe('Flensburg, Stadt')
    expect(lookupNameForNormalizedPresetKey(tables, 'regional-12', '010010000000')).toBe(
      'Flensburg, Stadt',
    )
    expect(lookupArsSegmentNames(tables, '010010000000')).toEqual({
      bundesland: 'Schleswig-Holstein',
      regierungsbezirk: null,
      kreis: 'Flensburg, Stadt',
      gemeindeverband: 'Flensburg, Stadt',
      gemeinde: 'Flensburg, Stadt',
    })
  })
})
