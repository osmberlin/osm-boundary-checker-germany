import { describe, expect, test } from 'bun:test'
import {
  attributeChecksConfigSchema,
  evaluateAttributeChecks,
  normalizeAreaNameForCompare,
  type AttributeCheckConfig,
} from './attributeChecks.ts'

const one = (
  check: AttributeCheckConfig,
  official: Record<string, unknown>,
  osm: Record<string, unknown>,
) => evaluateAttributeChecks([check], official, osm)[0]!

describe('normalizeAreaNameForCompare', () => {
  test('folds case, umlauts and diacritics', () => {
    expect(normalizeAreaNameForCompare('Haßberge')).toBe('hassberge')
    expect(normalizeAreaNameForCompare('Mühlbachtäler Café')).toBe('muehlbachtaeler cafe')
  })

  test('drops text in parentheses and angle brackets', () => {
    expect(normalizeAreaNameForCompare('Federsee (Teil 2) <alt>')).toBe('federsee')
  })

  test('drops leading designation words only', () => {
    expect(normalizeAreaNameForCompare('NSG Federsee')).toBe('federsee')
    expect(normalizeAreaNameForCompare('Naturschutzgebiet "Federsee"')).toBe('federsee')
    expect(normalizeAreaNameForCompare('Landschaftsschutzgebiet - Rhön')).toBe('rhoen')
    expect(normalizeAreaNameForCompare('Biosphärenreservat Schwäbische Alb')).toBe(
      'schwaebische alb',
    )
    expect(normalizeAreaNameForCompare('Federsee Naturpark')).toBe('federsee naturpark')
  })

  test('keeps a name that is only a designation', () => {
    expect(normalizeAreaNameForCompare('Naturpark')).toBe('naturpark')
  })

  test('collapses whitespace and punctuation', () => {
    expect(normalizeAreaNameForCompare('  Alb-  Donau,  Kreis ')).toBe('alb donau kreis')
    expect(normalizeAreaNameForCompare(null)).toBe('')
  })
})

describe('evaluateAttributeChecks exact', () => {
  const wikidata: AttributeCheckConfig = {
    label: 'Wikidata',
    official: 'wikidata',
    osm: ['wikidata'],
  }

  test('equal, different and missing', () => {
    expect(one(wikidata, { wikidata: 'Q1' }, { wikidata: ' Q1 ' })).toMatchObject({
      status: 'equal',
      osm: [{ key: 'wikidata', value: 'Q1' }],
    })
    expect(one(wikidata, { wikidata: 'Q1' }, { wikidata: 'Q2' })).toMatchObject({
      status: 'different',
      osm: [{ key: 'wikidata', value: 'Q2' }],
    })
    expect(one(wikidata, { wikidata: 'Q1' }, {}).status).toBe('missing')
    expect(one(wikidata, { wikidata: '' }, { wikidata: 'Q1' }).status).toBe('missing')
    expect(one(wikidata, {}, { wikidata: 'Q1' }).status).toBe('missing')
  })

  test('is case-sensitive', () => {
    expect(one(wikidata, { wikidata: 'Q1' }, { wikidata: 'q1' }).status).toBe('different')
  })

  test('compares numbers with strings and accepts one part of a list', () => {
    const wdpa: AttributeCheckConfig = { label: 'WDPA-ID', official: 'wdpa', osm: ['ref:WDPA'] }
    expect(one(wdpa, { wdpa: 1542 }, { 'ref:WDPA': '1542' }).status).toBe('equal')
    expect(one(wdpa, { wdpa: '1542' }, { 'ref:WDPA': '12; 1542' }).status).toBe('equal')
    expect(one(wdpa, { wdpa: '1542' }, { 'ref:WDPA': '154' }).status).toBe('different')
  })
})

