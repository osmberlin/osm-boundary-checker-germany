import { de } from '../i18n/de'
import type { ReportRow } from '../types/report'

function formatPropertyValue(value: unknown): string {
  if (value === null || value === undefined) return de.feature.datasetPropertiesEmpty
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

/** Drop noisy keys for display (e.g. @id duplicates OSM object identity elsewhere). */
function forDisplay(props: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!props) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(props)) {
    if (k === '@id') continue
    out[k] = v
  }
  return out
}

function DatasetPropertyCard({ properties }: { properties: Record<string, unknown> }) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))

  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">{de.feature.datasetPropertiesEmpty}</p>
  }

  return (
    <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
          <dd className="break-words text-slate-100">{formatPropertyValue(v)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function FeatureDatasetProperties({ row }: { row: ReportRow }) {
  const official = forDisplay(row.officialProperties)
  const osm = forDisplay(row.osmProperties)
  const osmRelationId = row.osmRelationId.trim()
  const osmHistoryUrl =
    osmRelationId === '' ? null : `https://www.openstreetmap.org/relation/${osmRelationId}/history`
  const compactButtonClass =
    'inline-flex rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-sm ring-1 ring-inset transition-colors bg-slate-100 text-slate-900 ring-slate-300 hover:bg-slate-200'

  return (
    <section
      className="mt-10 overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.feature.datasetPropertiesSectionAria}
    >
      <div className="px-4 py-6 sm:px-6">
        <h2 className="text-base font-semibold text-slate-100">
          {de.feature.datasetPropertiesSectionTitle}
        </h2>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">
          {de.feature.datasetPropertiesSectionLead}
        </p>
      </div>
      <div className="border-t border-slate-700">
        <dl className="divide-y divide-slate-700/80">
          <div className="bg-blue-950/18 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt className="text-sm/6 font-medium text-slate-200">
              {de.feature.datasetOfficialCardTitle}
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <DatasetPropertyCard properties={official} />
            </dd>
          </div>
          <div className="bg-red-950/18 px-4 py-6 sm:px-6 md:grid md:grid-cols-3 md:gap-6">
            <dt className="flex items-center justify-between gap-3 md:justify-start">
              <h3 className="text-sm/6 font-medium text-slate-200">
                {de.feature.datasetOsmCardTitle}
              </h3>
              {osmHistoryUrl && (
                <a
                  href={osmHistoryUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={compactButtonClass}
                >
                  {de.feature.datasetOsmOpenHistory}
                </a>
              )}
            </dt>
            <dd className="mt-2 md:col-span-2 md:mt-0">
              <DatasetPropertyCard properties={osm} />
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
