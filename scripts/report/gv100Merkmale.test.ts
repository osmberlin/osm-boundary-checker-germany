import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { sumGemeindeAttributesForPrefix } from '../shared/germanKeyGemeindeSum.ts'
import {
  parseGermanDotDate,
  parseGv100AdSatzart60Tail,
  parseGvAuszugMerkmaleFromHeaderRows,
  populationDateFromGebietsstand,
  rowsToGemeindeAttributes,
} from './gv100Merkmale.ts'
import { parseGv100AdTxtRows } from './parseGv100AdTxt.ts'

describe('gv100Merkmale', () => {
  test('parses satzart-60 tail from Brandenburg an der Havel fixture line', () => {
    const path = join(import.meta.dir, 'fixtures', 'GV100AD_30062026-corrupt-snippet.txt')
    const rows = parseGv100AdTxtRows(readFileSync(path))
    const gemeinde = rows.find(
      (row) => row.satzart === '60' && row.name.includes('Brandenburg an der Havel'),
    )
    expect(gemeinde).toBeDefined()
    expect(gemeinde?.areaKm2).toBe(229.73)
    expect(gemeinde?.populationTotal).toBe(74113)
    expect(gemeinde?.populationMale).toBe(36154)
  })

  test('parseGv100AdSatzart60Tail reads 11-digit km²×100 and EWZ fields', () => {
    const name = 'Brandenburg an der Havel, Stadt'.padEnd(50, ' ')
    const skip50 = ' '.repeat(50)
    const line = `6020260630120510000000${name}${skip50}61    000000229730000007411300000036154`
    expect(parseGv100AdSatzart60Tail(line)).toEqual({
      areaKm2: 229.73,
      populationTotal: 74113,
      populationMale: 36154,
    })
  })

  test('binds Destatis header text to Fläche / Bevölkerung columns', () => {
    const merkmale = parseGvAuszugMerkmaleFromHeaderRows(
      [
        ['Gemeinden in Deutschland nach Fläche, Bevölkerung'],
        [],
        [
          'Satzart',
          'Textkennzeichen',
          'ARS',
          '',
          '',
          '',
          '',
          'Gemeindename',
          'Fläche km2 1)',
          'Bevölkerung auf Grundlage des Zensus 2022',
        ],
        ['', '', 'Land', 'RB', 'Kreis', 'VB', 'Gem', '', '', 'insgesamt', 'männlich'],
        [
          '',
          '',
          'Gebietsstand am 30.06.2026',
          '',
          '',
          '',
          '',
          '',
          '31.12.2024 (Jahr)',
          '31.12.2024 (Jahr)',
        ],
      ],
      '2026-06-30',
    )
    expect(merkmale.columns.areaKm2).toBe(8)
    expect(merkmale.columns.populationTotal).toBe(9)
    expect(merkmale.columns.populationMale).toBe(10)
    expect(merkmale.populationDate).toBe('2024-12-31')
  })

  test('falls back Fortschreibung date from quarterly Gebietsstand', () => {
    expect(populationDateFromGebietsstand('2026-06-30')).toBe('2025-12-31')
    expect(populationDateFromGebietsstand('2024-12-31')).toBe('2024-12-31')
    expect(parseGermanDotDate('31.12.2024 (Jahr)')).toBe('2024-12-31')
  })

  test('sums Gemeinde EWZ to Land / Kreis prefixes', () => {
    const attrs = rowsToGemeindeAttributes([
      {
        satzart: '60',
        snapshotDateRaw: '20240630',
        land: '12',
        rb: '0',
        kreis: '51',
        vb: '0000',
        gem: '000',
        name: 'A',
        lineOrRow: 1,
        areaKm2: 100.5,
        populationTotal: 1000,
      },
      {
        satzart: '60',
        snapshotDateRaw: '20240630',
        land: '12',
        rb: '0',
        kreis: '52',
        vb: '0000',
        gem: '001',
        name: 'B',
        lineOrRow: 2,
        areaKm2: 20.25,
        populationTotal: 250,
      },
    ])
    expect(sumGemeindeAttributesForPrefix(attrs, '12')).toEqual({
      areaKm2: 120.75,
      populationTotal: 1250,
    })
    expect(sumGemeindeAttributesForPrefix(attrs, '12051')?.populationTotal).toBe(1000)
    expect(sumGemeindeAttributesForPrefix(attrs, '01')).toBeNull()
  })
})
