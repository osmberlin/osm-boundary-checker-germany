import { parseDdMmYyyy, utcDateFromParts } from './gv100Dates.ts'

/** Normalized GV100AD / GVAuszug workbook row (fixed-width TXT or Excel columns). */
export type Gv100AdRow = {
  satzart: string
  snapshotDateRaw: string
  land: string
  rb: string
  kreis: string
  vb: string
  gem: string
  name: string
  /** 1-based row index for error reporting (Excel/TXT line number). */
  lineOrRow: number
}

/** Satzart 30 (mittlere Verwaltungsebene) is validated but not mapped to lookup tables. */
export const ALLOWED_SATZART = new Set(['10', '20', '30', '40', '50', '60'])

export const VALID_LAND_CODES = new Set(
  Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0')),
)

export function normalizeDigits(value: string, length: number): string {
  const digits = value.replace(/\D/g, '')
  if (digits === '') return ''.padStart(length, '0')
  return digits.padStart(length, '0').slice(-length)
}

export function makeArs12(row: Pick<Gv100AdRow, 'land' | 'rb' | 'kreis' | 'vb' | 'gem'>): string {
  return [
    normalizeDigits(row.land, 2),
    normalizeDigits(row.rb, 1),
    normalizeDigits(row.kreis, 2),
    normalizeDigits(row.vb, 4),
    normalizeDigits(row.gem, 3),
  ].join('')
}

export function makeAgs8(row: Pick<Gv100AdRow, 'land' | 'rb' | 'kreis' | 'gem'>): string {
  return [
    normalizeDigits(row.land, 2),
    normalizeDigits(row.rb, 1),
    normalizeDigits(row.kreis, 2),
    normalizeDigits(row.gem, 3),
  ].join('')
}

export function kreisKeyFromRow(row: Pick<Gv100AdRow, 'land' | 'rb' | 'kreis'>): string {
  return [
    normalizeDigits(row.land, 2),
    normalizeDigits(row.rb, 1),
    normalizeDigits(row.kreis, 2),
  ].join('')
}

export function isZeroField(value: string, length: number): boolean {
  return normalizeDigits(value, length) === '0'.repeat(length)
}

export function parseSnapshotDateRaw(raw: string): boolean {
  const trimmed = raw.trim()
  if (trimmed === '') return true
  if (!/^\d{8}$/.test(trimmed)) return false

  const yearFirst = Number(trimmed.slice(0, 4))
  if (yearFirst >= 1900 && yearFirst <= 2100) {
    const month = Number(trimmed.slice(4, 6))
    const day = Number(trimmed.slice(6, 8))
    return utcDateFromParts(yearFirst, month, day) !== null
  }

  return parseDdMmYyyy(trimmed) !== null
}
