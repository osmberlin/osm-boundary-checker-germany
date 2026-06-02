import {
  ALLOWED_SATZART,
  type Gv100AdRow,
  makeAgs8,
  makeArs12,
  normalizeDigits,
  parseSnapshotDateRaw,
  VALID_LAND_CODES,
  isZeroField,
} from './gv100AdRow.ts'

export type Gv100ValidationError = {
  satzart: string
  land: string
  lineOrRow: number
  rule: string
  message: string
}

export type Gv100ValidationResult = { ok: true } | { ok: false; errors: Gv100ValidationError[] }

function err(row: Gv100AdRow, rule: string, message: string): Gv100ValidationError {
  return {
    satzart: row.satzart.trim(),
    land: normalizeDigits(row.land, 2),
    lineOrRow: row.lineOrRow,
    rule,
    message,
  }
}

function validateRowFields(row: Gv100AdRow): Gv100ValidationError[] {
  const errors: Gv100ValidationError[] = []
  const sa = row.satzart.trim()

  if (!/^\d+$/.test(sa)) return errors

  if (!ALLOWED_SATZART.has(sa)) {
    errors.push(err(row, 'unexpected_satzart', `unexpected satzart ${sa}`))
    return errors
  }

  if (row.snapshotDateRaw.trim() !== '' && !parseSnapshotDateRaw(row.snapshotDateRaw)) {
    errors.push(
      err(row, 'invalid_snapshot_date', `invalid snapshot date ${row.snapshotDateRaw.trim()}`),
    )
  }

  const land = normalizeDigits(row.land, 2)
  if (land !== '00' && !VALID_LAND_CODES.has(land)) {
    errors.push(err(row, 'invalid_land_code', `invalid land code ${land}`))
  }

  switch (sa) {
    case '10':
      if (!isZeroField(row.rb, 1))
        errors.push(err(row, 'satzart10_rb_zero', 'satzart 10 requires RB=0'))
      if (!isZeroField(row.kreis, 2))
        errors.push(err(row, 'satzart10_kreis_zero', 'satzart 10 requires Kreis=00'))
      if (!isZeroField(row.vb, 4))
        errors.push(err(row, 'satzart10_vb_zero', 'satzart 10 requires VB=0000'))
      if (!isZeroField(row.gem, 3))
        errors.push(err(row, 'satzart10_gem_zero', 'satzart 10 requires Gem=000'))
      break
    case '20':
      if (!isZeroField(row.kreis, 2))
        errors.push(err(row, 'satzart20_kreis_zero', 'satzart 20 requires Kreis=00'))
      if (!isZeroField(row.vb, 4))
        errors.push(err(row, 'satzart20_vb_zero', 'satzart 20 requires VB=0000'))
      if (!isZeroField(row.gem, 3))
        errors.push(err(row, 'satzart20_gem_zero', 'satzart 20 requires Gem=000'))
      break
    case '30':
      // Mittlere Verwaltungsebene — validated structurally but not mapped to lookup tables.
      if (!isZeroField(row.vb, 4))
        errors.push(err(row, 'satzart30_vb_zero', 'satzart 30 requires VB=0000'))
      if (!isZeroField(row.gem, 3))
        errors.push(err(row, 'satzart30_gem_zero', 'satzart 30 requires Gem=000'))
      break
    case '40':
      if (!isZeroField(row.vb, 4))
        errors.push(err(row, 'satzart40_vb_zero', 'satzart 40 requires VB=0000'))
      if (!isZeroField(row.gem, 3))
        errors.push(err(row, 'satzart40_gem_zero', 'satzart 40 requires Gem=000'))
      break
    case '50':
      if (!isZeroField(row.gem, 3))
        errors.push(err(row, 'satzart50_gem_zero', 'satzart 50 requires Gem=000'))
      break
    case '60': {
      const ags = makeAgs8(row)
      const ars = makeArs12(row)
      if (ags.length !== 8) {
        errors.push(err(row, 'gemeinde_invalid_ags', `satzart 60 produced invalid AGS ${ags}`))
      }
      if (ars.length !== 12) {
        errors.push(err(row, 'gemeinde_invalid_ars', `satzart 60 produced invalid ARS ${ars}`))
      }
      break
    }
    default:
      break
  }

  return errors
}

/** Structural validation of GV100AD / GVAuszug hierarchy rows (no name sniffing). */
export function validateGvHierarchy(rows: Gv100AdRow[]): Gv100ValidationResult {
  const errors: Gv100ValidationError[] = []

  for (const row of rows) {
    errors.push(...validateRowFields(row))
  }

  const bundeslandLands = new Set<string>()
  for (const row of rows) {
    if (row.satzart.trim() !== '10') continue
    const land = normalizeDigits(row.land, 2)
    if (VALID_LAND_CODES.has(land)) bundeslandLands.add(land)
  }

  if (bundeslandLands.size !== 16) {
    errors.push({
      satzart: '10',
      land: '',
      lineOrRow: 0,
      rule: 'bundesland_count',
      message: `expected 16 satzart-10 Bundesländer, found ${bundeslandLands.size}`,
    })
  }

  for (const code of VALID_LAND_CODES) {
    if (!bundeslandLands.has(code)) {
      errors.push({
        satzart: '10',
        land: code,
        lineOrRow: 0,
        rule: 'missing_bundesland',
        message: `missing satzart-10 entry for land ${code}`,
      })
    }
  }

  for (const row of rows) {
    const sa = row.satzart.trim()
    if (!['40', '50', '60'].includes(sa)) continue
    const land = normalizeDigits(row.land, 2)
    if (land === '00') continue
    if (!bundeslandLands.has(land)) {
      errors.push(
        err(
          row,
          'orphan_land_reference',
          `satzart ${sa} references land ${land} without satzart-10 parent`,
        ),
      )
    }
  }

  for (const row of rows) {
    if (row.satzart.trim() !== '40') continue
    const land = normalizeDigits(row.land, 2)
    if (!VALID_LAND_CODES.has(land)) {
      errors.push(err(row, 'kreis_invalid_land', `satzart 40 has invalid land prefix ${land}`))
    }
  }

  for (const row of rows) {
    if (row.satzart.trim() !== '60') continue
    const land = normalizeDigits(row.land, 2)
    if (!bundeslandLands.has(land)) {
      errors.push(
        err(
          row,
          'gemeinde_orphan_land',
          `satzart 60 references land ${land} without satzart-10 parent`,
        ),
      )
    }
  }

  if (errors.length === 0) return { ok: true }
  return { ok: false, errors }
}

export function formatValidationErrors(errors: Gv100ValidationError[], limit = 5): string {
  return errors
    .slice(0, limit)
    .map((e) => `${e.rule} at row ${e.lineOrRow}: ${e.message}`)
    .join('; ')
}
