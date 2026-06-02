import type { Gv100AdRow } from './gv100AdRow.ts'

export function parseGv100AdTxtRows(buffer: Buffer): Gv100AdRow[] {
  const utf8Text = new TextDecoder('utf-8').decode(buffer)
  const text = utf8Text.includes('\uFFFD') ? new TextDecoder('latin1').decode(buffer) : utf8Text
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '')
  return lines.map((line, index) => ({
    satzart: line.slice(0, 2),
    snapshotDateRaw: line.slice(2, 10),
    land: line.slice(10, 12),
    rb: line.slice(12, 13),
    kreis: line.slice(13, 15),
    gem: line.slice(15, 18),
    vb: line.slice(18, 22),
    name: line.slice(22, 72),
    lineOrRow: index + 1,
  }))
}
