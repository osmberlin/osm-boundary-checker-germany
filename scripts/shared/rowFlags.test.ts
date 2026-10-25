import { describe, expect, test } from 'bun:test'
import { buildRowFlagDefinitions, evaluateRowFlags, type RowFlagConfig } from './rowFlags.ts'

const flag: RowFlagConfig = {
  id: 'flagged',
  officialProperty: 'p',
  equals: true,
  label: 'Label',
  hint: 'Hint',
}

describe('evaluateRowFlags', () => {
  test('boolean flag matches true, "true" and 1 but not their opposites or absence', () => {
    for (const value of [true, 'true', 'TRUE', 1, '1']) {
      expect(evaluateRowFlags({ p: value }, [flag])).toEqual(['flagged'])
    }
    for (const value of [false, 'false', 0, '0', '', 'yes', null]) {
      expect(evaluateRowFlags({ p: value }, [flag])).toEqual([])
    }
    expect(evaluateRowFlags({}, [flag])).toEqual([])
    expect(evaluateRowFlags(null, [flag])).toEqual([])
  })

  test('equals false matches false, "false" and 0', () => {
    const notFlagged = { ...flag, equals: false }
    expect(evaluateRowFlags({ p: 0 }, [notFlagged])).toEqual(['flagged'])
    expect(evaluateRowFlags({ p: 'false' }, [notFlagged])).toEqual(['flagged'])
    expect(evaluateRowFlags({ p: true }, [notFlagged])).toEqual([])
  })

  test('string and number flags compare by value', () => {
    expect(evaluateRowFlags({ p: 'a' }, [{ ...flag, equals: 'a' }])).toEqual(['flagged'])
    expect(evaluateRowFlags({ p: 'b' }, [{ ...flag, equals: 'a' }])).toEqual([])
    expect(evaluateRowFlags({ p: '3' }, [{ ...flag, equals: 3 }])).toEqual(['flagged'])
    expect(evaluateRowFlags({ p: 3 }, [{ ...flag, equals: 3 }])).toEqual(['flagged'])
    expect(evaluateRowFlags({ p: 4 }, [{ ...flag, equals: 3 }])).toEqual([])
  })
})

describe('buildRowFlagDefinitions', () => {
  test('returns undefined without flags, counts per flag otherwise', () => {
    expect(buildRowFlagDefinitions([], [['flagged']])).toBeUndefined()
    const other: RowFlagConfig = {
      ...flag,
      id: 'other',
      sortFirst: true,
      detailProperty: 'd',
      detailLabel: 'D',
    }
    expect(buildRowFlagDefinitions([flag, other], [['flagged'], [], ['flagged', 'other']])).toEqual(
      [
        { id: 'flagged', label: 'Label', hint: 'Hint', count: 2 },
        {
          id: 'other',
          label: 'Label',
          hint: 'Hint',
          sortFirst: true,
          detailProperty: 'd',
          detailLabel: 'D',
          count: 1,
        },
      ],
    )
  })
})
