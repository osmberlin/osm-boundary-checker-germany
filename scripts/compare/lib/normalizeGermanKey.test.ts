import { describe, expect, test } from 'bun:test'
import {
  berlinBezirkToCanonical,
  normalizeOfficialValue,
  normalizeOsmValue,
} from './normalizeGermanKey.ts'

describe('berlinBezirkToCanonical', () => {
  test('11001 → 11000001', () => {
    expect(berlinBezirkToCanonical('11001')).toBe('11000001')
  })
  test('11012 → 11000012', () => {
    expect(berlinBezirkToCanonical('11012')).toBe('11000012')
  })
})

describe('normalizeOsmValue berlin-bezirk-ags', () => {
  test('5-digit regionalschlüssel', () => {
    const n = normalizeOsmValue('de:regionalschluessel', '11001', 'berlin-bezirk-ags')
    expect(n.canonicalMatchKey).toBe('11000001')
    expect(n.notes.some((x) => x.includes('berlin'))).toBe(true)
  })
})

describe('normalizeOfficialValue', () => {
  test('strips to digits', () => {
    expect(normalizeOfficialValue('11000001', 'berlin-bezirk-ags')).toBe('11000001')
  })
  test('regional-12 pads short BKG ARS to 12 digits', () => {
    expect(normalizeOfficialValue('01001', 'regional-12')).toBe('010010000000')
    expect(normalizeOfficialValue('11', 'regional-12')).toBe('110000000000')
  })
  test('regional-12 truncates long ARS', () => {
    expect(normalizeOfficialValue('1200000000001', 'regional-12')).toBe('120000000000')
  })
  test('brandenburg-gemeinden-8 converts semicolon key to LLRKKGGG', () => {
    expect(normalizeOfficialValue('12;0;60;280', 'brandenburg-gemeinden-8')).toBe('12060280')
    expect(normalizeOfficialValue('12;0;51;000', 'brandenburg-gemeinden-8')).toBe('12051000')
  })
})

describe('normalizeOsmValue regional-12', () => {
  test('pads short de:regionalschluessel to 12 digits', () => {
    const n = normalizeOsmValue('de:regionalschluessel', '010515163', 'regional-12')
    expect(n.canonicalMatchKey).toBe('010515163000')
    expect(n.notes.some((x) => x.includes('padded'))).toBe(true)
  })
})

describe('normalizeOsmValue brandenburg-gemeinden-8', () => {
  test('derives LLRKKGGG from 12-digit de:regionalschluessel', () => {
    const n = normalizeOsmValue('de:regionalschluessel', '120605003024', 'brandenburg-gemeinden-8')
    expect(n.canonicalMatchKey).toBe('12060024')
    expect(n.notes.some((x) => x.includes('first5-plus-last3'))).toBe(true)
  })
})
