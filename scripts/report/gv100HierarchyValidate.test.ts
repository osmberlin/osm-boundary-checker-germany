import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildMinimalGvAuszugXlsx } from './fixtures/minimalGvAuszugXlsx.ts'
import type { Gv100AdRow } from './gv100AdRow.ts'
import { VALID_LAND_CODES } from './gv100AdRow.ts'
import { validateGvHierarchy } from './gv100HierarchyValidate.ts'
import { rowsToLookupMaps, type LookupDuplicateWarning } from './gv100LookupMaps.ts'
import { parseGv100AdTxtRows } from './parseGv100AdTxt.ts'
import { parseGvAuszugXlsx, rowFromExcelCells } from './parseGvAuszugXlsx.ts'

function bundeslandRows(): Gv100AdRow[] {
  const names: Record<string, string> = {
    '01': 'Schleswig-Holstein',
    '02': 'Hamburg',
    '03': 'Niedersachsen',
    '04': 'Bremen',
    '05': 'Nordrhein-Westfalen',
    '06': 'Hessen',
    '07': 'Rheinland-Pfalz',
    '08': 'Baden-Württemberg',
    '09': 'Bayern',
    '10': 'Saarland',
    '11': 'Berlin',
    '12': 'Brandenburg',
    '13': 'Mecklenburg-Vorpommern',
    '14': 'Sachsen',
    '15': 'Sachsen-Anhalt',
    '16': 'Thüringen',
  }
  return [...VALID_LAND_CODES].map((land, index) => ({
    satzart: '10',
    snapshotDateRaw: '20260331',
    land,
    rb: '0',
    kreis: '00',
    vb: '0000',
    gem: '000',
    name: names[land] ?? land,
    lineOrRow: index + 1,
  }))
}

function minimalValidHierarchy(): Gv100AdRow[] {
  return [
    ...bundeslandRows(),
    {
      satzart: '40',
      snapshotDateRaw: '20260331',
      land: '12',
      rb: '0',
      kreis: '51',
      vb: '0000',
      gem: '000',
      name: 'Brandenburg an der Havel, Stadt',
      lineOrRow: 100,
    },
    {
      satzart: '60',
      snapshotDateRaw: '20260331',
      land: '12',
      rb: '0',
      kreis: '51',
      vb: '0000',
      gem: '000',
      name: 'Brandenburg an der Havel, Stadt',
      lineOrRow: 101,
    },
    {
      satzart: '40',
      snapshotDateRaw: '30062026',
      land: '04',
      rb: '0',
      kreis: '12',
      vb: '0000',
      gem: '000',
      name: 'Bremerhaven, Stadt',
      lineOrRow: 102,
    },
    {
      satzart: '60',
      snapshotDateRaw: '30062026',
      land: '04',
      rb: '0',
      kreis: '12',
      vb: '0000',
      gem: '000',
      name: 'Bremerhaven, Stadt',
      lineOrRow: 103,
    },
  ]
}

/** Patterns from corrupt GV100AD Q2 2026 TXT (fixed-width field shift). */
function q2TxtCorruptionRows(): Gv100AdRow[] {
  const rows = bundeslandRows().filter((row) => row.land !== '12')
  rows.push({
    satzart: '40',
    snapshotDateRaw: '10202606',
    land: '30',
    rb: '1',
    kreis: '02',
    vb: '0000',
    gem: '000',
    name: 'Brandenburg',
    lineOrRow: 50,
  })
  rows.push({
    satzart: '64',
    snapshotDateRaw: '20260630',
    land: '04',
    rb: '0',
    kreis: '12',
    vb: '0000',
    gem: '000',
    name: 'Bremerhaven, Stadt',
    lineOrRow: 51,
  })
  return rows
}

