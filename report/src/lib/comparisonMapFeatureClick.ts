import type { ComparisonForReport, ReportCategory } from '../types/report'

export function resolveFeatureRowMeta(
  reportData: ComparisonForReport,
  key: string,
): { category: ReportCategory; nameLabel: string } | null {
  for (const r of reportData.rows) {
    if (r.canonicalMatchKey === key) {
      return { category: r.category, nameLabel: r.nameLabel }
    }
  }
  for (const u of reportData.unmatchedOsm) {
    if (u.canonicalMatchKey === key) {
      return { category: 'unmatched_osm', nameLabel: u.nameLabel }
    }
  }
  return null
}

export function needsOfficialOnlyAndUnmatchedOsmPicker(
  keys: string[],
  reportData: ComparisonForReport,
): boolean {
  if (keys.length < 2) return false
  let hasOfficialOnly = false
  let hasUnmatched = false
  for (const k of keys) {
    const m = resolveFeatureRowMeta(reportData, k)
    if (!m) continue
    if (m.category === 'official_only') hasOfficialOnly = true
    if (m.category === 'unmatched_osm') hasUnmatched = true
  }
  return hasOfficialOnly && hasUnmatched
}

type NavigateToFeatureDetail = (opts: {
  to: '/$areaId/feature/$featureKey'
  params: { areaId: string; featureKey: string }
}) => void | Promise<unknown>

export function handleComparisonMapFeatureClick(args: {
  featureKeys: string[]
  areaKey: string
  data: ComparisonForReport
  navigate: NavigateToFeatureDetail
  onOverlapPick: (keys: string[]) => void
}): void {
  const { featureKeys, areaKey, data, navigate, onOverlapPick } = args
  if (featureKeys.length === 1) {
    void navigate({
      to: '/$areaId/feature/$featureKey',
      params: { areaId: areaKey, featureKey: featureKeys[0] },
    })
    return
  }
  if (needsOfficialOnlyAndUnmatchedOsmPicker(featureKeys, data)) {
    onOverlapPick(featureKeys)
    return
  }
  void navigate({
    to: '/$areaId/feature/$featureKey',
    params: { areaId: areaKey, featureKey: featureKeys[0] },
  })
}