describe('evaluateAttributeChecks name', () => {
  const name: AttributeCheckConfig = {
    label: 'Name',
    official: 'name',
    osm: ['name', 'official_name'],
    compare: 'name',
  }

  test('equal when any listed key matches (kombinierte Namensregel)', () => {
    const result = one(
      name,
      { name: 'Federsee' },
      { name: 'Federseeried', official_name: 'NSG Federsee' },
    )
    expect(result.status).toBe('equal')
    expect(result.osmKeys).toEqual(['name', 'official_name'])
    expect(result.osm).toEqual([{ key: 'official_name', value: 'NSG Federsee' }])
  })

  test('different lists every present key', () => {
    const result = one(
      name,
      { name: 'Federsee' },
      { name: 'Anderer See', official_name: 'Nochmal anders' },
    )
    expect(result.status).toBe('different')
    expect(result.osm.map((pair) => pair.key)).toEqual(['name', 'official_name'])
  })

  test('missing without a listed key', () => {
    expect(one(name, { name: 'Federsee' }, { ref: '1' }).status).toBe('missing')
  })
})

describe('evaluateAttributeChecks natura2000', () => {
  const natura: AttributeCheckConfig = {
    label: 'Natura 2000',
    official: 'natura2000_code',
    osm: ['ref:DE', 'ref:SCI', 'ref:natura2000'],
    compare: 'natura2000',
  }

  test('DE5526471 equals 5526-471', () => {
    expect(one(natura, { natura2000_code: 'DE5526471' }, { 'ref:DE': '5526-471' }).status).toBe(
      'equal',
    )
    expect(one(natura, { natura2000_code: 'DE5526471' }, { 'ref:SCI': 'DE 5526-471' }).status).toBe(
      'equal',
    )
    expect(
      one(natura, { natura2000_code: 'DE5526471' }, { 'ref:DE': '1111-111;5526-471.01' }).status,
    ).toBe('equal')
  })

  test('different code, missing code', () => {
    expect(one(natura, { natura2000_code: 'DE5526471' }, { 'ref:DE': '5526-472' }).status).toBe(
      'different',
    )
    expect(one(natura, { natura2000_code: 'DE5526471' }, { name: 'x' }).status).toBe('missing')
    expect(one(natura, {}, { 'ref:DE': '5526-471' }).status).toBe('missing')
  })
})

describe('evaluateAttributeChecks protectedCategory', () => {
  const category: AttributeCheckConfig = {
    label: 'Schutzkategorie',
    official: 'category_id',
    osm: ['protection_title', 'protect_class'],
    compare: 'protectedCategory',
  }

  test('equal when the tags fit the category scope', () => {
    const result = one(
      category,
      { category_id: 2 },
      { protection_title: 'Naturschutzgebiet', protect_class: '4' },
    )
    expect(result.status).toBe('equal')
    expect(result.osm).toHaveLength(2)
  })

  test('different when they fit another category', () => {
    expect(
      one(
        category,
        { category_id: 2 },
        { protection_title: 'Landschaftsschutzgebiet', protect_class: '5' },
      ).status,
    ).toBe('different')
  })

  test('missing without OSM type tags or without a known category', () => {
    expect(one(category, { category_id: 2 }, { name: 'x' }).status).toBe('missing')
    expect(one(category, { category_id: 999 }, { protect_class: '4' }).status).toBe('missing')
    expect(one(category, { category_id: '' }, { protect_class: '4' }).status).toBe('missing')
  })
})

describe('evaluateAttributeChecks input', () => {
  test('no checks or no tags', () => {
    expect(evaluateAttributeChecks(undefined, {}, {})).toEqual([])
    expect(
      evaluateAttributeChecks(
        [{ label: 'W', official: 'wikidata', osm: ['wikidata'] }],
        { wikidata: 'Q1' },
        null,
      )[0]!.status,
    ).toBe('missing')
  })
})

describe('attributeChecksConfigSchema', () => {
  test('parses, is strict and rejects empty lists', () => {
    expect(
      attributeChecksConfigSchema.parse([
        { label: ' W ', official: 'wikidata', osm: ['wikidata'] },
      ]),
    ).toEqual([{ label: 'W', official: 'wikidata', osm: ['wikidata'] }])
    expect(() => attributeChecksConfigSchema.parse([])).toThrow()
    expect(() =>
      attributeChecksConfigSchema.parse([{ label: 'W', official: 'w', osm: [] }]),
    ).toThrow()
    expect(() =>
      attributeChecksConfigSchema.parse([
        { label: 'W', official: 'w', osm: ['w'], compare: 'fuzzy' },
      ]),
    ).toThrow()
    expect(() =>
      attributeChecksConfigSchema.parse([{ label: 'W', official: 'w', osm: ['w'], extra: 1 }]),
    ).toThrow()
  })
})
