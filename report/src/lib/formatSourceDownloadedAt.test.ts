import { describe, expect, it } from 'vitest'
import {
  formatIsoTimestampToAbsoluteDe,
  formatIsoTimestampToCompactDateDe,
  formatRelativeAgeAltDe,
  formatSnapshotDateLabelDe,
} from './formatSourceDownloadedAt'
import { parseIsoToBerlinOrThrow } from './time/parse'

describe('formatSourceDownloadedAt (Europe/Berlin)', () => {
  it('formats UTC instant as Berlin local time', () => {
    expect(formatIsoTimestampToAbsoluteDe('2026-06-01T02:30:00.000Z')).toMatch(
      /1\. Juni 2026 04:30/,
    )
  })

  it('formats date-only keys in Berlin', () => {
    expect(formatSnapshotDateLabelDe('2026-06-01')).toMatch(/01\.06\.2026|1\.6\.2026/)
  })

  it('formats compact parenthetical stands without clock time', () => {
    expect(formatIsoTimestampToCompactDateDe('2025-12-31')).toBe('31. Dez. 2025')
    expect(formatIsoTimestampToCompactDateDe('2026-08-31T20:21:00.000Z')).toBe('31. Aug. 2026')
  })

  it('relative age uses Berlin now', () => {
    const at = parseIsoToBerlinOrThrow('2026-01-01T12:00:00.000Z')
    const label = formatRelativeAgeAltDe(at)
    expect(label).toMatch(/alt$/)
  })
})
