import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseProcessingLogJsonl, type LogEvent } from '../../report/src/types/processingLog.ts'
import { workspaceRootFromHere } from '../shared/workspaceRoot.ts'

export function formatProcessingLogJsonl(events: LogEvent[]) {
  if (events.length === 0) return ''
  return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
}

export function normalizeProcessingLogJsonlText(text: string): string {
  return formatProcessingLogJsonl(parseProcessingLogJsonl(text))
}

function main() {
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
