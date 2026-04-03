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

function DatasetPropertyCard({
  title,
  properties,
  variant,
}: {
  title: string
  properties: Record<string, unknown>
  variant: 'official' | 'osm'
}) {
  const entries = Object.entries(properties).sort(([a], [b]) => a.localeCompare(b, 'de'))
  const shell =
    variant === 'official' ? 'border-blue-900/50 bg-blue-950/18' : 'border-red-900/45 bg-red-950/18'
  const bar = variant === 'official' ? 'border-l-blue-400/45' : 'border-l-red-400/45'

  return (
    <article className={`rounded-lg border border-l-[3px] ${bar} ${shell} p-3 shadow-sm`}>
      <h3 className="mb-2 text-sm font-medium text-slate-100">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">{de.feature.datasetPropertiesEmpty}</p>
      ) : (
        <dl className="grid gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-xs break-words text-slate-400">{k}</dt>
              <dd className="break-words text-slate-100">{formatPropertyValue(v)}</dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  )
}

export function FeatureDatasetProperties({ row }: { row: ReportRow }) {
  const legacy = row.officialProperties === undefined && row.osmProperties === undefined

  if (legacy) {
    return (
      <section
        className="mt-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4"
        aria-label={de.feature.datasetPropertiesSectionAria}
      >
        <h2 className="text-sm font-semibold text-slate-100">
          {de.feature.datasetPropertiesSectionTitle}
        </h2>
        <p className="mt-2 text-sm text-slate-400">{de.feature.datasetPropertiesLegacySnapshot}</p>
      </section>
    )
  }

  const official = forDisplay(row.officialProperties ?? null)
  const osm = forDisplay(row.osmProperties ?? null)

  return (
    <section
      className="mt-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4"
      aria-label={de.feature.datasetPropertiesSectionAria}
    >
      <h2 className="text-sm font-semibold text-slate-100">
        {de.feature.datasetPropertiesSectionTitle}
      </h2>
      <p className="mt-1 text-xs text-slate-400">{de.feature.datasetPropertiesSectionLead}</p>
      <div className="mt-4 space-y-4">
        <DatasetPropertyCard
          title={de.feature.datasetOfficialCardTitle}
          properties={official}
          variant="official"
        />
        <DatasetPropertyCard
          title={de.feature.datasetOsmCardTitle}
          properties={osm}
          variant="osm"
        />
      </div>
    </section>
  )
}
