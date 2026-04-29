export type IssueIndicatorLevel = 'ok' | 'review' | 'issue'

export type IssueIndicatorReason =
  | 'STRONG_OVERLAP_LOW_DIFF'
  | 'BOUNDARY_OUTLIER_BUT_OVERLAP_STABLE'
  | 'LOW_IOU_HIGH_SYM_DIFF'
  | 'HIGH_AREA_DELTA'
  | 'BASELINE_ANOMALY_IOU_DELTA'
  | 'BASELINE_ANOMALY_SYMDIFF_DELTA'
  | 'BASELINE_ANOMALY_AREA_DELTA'
  | 'BASELINE_ANOMALY_HAUSDORFF_NORM_DELTA'

export type IssueIndicator = {
  level: IssueIndicatorLevel
  reasons: IssueIndicatorReason[]
}

export type MetricResult = {
  iou: number
  areaDiffPct: number
  symmetricDiffPct: number
  hausdorffM: number
  hausdorffP95M?: number
  hausdorffNorm?: number
  issueIndicator?: IssueIndicator
  officialAreaM2: number
  osmAreaM2: number
}
