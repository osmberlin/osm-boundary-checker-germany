import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

export type ProcessingLogLine = Record<string, unknown> & { kind: string }

export function parseProcessingLogJsonl(text: string): ProcessingLogLine[] {
  const events: ProcessingLogLine[] = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parsed = JSON.parse(trimmed) as unknown
    if (parsed && typeof parsed === 'object' && 'kind' in parsed) {
      events.push(parsed as ProcessingLogLine)
    }
  }
  return events
}

/** One compact JSON object per line — stable serialization for reviewable git diffs. */
export function formatProcessingLogJsonl(events: ProcessingLogLine[]): string {
  if (events.length === 0) return ''
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
}

export function normalizeProcessingLogJsonlText(text: string): string {
  return formatProcessingLogJsonl(parseProcessingLogJsonl(text))
}

function main(): void {
  const workspaceRoot = workspaceRootFromHere(import.meta.url)
  const rel = process.argv[2]?.trim() || join('data', 'processing-log.jsonl')
  const path = rel.startsWith('/') ? rel : join(workspaceRoot, rel)
  const before = readFileSync(path, 'utf-8')
  const after = normalizeProcessingLogJsonlText(before)
  writeFileSync(path, after, 'utf-8')
  const lineCount = after.trim() === '' ? 0 : after.trimEnd().split('\n').length
  console.log(`[normalize-processing-log-jsonl] Wrote ${lineCount} events to ${path}`)
}

if (import.meta.main) {
  main()
}
