import type { Gv100AdRow } from './gv100AdRow.ts'
import { makeArs12 } from './gv100AdRow.ts'

/** Destatis GVAuszugQ extra columns bound by header text (not letter index). */
export type GvAuszugMerkmaleColumns = {
  areaKm2?: number
  populationTotal?: number
  populationMale?: number
}

export type GvAuszugMerkmale = {
  columns: GvAuszugMerkmaleColumns
  headerLabels: {
    areaKm2?: string
    populationTotal?: string
    populationMale?: string
  }
  /** Fortschreibung Stichtag (ISO date), from Fußnote/header — not Gebietsstand. */
  populationDate?: string
  headerDump: { row: number; cells: string[] }[]
}

export type GemeindeAttribute = {
  areaKm2?: number
  populationTotal?: number
  populationMale?: number
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  return String(value).trim()
}

function normalizeHeader(text: string): string {
  return text
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .replaceAll('²', '2')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Parse `31.12.2024` / `31.12.2024 (Jahr)` from Destatis header/footnote cells. */
export function parseGermanDotDate(raw: string): string | undefined {
  const match = /(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(raw)
  if (!match) return undefined
  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Quarterly Gebietsstand is often 31.03/30.06/30.09; Destatis Fortschreibung is 31.12.
 * If the snapshot itself is 31.12., use it; otherwise previous 31.12.
 */
export function populationDateFromGebietsstand(snapshotIso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(snapshotIso.trim())
  if (!match) return snapshotIso
  const year = Number(match[1])
  const month = match[2]
  const day = match[3]
  if (month === '12' && day === '31') return snapshotIso
  return `${year - 1}-12-31`
}

export function parseExcelNumericCell(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = cellString(value).replace(/\s/g, '').replace(',', '.')
  if (text === '') return undefined
  const n = Number(text)
  return Number.isFinite(n) ? n : undefined
}

function roundKm2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Scan GVAuszugQ header rows 1–6 (0-based 0–5) for Fläche / Bevölkerung columns. */
export function parseGvAuszugMerkmaleFromHeaderRows(
  headerRows: unknown[][],
  snapshotIso: string,
): GvAuszugMerkmale {
  const headerDump = headerRows.map((row, index) => ({
    row: index + 1,
    cells: (row ?? []).map((cell) => cellString(cell)),
  }))
  const colCount = Math.max(0, ...headerRows.map((row) => row.length))
  const columns: GvAuszugMerkmaleColumns = {}
  const headerLabels: GvAuszugMerkmale['headerLabels'] = {}

  for (let col = 0; col < colCount; col++) {
    const texts = headerRows.map((row) => cellString(row?.[col])).filter((text) => text !== '')
    const joined = texts.join(' | ')
    const normalized = normalizeHeader(joined)
    if (normalized === '') continue

    if (columns.areaKm2 === undefined && /flaeche/.test(normalized) && /km\s*2/.test(normalized)) {
      columns.areaKm2 = col
      headerLabels.areaKm2 = joined
    }
    if (
      columns.populationTotal === undefined &&
      /insgesamt/.test(normalized) &&
      (/bevoelkerung/.test(normalized) || /zensus/.test(normalized))
    ) {
      columns.populationTotal = col
      headerLabels.populationTotal = joined
    }
    if (columns.populationMale === undefined && /maennlich/.test(normalized)) {
      columns.populationMale = col
      headerLabels.populationMale = joined
    }
  }

  let populationDate: string | undefined
  const dateCols = [columns.populationTotal, columns.areaKm2].filter(
    (col): col is number => col !== undefined,
  )
  for (const col of dateCols) {
    for (const row of headerRows) {
      populationDate = parseGermanDotDate(cellString(row?.[col]))
      if (populationDate) break
    }
    if (populationDate) break
  }
  if (!populationDate) {
    for (const row of headerRows) {
      for (const cell of row ?? []) {
        populationDate = parseGermanDotDate(cellString(cell))
        if (populationDate) break
      }
      if (populationDate) break
    }
  }
  if (!populationDate) populationDate = populationDateFromGebietsstand(snapshotIso)

  return { columns, headerLabels, populationDate, headerDump }
}

export function applyExcelMerkmaleToRow(
  row: Gv100AdRow,
  cells: unknown[],
  merkmale: GvAuszugMerkmaleColumns,
): Gv100AdRow {
  if (row.satzart.trim() !== '60') return row
  const areaRaw =
    merkmale.areaKm2 !== undefined ? parseExcelNumericCell(cells[merkmale.areaKm2]) : undefined
  const popRaw =
    merkmale.populationTotal !== undefined
      ? parseExcelNumericCell(cells[merkmale.populationTotal])
      : undefined
  const maleRaw =
    merkmale.populationMale !== undefined
      ? parseExcelNumericCell(cells[merkmale.populationMale])
      : undefined
  return {
    ...row,
    ...(areaRaw !== undefined ? { areaKm2: roundKm2(areaRaw) } : {}),
    ...(popRaw !== undefined ? { populationTotal: Math.round(popRaw) } : {}),
    ...(maleRaw !== undefined ? { populationMale: Math.round(maleRaw) } : {}),
  }
}

/**
 * GV100AD satzart 60 tail (220-char records). After the 50-char name at 22–72:
 * skip 50, textkennzeichen 2, skip 4, area 11 (km²×100), population_total 11, population_male 11.
 */
export function parseGv100AdSatzart60Tail(
  line: string,
): Pick<Gv100AdRow, 'areaKm2' | 'populationTotal' | 'populationMale'> {
  if (line.length < 161) return {}
  const areaRaw = line.slice(128, 139)
  const popRaw = line.slice(139, 150)
  const maleRaw = line.slice(150, 161)
  const areaHundredths = parseFixedWidthUnsignedInt(areaRaw)
  const populationTotal = parseFixedWidthUnsignedInt(popRaw)
  const populationMale = parseFixedWidthUnsignedInt(maleRaw)
  return {
    ...(areaHundredths !== undefined ? { areaKm2: roundKm2(areaHundredths / 100) } : {}),
    ...(populationTotal !== undefined ? { populationTotal } : {}),
    ...(populationMale !== undefined ? { populationMale } : {}),
  }
}

function parseFixedWidthUnsignedInt(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed === '' || !/^\d+$/.test(trimmed)) return undefined
  return Number(trimmed)
}

export function rowsToGemeindeAttributes(rows: Gv100AdRow[]): Record<string, GemeindeAttribute> {
  const out = new Map<string, GemeindeAttribute>()
  for (const row of rows) {
    if (row.satzart.trim() !== '60') continue
    if (row.areaKm2 === undefined && row.populationTotal === undefined) continue
    const ars = makeArs12(row)
    const attr: GemeindeAttribute = {}
    if (row.areaKm2 !== undefined) attr.areaKm2 = row.areaKm2
    if (row.populationTotal !== undefined) attr.populationTotal = row.populationTotal
    if (row.populationMale !== undefined) attr.populationMale = row.populationMale
    out.set(ars, attr)
  }
  return Object.fromEntries(
    [...out.entries()].sort(([a], [b]) => a.localeCompare(b, 'de', { numeric: true })),
  )
}
