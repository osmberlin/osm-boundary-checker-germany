import { useMap } from 'react-map-gl/maplibre'
import { de } from '../../i18n/de'
import { sourceText } from '../../i18n/sourceVocabulary'
import { formatDeInteger } from '../../lib/formatDe'
import type { ComparisonForReport, ReportRow } from '../../types/report'
import { AlertNotice } from '../AlertNotice'
import { COMPARISON_MAP_ID } from '../map/comparisonMapConstants'

const DISJOINT_MAX_IOU = 0.01
const DISJOINT_MIN_HAUSDORFF_M = 5000

const buttonClass =
  'text-sm font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400 disabled:pointer-events-none disabled:opacity-50'

/** Matched pair whose two geometries do not overlap but lie far apart (the map fit then hides both). */
export function isDisjointMatchedRow(row: ReportRow): boolean {
  const metrics = row.metrics
  return (
    row.category === 'matched' &&
    metrics != null &&
    metrics.iou < DISJOINT_MAX_IOU &&
    metrics.hausdorffM > DISJOINT_MIN_HAUSDORFF_M
  )
}

/** Above the detail map: explains a disjoint matched pair and fits the map to either geometry. */
export function DisjointGeometryNotice({
  row,
  data,
}: {
  row: ReportRow
  data: ComparisonForReport
}) {
  const mapRef = useMap()[COMPARISON_MAP_ID]
  if (!isDisjointMatchedRow(row) || row.metrics == null) return null

  const kind = data.sourceKind
  const matchProperty =
    data.filterConfigSummary.osmMatchProperties?.join(', ') ??
    data.filterConfigSummary.officialMatchProperty

  function fitTo(bbox: ReportRow['officialBbox']) {
    const map = mapRef?.getMap()
    if (!map || !bbox) return
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 40, duration: 350 },
    )
  }

  const areaLabelDative = sourceText(kind, 'areaLabelDative')

  return (
    <section aria-label={de.feature.disjointGeometryNoticeAria} className="mb-4">
      <AlertNotice>
        <p>
          {de.feature.disjointGeometryNoticeLead({
            areaLabel: sourceText(kind, 'areaLabelNominative'),
            distanceKm: formatDeInteger(Math.round(row.metrics.hausdorffM / 1000)),
            matchProperty,
            dataLabel: sourceText(kind, 'dataLabelDative'),
          })}
        </p>
        {row.officialBbox || row.osmBbox ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {row.officialBbox ? (
              <button
                type="button"
                className={buttonClass}
                disabled={!mapRef}
                onClick={() => fitTo(row.officialBbox)}
              >
                {de.feature.disjointGeometryZoomToArea(areaLabelDative)}
              </button>
            ) : null}
            {row.osmBbox ? (
              <button
                type="button"
                className={buttonClass}
                disabled={!mapRef}
                onClick={() => fitTo(row.osmBbox)}
              >
                {de.feature.disjointGeometryZoomToOsm}
              </button>
            ) : null}
          </div>
        ) : null}
      </AlertNotice>
    </section>
  )
}
