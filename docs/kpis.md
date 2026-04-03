# Analysis KPIs (index)

This file does **not** define the metrics in prose. Each KPI’s **implementation** and **German UI copy** live next to each other under `scripts/compare/lib/metrics/`.

**Repository:** [github.com/osmberlin/osm-boundary-checker-germany](https://github.com/osmberlin/osm-boundary-checker-germany)

| KPI                          | Compute                                                                                                                         | Translations / modal copy                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| IoU                          | [`scripts/compare/lib/metrics/iou/compute.ts`](../scripts/compare/lib/metrics/iou/compute.ts)                                   | [`scripts/compare/lib/metrics/iou/de.ts`](../scripts/compare/lib/metrics/iou/de.ts)                                   |
| Area delta %                 | [`scripts/compare/lib/metrics/area-delta/compute.ts`](../scripts/compare/lib/metrics/area-delta/compute.ts)                     | [`scripts/compare/lib/metrics/area-delta/de.ts`](../scripts/compare/lib/metrics/area-delta/de.ts)                     |
| Symmetric difference %       | [`scripts/compare/lib/metrics/symmetric-difference/compute.ts`](../scripts/compare/lib/metrics/symmetric-difference/compute.ts) | [`scripts/compare/lib/metrics/symmetric-difference/de.ts`](../scripts/compare/lib/metrics/symmetric-difference/de.ts) |
| Hausdorff (m)                | [`scripts/compare/lib/metrics/hausdorff/compute.ts`](../scripts/compare/lib/metrics/hausdorff/compute.ts)                       | [`scripts/compare/lib/metrics/hausdorff/de.ts`](../scripts/compare/lib/metrics/hausdorff/de.ts)                       |
| Mean IoU (chart / snapshots) | [`scripts/compare/lib/metrics/mean-iou/compute.ts`](../scripts/compare/lib/metrics/mean-iou/compute.ts)                         | [`scripts/compare/lib/metrics/mean-iou/de.ts`](../scripts/compare/lib/metrics/mean-iou/de.ts)                         |

**Orchestration (intersection, union, assembly):** [`scripts/compare/lib/metrics/calculateMetrics.ts`](../scripts/compare/lib/metrics/calculateMetrics.ts)

**Report modals:** [`report/src/components/MetricInfoModal.tsx`](../report/src/components/MetricInfoModal.tsx) (imports copy from `@compare-metrics/modalCopyDe.ts`)

See also: [processing-and-analysis.md](./processing-and-analysis.md).
