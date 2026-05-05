import type { DatasetConfig } from './datasetConfig.ts'

/** Embedded once per `comparison_table.json` (not per row). */
export type CompareRulesSummary = {
  idNormalizationPreset: DatasetConfig['idNormalization']['preset']
  osmMatchCriteria?: { kind: 'property' } | { kind: 'relation_id'; relationIds: string[] }
}

export function toCompareRulesSummary(config: DatasetConfig): CompareRulesSummary {
  const out: CompareRulesSummary = {
    idNormalizationPreset: config.idNormalization.preset,
  }
  const mc = config.osm?.matchCriteria
  if (mc?.kind === 'property') {
    out.osmMatchCriteria = { kind: 'property' }
  } else if (mc?.kind === 'relation_id') {
    out.osmMatchCriteria = { kind: 'relation_id', relationIds: [...mc.relationIds] }
  }
  return out
}
