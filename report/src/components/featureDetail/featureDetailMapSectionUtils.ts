import type { ReportRow } from '../../types/report'

export const DETAIL_MAP_MAX_BOUNDS_SCALE = 4

export function toDetailMapMaxBounds(
  bbox: [number, number, number, number] | null,
): [[number, number], [number, number]] | undefined {
  if (!bbox) return undefined
  const [west, south, east, north] = bbox
  if (!(west < east && south < north)) return undefined

  const paddingRatio = (DETAIL_MAP_MAX_BOUNDS_SCALE - 1) / 2
  const lonPad = (east - west) * paddingRatio
  const latPad = (north - south) * paddingRatio
  const clampedWest = Math.max(-180, west - lonPad)
  const clampedSouth = Math.max(-85, south - latPad)
  const clampedEast = Math.min(180, east + lonPad)
  const clampedNorth = Math.min(85, north + latPad)
  if (!(clampedWest < clampedEast && clampedSouth < clampedNorth)) return undefined

  return [
    [clampedWest, clampedSouth],
    [clampedEast, clampedNorth],
  ]
}

export function symmetricDiffAreaM2(m: NonNullable<ReportRow['metrics']>): number {
  return m.officialAreaM2 * (m.symmetricDiffPct / 100)
}

export type MapLayerControls = {
  showOfficial: boolean
  setShowOfficial: (v: boolean) => void
  showOsm: boolean
  setShowOsm: (v: boolean) => void
  showDiff: boolean
  setShowDiff: (v: boolean) => void
}
