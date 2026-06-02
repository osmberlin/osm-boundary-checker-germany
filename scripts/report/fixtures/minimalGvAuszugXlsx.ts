import JSZip from 'jszip'
import type { Gv100AdRow } from '../gv100AdRow.ts'

const SHEET_NAME = 'Onlineprodukt_Gemeinden30062026'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function columnRef(columnIndex: number, rowNumber: number): string {
  return `${String.fromCharCode(65 + columnIndex)}${rowNumber}`
}

function inlineCell(columnIndex: number, rowNumber: number, value: string | number): string {
  const ref = columnRef(columnIndex, rowNumber)
  if (typeof value === 'number') {
    return `<c r="${ref}"><v>${value}</v></c>`
  }
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`
}

function rowXml(rowNumber: number, values: (string | number)[]): string {
  const cells = values
    .map((value, columnIndex) => inlineCell(columnIndex, rowNumber, value))
    .join('')
  return `<row r="${rowNumber}">${cells}</row>`
}

/** GV100 row as GVAuszugQ Excel columns A–H (B = snapshot date, unused by parser). */
export function gvRowToExcelValues(row: Gv100AdRow): (string | number)[] {
  return [row.satzart, row.snapshotDateRaw, row.land, row.rb, row.kreis, row.vb, row.gem, row.name]
}

/** Minimal valid `.xlsx` for `parseGvAuszugXlsx` tests (no Destatis download). */
export async function buildMinimalGvAuszugXlsx(dataRows: Gv100AdRow[]): Promise<Buffer> {
  const sheetRows: string[] = []
  for (let headerRow = 1; headerRow < 7; headerRow++) {
    sheetRows.push(`<row r="${headerRow}"/>`)
  }
  for (let i = 0; i < dataRows.length; i++) {
    sheetRows.push(rowXml(7 + i, gvRowToExcelValues(dataRows[i]!)))
  }

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    ${sheetRows.join('\n    ')}
  </sheetData>
</worksheet>`

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(SHEET_NAME)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

  const zip = new JSZip()
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
  )
  zip.folder('_rels')!.file(
    '.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  )
  const xl = zip.folder('xl')!
  xl.file('workbook.xml', workbookXml)
  xl.folder('_rels')!.file(
    'workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  )
  xl.folder('worksheets')!.file('sheet1.xml', sheetXml)

  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }))
}

export const MINIMAL_GV_AUSZUG_SHEET_NAME = SHEET_NAME
