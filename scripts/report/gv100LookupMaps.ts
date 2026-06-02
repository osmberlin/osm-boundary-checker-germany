import type { GermanKeyLookupMaps } from '../shared/germanKeyLookupPayload.ts'
import {
  type Gv100AdRow,
  kreisKeyFromRow,
  makeAgs8,
  makeArs12,
  normalizeDigits,
} from './gv100AdRow.ts'

export type LookupDuplicateWarning = {
  scope: string
  key: string
  previous: string
  incoming: string
  lineOrRow: number
}

function setLookupValue(
  target: Map<string, string>,
  key: string,
  value: string,
  scope: string,
  lineOrRow: number,
  onDuplicate: ((warning: LookupDuplicateWarning) => void) | undefined,
): void {
  const trimmed = value.trim()
  if (key.trim() === '' || trimmed === '') return
  const prev = target.get(key)
  if (prev !== undefined && prev !== trimmed) {
    onDuplicate?.({ scope, key, previous: prev, incoming: trimmed, lineOrRow })
    return
  }
  target.set(key, trimmed)
}

function sortedObject(map: Map<string, string>): Record<string, string> {
  return Object.fromEntries(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true })),
  )
}

export function rowsToLookupMaps(
  rows: Gv100AdRow[],
  onDuplicate?: (warning: LookupDuplicateWarning) => void,
): GermanKeyLookupMaps {
  const bundeslaender = new Map<string, string>()
  const regierungsbezirke = new Map<string, string>()
  const kreise = new Map<string, string>()
  const gemeindeverbaende = new Map<string, string>()
  const gemeindenByAgs = new Map<string, string>()
  const gemeindenByArs = new Map<string, string>()

  for (const row of rows) {
    if (!/^\d+$/.test(row.satzart.trim())) continue
    const land = normalizeDigits(row.land, 2)
    const rb = normalizeDigits(row.rb, 1)
    const kreis = normalizeDigits(row.kreis, 2)
    const vb = normalizeDigits(row.vb, 4)
    const name = row.name.trim()
    const lineOrRow = row.lineOrRow
    switch (row.satzart.trim()) {
      case '10':
        setLookupValue(bundeslaender, land, name, 'bundesland', lineOrRow, onDuplicate)
        break
      case '20':
        setLookupValue(
          regierungsbezirke,
          `${land}${rb}`,
          name,
          'regierungsbezirk',
          lineOrRow,
          onDuplicate,
        )
        break
      case '40':
        setLookupValue(kreise, kreisKeyFromRow(row), name, 'kreis', lineOrRow, onDuplicate)
        break
      case '50':
        setLookupValue(
          gemeindeverbaende,
          `${land}${rb}${kreis}${vb}`,
          name,
          'gemeindeverband',
          lineOrRow,
          onDuplicate,
        )
        break
      case '60': {
        setLookupValue(
          gemeindenByArs,
          makeArs12(row),
          name,
          'gemeindeByArs',
          lineOrRow,
          onDuplicate,
        )
        setLookupValue(gemeindenByAgs, makeAgs8(row), name, 'gemeindeByAgs', lineOrRow, onDuplicate)
        break
      }
      default:
        break
    }
  }

  return {
    bundeslaender: sortedObject(bundeslaender),
    regierungsbezirke: sortedObject(regierungsbezirke),
    kreise: sortedObject(kreise),
    gemeindeverbaende: sortedObject(gemeindeverbaende),
    gemeindenByAgs: sortedObject(gemeindenByAgs),
    gemeindenByArs: sortedObject(gemeindenByArs),
  }
}
