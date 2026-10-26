import { describe, expect, test } from 'bun:test'
import { roundTableMetrics } from './tableMetricPrecision.ts'

describe('roundTableMetrics', () => {
  test('keeps four significant digits, also for very small and large values', () => {
    expect(
      roundTableMetrics({
        iou: 0.8972449958827532,
        hausdorffM: 1060.5298065760176,
        hausdorffNorm: 4.593115131813383e-6,
        officialAreaM2: 12816244.161565673,
        issueIndicator: { level: 'ok', reasons: [] },
      }),
    ).toEqual({
      iou: 0.8972,
      hausdorffM: 1061,
      hausdorffNorm: 4.593e-6,
      officialAreaM2: 12820000,
      issueIndicator: { level: 'ok', reasons: [] },
    })
  })

  test('rounding twice changes nothing, so unchanged rows compare equal', () => {
    const once = roundTableMetrics({ iou: 0.123456789 })
    expect(roundTableMetrics(once)).toEqual(once)
  })

  test('passes null through', () => {
    expect(roundTableMetrics(null)).toBeNull()
  })
})
