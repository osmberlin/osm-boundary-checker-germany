import { describe, expect, it } from 'vitest'
import { parseLiveOsmObjectRef, parseReportRowOsmRef } from './osmObjectRef'

describe('parseReportRowOsmRef', () => {
  it('parses bare numeric id as relation', () => {
    expect(parseReportRowOsmRef('55764')).toEqual({ numericId: 55764 })
  })

  it('parses relation/ prefix', () => {
    expect(parseReportRowOsmRef('relation/51477')).toEqual({ numericId: 51477 })
    expect(parseReportRowOsmRef('RELATION/99')).toEqual({ numericId: 99 })
  })

  it('returns null for way/ prefix (not used in app rows)', () => {
    expect(parseReportRowOsmRef('way/12345')).toBeNull()
    expect(parseReportRowOsmRef('WAY/1')).toBeNull()
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
    expect(parseReportRowOsmRef('  42  ')).toEqual({ numericId: 42 })
  })
})

describe('parseLiveOsmObjectRef', () => {
  it('parses ways, relations and bare ids', () => {
    expect(parseLiveOsmObjectRef('way/123')).toEqual({ type: 'way', id: 123 })
    expect(parseLiveOsmObjectRef(' WAY/5 ')).toEqual({ type: 'way', id: 5 })
    expect(parseLiveOsmObjectRef('relation/9')).toEqual({ type: 'relation', id: 9 })
    expect(parseLiveOsmObjectRef('3892267')).toEqual({ type: 'relation', id: 3892267 })
  })

  it('returns null for nodes, zero and empty', () => {
    expect(parseLiveOsmObjectRef('node/1')).toBeNull()
    expect(parseLiveOsmObjectRef('way/0')).toBeNull()
    expect(parseLiveOsmObjectRef('')).toBeNull()
  })
})
