/** German locale: thousands separators, comma decimals */

const LOCALE = 'de-DE'

export const EM_DASH = '—'

const nf0 = new Intl.NumberFormat(LOCALE, {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

const nf2 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const nf1 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const nf3 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
})

const nfM0 = new Intl.NumberFormat(LOCALE, {
  style: 'unit',
  unit: 'meter',
  unitDisplay: 'short',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const nfM1 = new Intl.NumberFormat(LOCALE, {
  style: 'unit',
  unit: 'meter',
  unitDisplay: 'short',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const nfM2 = new Intl.NumberFormat(LOCALE, {
  style: 'unit',
  unit: 'meter',
  unitDisplay: 'short',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatDeInteger(n: number): string {
  return nf0.format(n)
}

/** Fixed decimal places for compact KPI/table outputs. */
export function formatDeFixed(n: number, fractionDigits: 0 | 1 | 2 | 3 | 4): string {
  if (fractionDigits === 0) return nf0.format(n)
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(n)
}

/** IoU ∈ [0,1], up to three decimals. */
export function formatDeIou(n: number): string {
  return nf3.format(n)
}

/**
 * Percentage points (0–100 scale) + %.
 * - exactly 0: `0 %` (no fractional noise)
 * - |n| > 10: no fractional digits (rounded integer)
 * - |n| ≤ 10 and two-decimal formatting of |n| is still `0`: up to three fractional digits (nearly-zero)
 * - otherwise |n| ≤ 10: up to two fractional digits (previous behaviour)
 */
export function formatDePercentPoints(n: number): string {
  if (n === 0) {
    return `0\u00a0%`
  }
  if (Math.abs(n) > 10) {
    return `${nf0.format(Math.round(n))}\u00a0%`
  }
  const zeroAtTwoDecimals = formatDeFixed(0, 2)
  if (formatDeFixed(Math.abs(n), 2) === zeroAtTwoDecimals) {
    return `${formatDeFixed(n, 3)}\u00a0%`
  }
  return `${formatDeFixed(n, 2)}\u00a0%`
}

/** Length in metres with tiered precision:
 * - < 1 m: 2 decimals
 * - 1 to < 10 m: 1 decimal
 * - >= 10 m: no decimals
 */
export function formatDeMeters(n: number): string {
  const abs = Math.abs(n)
  if (abs < 1) return nfM2.format(n)
  if (abs < 10) return nfM1.format(n)
  return nfM0.format(n)
}

/** Area in m², integer, unit after value (manual — `square-meter` unit support varies by runtime) */
export function formatDeSquareMeters(n: number): string {
  return `${nf0.format(n)}\u00a0m²`
}

/**
 * Area from m² → km² with compact thresholds:
 * - < 0.1 km²: show as integer m²
 * - < 1 km²: show as km² with 2 decimals
 * - < 10 km²: show as km² with 1 decimal
 * - >= 10 km²: show as integer km²
 */
export function formatDeSquareKilometersFromM2(m2: number): string {
  const km2 = m2 / 1_000_000
  const absKm2 = Math.abs(km2)

  if (absKm2 < 0.1) {
    return formatDeSquareMeters(m2)
  }
  if (absKm2 < 1) {
    return `${nf2.format(km2)}\u00a0km²`
  }
  if (absKm2 < 10) {
    return `${nf1.format(km2)}\u00a0km²`
  }
  return `${nf0.format(km2)}\u00a0km²`
}

export function formatDeOrDash(
  value: number | null | undefined,
  fmt: (n: number) => string,
): string {
  if (value === null || value === undefined) return EM_DASH
  if (Number.isNaN(value)) return EM_DASH
  return fmt(value)
}
