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

const nf4 = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

const nfM = new Intl.NumberFormat(LOCALE, {
  style: 'unit',
  unit: 'meter',
  unitDisplay: 'short',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatDeInteger(n: number): string {
  return nf0.format(n)
}

/** Fixed decimal places (e.g. IoU) */
export function formatDeFixed(n: number, fractionDigits: 0 | 2 | 4): string {
  if (fractionDigits === 0) return nf0.format(n)
  if (fractionDigits === 2) return nf2.format(n)
  return nf4.format(n)
}

/** IoU ∈ [0,1], four decimals */
export function formatDeIou(n: number): string {
  return nf4.format(n)
}

/** Percentage points (value already 0–100 scale), two decimals + % */
export function formatDePercentPoints(n: number): string {
  return `${nf2.format(n)}\u00a0%`
}

/** Length in metres, two decimals, unit after value */
export function formatDeMeters(n: number): string {
  return nfM.format(n)
}

/** Area in m², integer, unit after value (manual — `square-meter` unit support varies by runtime) */
export function formatDeSquareMeters(n: number): string {
  return `${nf0.format(n)}\u00a0m²`
}

/** Area from m² → km², integer km², German grouping */
export function formatDeSquareKilometersFromM2(m2: number): string {
  const km2 = m2 / 1_000_000
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
