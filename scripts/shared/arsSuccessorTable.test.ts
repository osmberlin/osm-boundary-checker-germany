import { describe, expect, test } from 'bun:test'
import {
  ags8FromArs12,
  lookupSuccessorForExplorerKey,
  parseArsSuccessorTable,
} from './arsSuccessorTable.ts'
import { loadArsSuccessorTable } from './arsSuccessorTableFs.ts'

const hanau = {
  fromArs: '064350014014',
  toArs: '064150000000',
  validFrom: '2026-01-01',
  kind: 'kreisfrei' as const,
  note: 'Hanau wurde kreisfreie Stadt und verließ den Main-Kinzig-Kreis.',
  issueUrl: 'https://github.com/osmberlin/osm-boundary-checker-germany/issues/17',
}

describe('arsSuccessorTable', () => {
  test('loads the checked-in Hanau seed', () => {
    const table = loadArsSuccessorTable()
    expect(table.successors).toHaveLength(1)
    expect(table.successors[0]?.fromArs).toBe(hanau.fromArs)
    expect(table.successors[0]?.toArs).toBe(hanau.toArs)
  })

  test('strips non-digits then requires 12 digits', () => {
    const table = parseArsSuccessorTable({
      successors: [{ ...hanau, fromArs: '06435 0014 014' }],
    })
    expect(table.successors[0]?.fromArs).toBe(hanau.fromArs)
  })

  test('rejects duplicate fromArs', () => {
    expect(() =>
      parseArsSuccessorTable({
        successors: [hanau, { ...hanau, toArs: '064160000000' }],
      }),
    ).toThrow(/duplicate fromArs/)
  })

  test('rejects fromArs === toArs', () => {
    expect(() =>
      parseArsSuccessorTable({
        successors: [{ ...hanau, toArs: hanau.fromArs }],
      }),
    ).toThrow(/must differ/)
  })

  test('rejects non-12-digit ARS', () => {
    expect(() =>
      parseArsSuccessorTable({
        successors: [{ ...hanau, fromArs: '06435001' }],
      }),
    ).toThrow(/12-digit/)
  })

  test('ags8FromArs12 skips association digits', () => {
    expect(ags8FromArs12('010570008008')).toBe('01057008')
    expect(ags8FromArs12('010575785008')).toBe('01057008')
    expect(ags8FromArs12('064350014014')).toBe('06435014')
  })

  test('explorer lookup hits Hanau from either ARS and unique AGS', () => {
    const table = parseArsSuccessorTable({ successors: [hanau] })
    expect(lookupSuccessorForExplorerKey(table, '064350014014')?.side).toBe('from')
    expect(lookupSuccessorForExplorerKey(table, '064150000000')?.side).toBe('to')
    expect(lookupSuccessorForExplorerKey(table, '010570008008')).toBeNull()
    expect(lookupSuccessorForExplorerKey(table, '06435014')?.side).toBe('from')
    expect(lookupSuccessorForExplorerKey(table, '06415000')?.side).toBe('to')
  })
})
