import { describe, expect, it } from 'vitest'
import { parseReportRowOsmRef } from './osmObjectRef'

describe('parseReportRowOsmRef', () => {
  it('parses bare numeric id as relation', () => {
    expect(parseReportRowOsmRef('55764')).toEqual({ kind: 'relation', numericId: 55764 })
  })

  it('parses relation/ prefix', () => {
    expect(parseReportRowOsmRef('relation/51477')).toEqual({ kind: 'relation', numericId: 51477 })
    expect(parseReportRowOsmRef('RELATION/99')).toEqual({ kind: 'relation', numericId: 99 })
  })

  it('parses way/ prefix', () => {
    expect(parseReportRowOsmRef('way/12345')).toEqual({ kind: 'way', numericId: 12345 })
    expect(parseReportRowOsmRef('WAY/1')).toEqual({ kind: 'way', numericId: 1 })
  })

  it('returns null for empty or invalid', () => {
    expect(parseReportRowOsmRef('')).toBeNull()
    expect(parseReportRowOsmRef('   ')).toBeNull()
    expect(parseReportRowOsmRef('way/')).toBeNull()
    expect(parseReportRowOsmRef('way/abc')).toBeNull()
    expect(parseReportRowOsmRef('node/1')).toBeNull()
    expect(parseReportRowOsmRef('0')).toBeNull()
  })

  it('trims whitespace', () => {
    expect(parseReportRowOsmRef('  42  ')).toEqual({ kind: 'relation', numericId: 42 })
    expect(parseReportRowOsmRef(' way/7 ')).toEqual({ kind: 'way', numericId: 7 })
  })
})
