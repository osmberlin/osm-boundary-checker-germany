import { describe, expect, test } from 'vitest'
import { germanKeyLookupBundleSchema } from '../../../scripts/shared/germanKeyLookupPayload.ts'
import {
  ags8FromArs12Digits,
  brandenburgGemeinden8From12,
  coerceSchluesselExplorerPreset,
  digitsOnly,
  formatNormalizationNotesForExplorerUi,
  germanKeyExplorerLinkValueOrNull,
  isGermanKeyExplorerDisplayKey,
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
import {
  mergeGermanKeyLookupTables,
  resolveGemeindeNameByAgs,
  searchGermanKeyDisplayNames,
} from './germanKeyLookupBundle'

const minimalLookupBundle = germanKeyLookupBundleSchema.parse({
  checkedAt: '2026-01-01T00:00:00.000Z',
  generatedAt: '2026-01-01T00:00:00.000Z',
  latest: {
    id: 'latest',
    label: 'Test latest',
    provenanceLines: [],
    sourcePublicUrl: 'https://example.invalid/latest',
    source: {
      downloadUrl: 'https://example.invalid/latest.zip',
      archiveEntry: 'GV100AD_01012026.txt',
      snapshotDate: '2026-01-01',
    },
    bundeslaender: { '01': 'Schleswig-Holstein' },
    regierungsbezirke: {},
    kreise: { '01001': 'Flensburg, Stadt' },
    gemeindeverbaende: { '010010000': 'Flensburg, Stadt' },
    gemeindenByAgs: { '01001000': 'Flensburg, Stadt' },
    gemeindenByArs: { '010010000000': 'Flensburg, Stadt' },
  },
  annualSourcePublicUrlsByYear: {
    '2020': 'https://example.invalid/2020',
  },
  obsolete: {
    maps: {
      bundeslaender: {},
      regierungsbezirke: {},
      kreise: {},
      gemeindeverbaende: {},
      gemeindenByAgs: { '99999999': 'Altstadt Obacht' },
      gemeindenByArs: {},
    },
    lastContainedInYear: {
      bundeslaender: {},
      regierungsbezirke: {},
      kreise: {},
      gemeindeverbaende: {},
      gemeindenByAgs: { '99999999': 2020 },
      gemeindenByArs: {},
    },
  },
})

/** Obsolete ARS only (reassigned key in latest): digit lookup must not require substring match in name. */
const bundleObsoleteArsOnly = germanKeyLookupBundleSchema.parse({
  ...minimalLookupBundle,
  obsolete: {
    maps: {
      ...minimalLookupBundle.obsolete.maps,
      gemeindenByArs: {
        '071405006112': 'Oberwesel, Stadt',
      },
    },
    lastContainedInYear: {
      ...minimalLookupBundle.obsolete.lastContainedInYear,
      gemeindenByArs: {
        '071405006112': 2020,
      },
    },
  },
})

function mergedTables(): GermanKeyLookupTables {
  return mergeGermanKeyLookupTables(minimalLookupBundle)
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

  test('lookup helpers resolve official names from merged tables', () => {
    const tables = mergedTables()
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

  test('obsolete AGS resolves via bundle helper', () => {
    const r = resolveGemeindeNameByAgs(minimalLookupBundle, '99999999')
    expect(r.value).toBe('Altstadt Obacht')
    expect(r.obsolete?.year).toBe(2020)
  })

  test('searchGermanKeyDisplayNames: digit-only query finds obsolete ARS without name substring', () => {
    const hits = searchGermanKeyDisplayNames(bundleObsoleteArsOnly, '071405006112')
    const ars = hits.find((h) => h.kind === 'ars' && h.id === '071405006112')
    expect(ars?.displayName).toBe('Oberwesel, Stadt')
    expect(ars?.obsolete?.year).toBe(2020)
  })

  test('searchGermanKeyDisplayNames: name query finds obsolete ARS alongside latest', () => {
    const hits = searchGermanKeyDisplayNames(bundleObsoleteArsOnly, 'Oberwesel')
    expect(hits.some((h) => h.kind === 'ars' && h.id === '071405006112')).toBe(true)
  })

  test('isGermanKeyExplorerDisplayKey accepts RS/AGS tag keys and amtliche ARS/AGS labels', () => {
    expect(isGermanKeyExplorerDisplayKey('de:regionalschluessel')).toBe(true)
    expect(isGermanKeyExplorerDisplayKey('de:amtlicher_gemeindeschluessel')).toBe(true)
    expect(isGermanKeyExplorerDisplayKey('ARS')).toBe(true)
    expect(isGermanKeyExplorerDisplayKey('AGS')).toBe(true)
    expect(isGermanKeyExplorerDisplayKey('postal_code')).toBe(false)
    expect(isGermanKeyExplorerDisplayKey('name')).toBe(false)
  })

  test('germanKeyExplorerLinkValueOrNull coerces strings/numbers, rejects empty / digit-less / non-finite', () => {
    expect(germanKeyExplorerLinkValueOrNull('012345678901')).toBe('012345678901')
    expect(germanKeyExplorerLinkValueOrNull('  07233004  ')).toBe('07233004')
    expect(germanKeyExplorerLinkValueOrNull(7233004)).toBe('7233004')
    expect(germanKeyExplorerLinkValueOrNull('')).toBeNull()
    expect(germanKeyExplorerLinkValueOrNull('   ')).toBeNull()
    expect(germanKeyExplorerLinkValueOrNull('Berlin')).toBeNull()
    expect(germanKeyExplorerLinkValueOrNull('--------')).toBeNull()
    expect(germanKeyExplorerLinkValueOrNull(Number.NaN)).toBeNull()
    expect(germanKeyExplorerLinkValueOrNull(Number.POSITIVE_INFINITY)).toBeNull()
  })
})
