import type { DatasetConfig } from './datasetConfig.ts'
import { type MatchRule, resolveMatchRules } from './matchRules.ts'

/** Embedded once per `comparison_table.json` (not per row). */
export type CompareRulesSummary = {
  idNormalizationPreset: DatasetConfig['idNormalization']['preset']
  /** Ordered rules that pair official rows with OSM objects. */
  matchRules: MatchRule[]
}

export function toCompareRulesSummary(config: DatasetConfig): CompareRulesSummary {
  return {
    idNormalizationPreset: config.idNormalization.preset,
    matchRules: resolveMatchRules(config),
  }
}
