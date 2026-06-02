import JSZip from 'jszip'
import { readSheet } from 'read-excel-file/node'
import type { Gv100AdRow } from './gv100AdRow.ts'
import { snapshotIsoFromGvAuszugSheetName } from './gv100Dates.ts'

/** Destatis GVAuszugQ data sheet: `Onlineprodukt_Gemeinden` + `DDMMYYYY`. */
export const DATA_SHEET_PATTERN = /^Onlineprodukt_Gemeinden(\d{8})$/

/** First spreadsheet row containing GV100 records (1-based; rows 1–6 are headers). */
export const DATA_START_ROW = 7

/**
 * GVAuszugQ column layout (0-based `read-excel-file` indices):
 * A Satzart | B Datum | C Land | D RB | E Kreis | F VB | G Gem | H Name
 * Column B is not mapped; snapshot date comes from the sheet name.
 */
const MIN_DATA_COLUMNS = 8

export type GvAuszugParsed = {
  archiveEntry: string
  snapshotDate: string
  rows: Gv100AdRow[]
}

function cellString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10).replace(/-/g, '')
  return String(value).trim()
}

export function rowFromExcelCells(
  cells: unknown[],
  lineOrRow: number,
  snapshotDateRaw: string,
): Gv100AdRow | null {
  if (cells.length < MIN_DATA_COLUMNS) return null
  const satzart = cellString(cells[0])
  if (satzart === '' || !/^\d+$/.test(satzart)) return null
  return {
    satzart,
    snapshotDateRaw,
    land: cellString(cells[2]),
    rb: cellString(cells[3]),
    kreis: cellString(cells[4]),
    vb: cellString(cells[5]),
    gem: cellString(cells[6]),
    name: cellString(cells[7]),
    lineOrRow,
  }
}

async function findDataSheetName(buffer: Buffer, xlsxBasename: string): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const workbookEntry = zip.file('xl/workbook.xml')
  if (!workbookEntry) {
    throw new Error(`XLSX missing xl/workbook.xml: ${xlsxBasename}`)
  }
  const workbookXml = await workbookEntry.async('string')
  const sheetNames = [...workbookXml.matchAll(/<sheet[^>]*\sname="([^"]+)"/g)].map(
    (match) => match[1] ?? '',
  )
  const dataSheetName = sheetNames.find((name) => DATA_SHEET_PATTERN.test(name))
  if (!dataSheetName) {
    throw new Error(`XLSX missing expected Onlineprodukt_Gemeinden sheet: ${xlsxBasename}`)
  }
  return dataSheetName
}

/** Parse Destatis GVAuszugQ quarterly Excel into normalized GV100 rows. */
export async function parseGvAuszugXlsx(
  buffer: Buffer,
  xlsxBasename: string,
): Promise<GvAuszugParsed> {
  const sheetName = await findDataSheetName(buffer, xlsxBasename)
  const snapshotDate = snapshotIsoFromGvAuszugSheetName(sheetName, DATA_SHEET_PATTERN)
  if (!snapshotDate) {
    throw new Error(`Could not parse snapshot date from sheet name: ${sheetName}`)
  }

  const [year, month, day] = snapshotDate.split('-')
  const snapshotDdMmYyyy = `${day}${month}${year}`

  const sheetData = await readSheet(buffer, sheetName)
  const rows: Gv100AdRow[] = []
  for (let i = DATA_START_ROW - 1; i < sheetData.length; i++) {
    const parsed = rowFromExcelCells(sheetData[i] ?? [], i + 1, snapshotDdMmYyyy)
    if (parsed) rows.push(parsed)
  }

  return {
    archiveEntry: `${xlsxBasename}#${sheetName}`,
    snapshotDate,
    rows,
  }
}

export function gvAuszugXlsxBasename(downloadUrl: string): string {
  const pathname = new URL(downloadUrl).pathname
  const parts = pathname.split('/')
  return parts[parts.length - 1] ?? 'AuszugGV.xlsx'
}