describe('validateGvHierarchy', () => {
  test('accepts a complete minimal hierarchy', () => {
    const result = validateGvHierarchy(minimalValidHierarchy())
    expect(result.ok).toBe(true)
  })

  test('rejects Q2 TXT corruption patterns', () => {
    const result = validateGvHierarchy(q2TxtCorruptionRows())
    expect(result.ok).toBe(false)
    if (result.ok) return
    const rules = new Set(result.errors.map((e) => e.rule))
    expect(rules.has('missing_bundesland')).toBe(true)
    expect(rules.has('unexpected_satzart')).toBe(true)
    expect(rules.has('invalid_land_code')).toBe(true)
  })
})

describe('rowsToLookupMaps', () => {
  test('maps all 16 Bundesländer from valid rows', () => {
    const maps = rowsToLookupMaps(minimalValidHierarchy())
    expect(Object.keys(maps.bundeslaender)).toHaveLength(16)
    expect(maps.bundeslaender['12']).toBe('Brandenburg')
    expect(maps.kreise['12051']).toBe('Brandenburg an der Havel, Stadt')
    expect(maps.kreise['04012']).toBe('Bremerhaven, Stadt')
  })

  test('reports duplicate keys via callback', () => {
    const duplicates: LookupDuplicateWarning[] = []
    const rows: Gv100AdRow[] = [
      {
        satzart: '10',
        snapshotDateRaw: '20260331',
        land: '12',
        rb: '0',
        kreis: '00',
        vb: '0000',
        gem: '000',
        name: 'Brandenburg',
        lineOrRow: 1,
      },
      {
        satzart: '10',
        snapshotDateRaw: '20260331',
        land: '12',
        rb: '0',
        kreis: '00',
        vb: '0000',
        gem: '000',
        name: 'Brandenburg (duplicate)',
        lineOrRow: 2,
      },
    ]
    const maps = rowsToLookupMaps(rows, (warning) => duplicates.push(warning))
    expect(maps.bundeslaender['12']).toBe('Brandenburg')
    expect(duplicates).toHaveLength(1)
    expect(duplicates[0]?.scope).toBe('bundesland')
  })
})

describe('rowFromExcelCells', () => {
  test('returns null when required columns are missing', () => {
    expect(rowFromExcelCells(['10'], 7, '30062026')).toBeNull()
  })
})

describe('parseGv100AdTxtRows', () => {
  const corruptFixturePath = join(
    import.meta.dir,
    'fixtures',
    'GV100AD_30062026-corrupt-snippet.txt',
  )

  test.skipIf(!existsSync(corruptFixturePath))('detects corrupt Q2 TXT when validated', () => {
    const rows = parseGv100AdTxtRows(readFileSync(corruptFixturePath))
    const result = validateGvHierarchy(rows)
    expect(result.ok).toBe(false)
  })
})

describe('parseGvAuszugXlsx', () => {
  test('parses programmatic minimal workbook with 16 Bundesländer', async () => {
    const buffer = await buildMinimalGvAuszugXlsx(minimalValidHierarchy())
    const parsed = await parseGvAuszugXlsx(buffer, 'AuszugGV2QAktuell.xlsx')
    expect(parsed.snapshotDate).toBe('2026-06-30')
    const validation = validateGvHierarchy(parsed.rows)
    expect(validation.ok).toBe(true)
    const maps = rowsToLookupMaps(parsed.rows)
    expect(Object.keys(maps.bundeslaender)).toHaveLength(16)
    expect(maps.bundeslaender['12']).toBe('Brandenburg')
    expect(maps.kreise['04012']).toBe('Bremerhaven, Stadt')
  })

  const officialFixturePath = join(import.meta.dir, 'fixtures', 'AuszugGV2QAktuell.xlsx')

  test.skipIf(!existsSync(officialFixturePath))(
    'parses official Q2 Excel when fixture is present',
    async () => {
      const buffer = readFileSync(officialFixturePath)
      const parsed = await parseGvAuszugXlsx(buffer, 'AuszugGV2QAktuell.xlsx')
      expect(parsed.snapshotDate).toBe('2026-06-30')
      expect(validateGvHierarchy(parsed.rows).ok).toBe(true)
      expect(Object.keys(rowsToLookupMaps(parsed.rows).bundeslaender)).toHaveLength(16)
    },
  )
})
