/**
 * Symmetric difference area as % of official: (A_off + A_osm − 2×A_inter) / A_off × 100.
 */
export function computeSymmetricDiffPct(
  officialAreaM2: number,
  osmAreaM2: number,
  intersectionAreaM2: number,
): number {
  const symDiffArea = officialAreaM2 + osmAreaM2 - 2 * intersectionAreaM2
  return officialAreaM2 > 0 ? (symDiffArea / officialAreaM2) * 100 : 0
}
