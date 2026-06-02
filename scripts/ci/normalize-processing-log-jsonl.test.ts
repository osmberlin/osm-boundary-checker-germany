import { describe, expect, test } from 'bun:test'
import {
  formatProcessingLogJsonl,
  normalizeProcessingLogJsonlText,
  parseProcessingLogJsonl,
} from './normalize-processing-log-jsonl.ts'

describe('normalize-processing-log-jsonl', () => {
  test('drops blank lines and re-serializes compactly', () => {
    const input = `
{"kind":"run_start","runId":"a","at":"2026-01-01T00:00:00.000Z","timezone":"Europe/Berlin"}

{"kind":"run_end","runId":"a","at":"2026-01-01T01:00:00.000Z","status":"ok","durationMs":1000}
`
    const out = normalizeProcessingLogJsonlText(input)
    expect(out).toBe(
      '{"kind":"run_start","runId":"a","at":"2026-01-01T00:00:00.000Z","timezone":"Europe/Berlin"}\n' +
        '{"kind":"run_end","runId":"a","at":"2026-01-01T01:00:00.000Z","status":"ok","durationMs":1000}\n',
    )
    expect(parseProcessingLogJsonl(out)).toHaveLength(2)
  })

  test('formatProcessingLogJsonl returns empty string for no events', () => {
    expect(formatProcessingLogJsonl([])).toBe('')
  })
})
