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
  test('plz-5 normalizes official values to 5 digits', () => {
    expect(normalizeOfficialValue('13585', 'plz-5')).toBe('13585')
    expect(normalizeOfficialValue('1234', 'plz-5')).toBe('01234')
    expect(normalizeOfficialValue('10115-000', 'plz-5')).toBe('10115')
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

describe('normalizeOsmValue plz-5', () => {
  test('normalizes postal_code values to 5 digits', () => {
    const n = normalizeOsmValue('postal_code', '12105', 'plz-5')
    expect(n.canonicalMatchKey).toBe('12105')
  })
  test('pads short and truncates long values with notes', () => {
    const padded = normalizeOsmValue('postal_code', '987', 'plz-5')
    expect(padded.canonicalMatchKey).toBe('00987')
    expect(padded.notes.some((x) => x.includes('left-padded'))).toBe(true)

    const truncated = normalizeOsmValue('postal_code', '123456', 'plz-5')
    expect(truncated.canonicalMatchKey).toBe('12345')
    expect(truncated.notes.some((x) => x.includes('truncated'))).toBe(true)
  })
})
