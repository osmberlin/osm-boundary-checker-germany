/**
 * Shared thresholds used by issue classification and UI hints/modals.
 * Keep these values in sync with `classifyIssueIndicator`.
 */
export const KPI_IOU_OVERLAP_VERY_STRONG = 0.995
export const KPI_IOU_OVERLAP_GOOD = 0.99
/** IoU below this (with high sym. diff.) drives issue level. */
export const KPI_IOU_LOW_WITH_HIGH_SYM_DIFF = 0.985

export const KPI_SYM_DIFF_STRONG_OVERLAP_MAX = 0.35
export const KPI_SYM_DIFF_OVERLAP_GOOD_MAX = 0.75
export const KPI_SYM_DIFF_HIGH_WITH_LOW_IOU = 1.5

export const KPI_AREA_DELTA_STRONG_OVERLAP_MAX = 0.35
export const KPI_AREA_DELTA_HIGH = 1.2

export const KPI_HAUSDORFF_NORM_REVIEW = 0.02
export const KPI_HAUSDORFF_NORM_SEVERE = 0.04
