import { describe, expect, test } from 'bun:test'
import {
  officialPropertyToMatchKey,
  parseOfficialKeyTransposition,
} from './officialKeyTransposition.ts'

describe('parseOfficialKeyTransposition', () => {
  test('parses minimal map with default targetKey', () => {
    const kt = parseOfficialKeyTransposition('hamburg-bezirke', 'bezirk_nr', {
      map: { '1': '020000000001' },
    })
    expect(kt?.targetKey).toBe('de:regionalschluessel')
    expect(kt?.map['1']).toBe('020000000001')
  })

  test('rejects wrong targetKey', () => {
    expect(() =>
      parseOfficialKeyTransposition('x', 'id', {
        targetKey: 'name',
        map: { a: '1' },
      }),
    ).toThrow(/targetKey/)
  })

  test('rejects sourceProperty mismatch vs matchProperty', () => {
    expect(() =>
      parseOfficialKeyTransposition('x', 'bezirk_nr', {
        sourceProperty: 'bezirk',
        map: { '1': '020000000001' },
      }),
    ).toThrow(/sourceProperty/)
  })

  test('rejects duplicate mapped Schlüssel values', () => {
    expect(() =>
      parseOfficialKeyTransposition('x', 'id', {
        map: { '1': '020000000001', '2': '020000000001' },
      }),
    ).toThrow(/duplicate target/)
  })
})

describe('officialPropertyToMatchKey', () => {
  test('maps then normalizes regional-12', () => {
    const kt = parseOfficialKeyTransposition('x', 'bezirk_nr', {
      map: { '3': '020000000003' },
    })!
    const key = officialPropertyToMatchKey({ bezirk_nr: '3' }, 'bezirk_nr', kt, 'regional-12')
    expect(key).toBe('020000000003')
  })

  test('throws on missing map entry', () => {
    const kt = parseOfficialKeyTransposition('x', 'bezirk_nr', {
      map: { '1': '020000000001' },
    })!
    expect(() =>
      officialPropertyToMatchKey({ bezirk_nr: '99' }, 'bezirk_nr', kt, 'regional-12'),
    ).toThrow(/missing entry/)
  })
})
