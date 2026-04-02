/**
 * Absolute relative area difference vs official: |A_osm − A_official| / A_official × 100.
 */
export function computeAreaDeltaPct(officialAreaM2: number, osmAreaM2: number): number {
  return officialAreaM2 > 0 ? (Math.abs(officialAreaM2 - osmAreaM2) / officialAreaM2) * 100 : 0
}
