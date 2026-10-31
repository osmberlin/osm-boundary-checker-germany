import type { ComparisonForReport } from '../types/report'

/**
 * Digits-only PLZ; last digit → stable bucket 0–9 for map paint.
 * Neighboring PLZs with the same last digit share a color (acceptable v1 tradeoff).
 */
export function addrPostcodeColorIndex(postcode: string): number {
  const digits = postcode.replace(/\D/g, '')
  if (digits.length === 0) return 0
  return Number(digits[digits.length - 1]!) % 10
}

export function isPlzDatasetForReport(data: ComparisonForReport): boolean {
  return data.idNormalizationPreset === 'plz-5' || data.overpassBoundaryTag === 'postal_code'
}
