import { describe, expect, it } from 'bun:test'
import { osmAreaSummaryFreshness } from './osmAreaSummaryFreshness'

describe('osmAreaSummaryFreshness', () => {
  it('shows extract line when snapshot and processed times differ', () => {
    const fresh = osmAreaSummaryFreshness({
      downloadedAt: '2026-05-25T20:20:50.000Z',
      extractedAt: '2026-05-31T06:17:46.343Z',
      sourceDateSource: 'osm_pbf_header',
    })
    expect(fresh.detailLine).toContain('Verarbeitet')
    expect(fresh.detailLine).toContain('2026')
  })

  it('omits detail line when only one timestamp exists', () => {
    const fresh = osmAreaSummaryFreshness({
      downloadedAt: '2026-05-31T06:17:46.343Z',
      sourceDateSource: 'osm_pbf_header',
    })
    expect(fresh.detailLine).toBeNull()
  })
})
