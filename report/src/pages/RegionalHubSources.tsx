import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { WIKIDATA_REGIONAL_SPARQL } from '../../../scripts/shared/wikidataRegionalSparqlQuery.ts'
import { germanKeyLookupQueryOptions, regionalHubManifestQueryOptions } from '../data/load'
import { de } from '../i18n/de'
import { formatDeInteger } from '../lib/formatDe'
import { formatSnapshotDateLabelDe } from '../lib/formatSourceDownloadedAt'

const t = de.regionalHub
const linkClass =
  'text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400'

function dateLabel(raw: string | undefined): string {
  if (!raw) return t.provenanceUnknown
  return formatSnapshotDateLabelDe(raw.slice(0, 10)) || raw
}

export function RegionalHubSources() {
  const manifestQuery = useQuery(regionalHubManifestQueryOptions())
  const lookupQuery = useQuery(germanKeyLookupQueryOptions())
  const manifest = manifestQuery.data
  const destatis = manifest?.destatis
  const sampleAttr = lookupQuery.data?.latest.gemeindeAttributesByArs?.[destatis?.sampleArs ?? '']

  return (
    <div className="mx-auto max-w-5xl px-4 pt-8 text-left sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-700 pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">{t.sourcesTitle}</h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-400">{t.sourcesLead}</p>
        <p className="mt-3 text-sm">
          <Link to="/status" className={linkClass}>
            {de.home.processingStatusLink}
          </Link>
          <span className="mx-1.5 text-slate-500">·</span>
          <Link to="/regional" className={linkClass}>
            {t.title}
          </Link>
        </p>
      </header>

      {manifestQuery.isPending ? (
        <p className="text-sm text-slate-500">{de.routeLoading.regionalHub}</p>
      ) : !manifest ? (
        <p className="text-sm text-slate-400">Noch keine Hub-Dateien (regional-hub:generate).</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-700 bg-slate-900/80 text-left text-slate-300">
              <tr>
                <th className="px-3 py-2">Quelle</th>
                <th className="px-3 py-2">Stand</th>
                <th className="px-3 py-2">Skip / Hinweis</th>
                <th className="px-3 py-2">Zählung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              <tr>
                <td className="px-3 py-2">Destatis GVAuszugQ</td>
                <td className="px-3 py-2">{dateLabel(destatis?.populationDate)}</td>
                <td className="px-3 py-2 text-slate-400">
                  Gebietsstand {dateLabel(destatis?.snapshotDate)}
                </td>
                <td className="px-3 py-2">
                  {destatis?.gemeindenWithPopulation != null
                    ? `${formatDeInteger(destatis.gemeindenWithPopulation)} Gemeinden mit EWZ`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">OSM-Tags</td>
                <td className="px-3 py-2">{dateLabel(manifest.osm.generatedAt)}</td>
                <td className="px-3 py-2 text-slate-400">{manifest.osm.skipReason ?? '—'}</td>
                <td className="px-3 py-2">
                  {manifest.osm.featureCount != null
                    ? `${formatDeInteger(manifest.osm.featureCount)} Features`
                    : '—'}
                </td>
              </tr>
              <tr>
                <td className="px-3 py-2">Wikidata SPARQL</td>
                <td className="px-3 py-2">{dateLabel(manifest.wikidata.generatedAt)}</td>
                <td className="px-3 py-2 text-slate-400">
                  {manifest.wikidata.skipReason ??
                    (manifest.wikidata.splitByLand ? 'Land-Splits' : '—')}
                  {manifest.wikidata.durationMs != null
                    ? ` · ${formatDeInteger(Math.round(manifest.wikidata.durationMs / 1000))} s`
                    : ''}
                </td>
                <td className="px-3 py-2">
                  {manifest.wikidata.rowCount != null
                    ? `${formatDeInteger(manifest.wikidata.rowCount)} P1388`
                    : '—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-8 space-y-2">
        <h2 className="text-base font-semibold text-slate-100">{t.sampleParse}</h2>
        <p className="font-mono text-xs text-slate-400">
          ARS {destatis?.sampleArs ?? '120510000000'} · EWZ{' '}
          {sampleAttr?.populationTotal ?? destatis?.samplePopulation ?? '—'} · Fläche{' '}
          {sampleAttr?.areaKm2 ?? destatis?.sampleAreaKm2 ?? '—'} km²
        </p>
        {destatis?.areaColumnHeader ? (
          <p className="text-xs text-slate-500">Fläche-Spalte: {destatis.areaColumnHeader}</p>
        ) : null}
        {destatis?.populationColumnHeader ? (
          <p className="text-xs text-slate-500">
            Bevölkerung-Spalte: {destatis.populationColumnHeader}
          </p>
        ) : null}
      </section>

      <section className="mt-8 space-y-2">
        <h2 className="text-base font-semibold text-slate-100">{t.sourcesSparql}</h2>
        <pre className="overflow-auto rounded-lg border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-300">
          {WIKIDATA_REGIONAL_SPARQL}
        </pre>
      </section>
    </div>
  )
}
