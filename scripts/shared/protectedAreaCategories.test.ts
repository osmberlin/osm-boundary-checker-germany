import { describe, expect, test } from 'bun:test'
import {
  matchesAnyCategoryScope,
  matchesCategoryScope,
  natura2000CodeToRefDe,
  normalizeNatura2000Code,
  osmNatura2000Codes,
} from './protectedAreaCategories.ts'

describe('category scopes', () => {
  test('NSG: title, class 4 or leisure=nature_reserve', () => {
    expect(matchesCategoryScope({ protection_title: 'Naturschutzgebiet' }, 2)).toBe(true)
    expect(matchesCategoryScope({ protect_class: '4' }, 2)).toBe(true)
    expect(matchesCategoryScope({ leisure: 'nature_reserve' }, 2)).toBe(true)
    expect(
      matchesCategoryScope({ protect_class: '5', protection_title: 'Landschaftsschutzgebiet' }, 2),
    ).toBe(false)
  })

  test('LSG and Naturpark share class 5, a Naturpark title keeps it out of LSG', () => {
    const naturpark = { protect_class: '5', protection_title: 'Naturpark' }
    expect(matchesCategoryScope(naturpark, 5)).toBe(false)
    expect(matchesCategoryScope(naturpark, 4)).toBe(true)
    expect(
      matchesCategoryScope({ protect_class: '5', protection_title: 'Landschaftsschutzgebiet' }, 5),
    ).toBe(true)
    expect(matchesCategoryScope({ protect_class: '5' }, 5)).toBe(true)
  })

  test('FFH and Vogelschutz share class 97, the title decides', () => {
    const ffh = { protect_class: '97', protection_title: 'Fauna-Flora-Habitat-Gebiet' }
    const spa = { protect_class: '97', protection_title: 'Vogelschutzgebiet' }
    expect(matchesCategoryScope(ffh, 7)).toBe(true)
    expect(matchesCategoryScope(ffh, 8)).toBe(false)
    expect(matchesCategoryScope(spa, 8)).toBe(true)
    expect(matchesCategoryScope(spa, 7)).toBe(false)
    expect(matchesCategoryScope({ protect_class: '97' }, 7)).toBe(true)
    expect(matchesCategoryScope({ protect_class: '97' }, 8)).toBe(true)
  })

  test('Biosphaerenreservat excludes Kernzone titles, Nationalpark accepts boundary tag', () => {
    expect(
      matchesCategoryScope(
        { protection_title: 'Biosphärenreservat-Kernzone', protect_class: '1' },
        3,
      ),
    ).toBe(false)
    expect(matchesCategoryScope({ protect_class: '98' }, 3)).toBe(true)
    expect(matchesCategoryScope({ boundary: 'national_park' }, 1)).toBe(true)
  })

  test('multi-valued protect_class and unknown categories', () => {
    expect(matchesCategoryScope({ protect_class: '97;98' }, 3)).toBe(true)
    expect(matchesCategoryScope({ boundary: 'protected_area' }, 999)).toBe(true)
  })

  test('union scope drops wasser- and denkmalschutz', () => {
    const ids = [1, 2, 3, 4, 5, 7, 8, 50]
    expect(
      matchesAnyCategoryScope({ protection_title: 'Wasserschutzgebiet', protect_class: '12' }, ids),
    ).toBe(false)
    expect(
      matchesAnyCategoryScope({ protection_title: 'Naturdenkmal', protect_class: '7' }, ids),
    ).toBe(false)
    expect(
      matchesAnyCategoryScope({ protection_title: 'Naturpark', protect_class: '5' }, ids),
    ).toBe(true)
  })
})

describe('natura 2000 codes', () => {
  test('DtP, ref:DE and ref:SCI notations normalize to the same code', () => {
    expect(normalizeNatura2000Code('DE7148371')).toBe('7148371')
    expect(normalizeNatura2000Code('7148-371')).toBe('7148371')
    expect(normalizeNatura2000Code('7932-371.02')).toBe('7932371')
    expect(normalizeNatura2000Code('DE 4050-301')).toBe('4050301')
    expect(normalizeNatura2000Code('AT3438000')).toBe('AT3438000')
    expect(normalizeNatura2000Code('')).toBe('')
  })

  test('collects codes from all OSM keys', () => {
    expect(osmNatura2000Codes({ 'ref:DE': '7741-371;7741-372', 'ref:SCI': 'DE7741371' })).toEqual([
      '7741371',
      '7741372',
    ])
    expect(natura2000CodeToRefDe('DE7148371')).toBe('7148-371')
  })
})
