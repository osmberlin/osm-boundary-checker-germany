import type { SourceKind } from '../../../../scripts/shared/sourceKind.ts'
import { de } from '../../i18n/de'
import { renderWithAbbr, sourceText } from '../../i18n/sourceVocabulary'
import type { AttributeHint, ReportRow } from '../../types/report'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'
import { CopyTagsButton } from './CopyTagsButton'

function TagLines({ lines, emptyLabel }: { lines: string[]; emptyLabel: string }) {
  if (lines.length === 0) return <span className="text-slate-500">{emptyLabel}</span>
  return (
    <>
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </>
  )
}

function osmHintTitle(hint: AttributeHint, categoryName: string | null): string {
  const titles = de.feature.attributeHints.titles
  if (hint.id === 'type_tags') return titles.type_tags(categoryName)
  // `wdpa_missing_in_dtp` is always a reference hint (a sentence), so it has no OSM title.
  return titles[hint.id as keyof typeof titles] as string
}

/** One plain sentence for a hint that is meant for the reference data, not for OSM. */
function referenceHintSentence(hint: AttributeHint, sourceKind: SourceKind | undefined): string {
  const data = sourceText(sourceKind, 'dataLabelDative')
  const wdpaId = hint.actual[0]?.split('=').slice(1).join('=') ?? ''
  return de.feature.attributeHints.referenceSentences.wdpa_missing_in_dtp(data, wdpaId)
}

function HintGroup({
  title,
  lead,
  children,
}: {
  title: string
  lead: string
  children: React.ReactNode
}) {
  return (
    <div className="border-t border-amber-800/45">
      <div className="px-4 pt-5 sm:px-6">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="mt-1 max-w-4xl text-sm text-slate-400">{lead}</p>
      </div>
      <ul className="mt-4 divide-y divide-amber-800/40 border-t border-amber-800/40">{children}</ul>
    </div>
  )
}

/**
 * Hints for a matched protected-area row (shard `attributeHints`); not shown without hints.
 * `osm` hints suggest tags for the OSM object, `reference` hints are notes for the reference data.
 */
export function AttributeHintsSection({
  row,
  hints,
  sourceKind,
}: {
  row: ReportRow
  hints: AttributeHint[] | undefined
  sourceKind: SourceKind | undefined
}) {
  if (row.category !== 'matched' || !hints || hints.length === 0) return null
  const t = de.feature.attributeHints
  const osmHints = hints.filter((hint) => hint.target === 'osm')
  const referenceHints = hints.filter((hint) => hint.target === 'reference')
  const rawCategoryName = row.officialProperties?.category_name
  const categoryName =
    typeof rawCategoryName === 'string' && rawCategoryName.trim().length > 0
      ? rawCategoryName.trim()
      : null
  const data = sourceText(sourceKind, 'dataLabelDative')

  return (
    <section
      className="overflow-hidden rounded-lg border border-amber-800/50 bg-amber-950/30 shadow-sm"
      aria-label={t.aria}
    >
      <ProvenanceGridSectionHeader title={t.title} className="pb-5" />
      {osmHints.length > 0 ? (
        <HintGroup title={t.osmGroupTitle} lead={t.osmGroupLead(data)}>
          {osmHints.map((hint) => (
            <li key={hint.id} className="flex flex-col gap-3 px-4 py-4 sm:px-6">
              <p className="text-sm font-medium text-slate-100">
                {osmHintTitle(hint, categoryName)}
              </p>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                    {t.expected}
                  </dt>
                  <dd className="font-mono text-xs break-words text-slate-100">
                    <TagLines lines={hint.expected} emptyLabel={t.actualNone} />
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-medium tracking-wide text-slate-400 uppercase">
                    {t.actual}
                  </dt>
                  <dd className="font-mono text-xs break-words text-slate-100">
                    <TagLines lines={hint.actual} emptyLabel={t.actualNone} />
                  </dd>
                </div>
              </dl>
              {hint.suggestedTags && Object.keys(hint.suggestedTags).length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium tracking-wide text-slate-400 uppercase">
                    {t.suggestion}
                  </span>
                  <code className="rounded bg-slate-950/80 px-1.5 py-0.5 font-mono break-all text-slate-200 ring-1 ring-slate-700/80">
                    {Object.entries(hint.suggestedTags)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(', ')}
                  </code>
                  <CopyTagsButton
                    tags={hint.suggestedTags}
                    ariaLabel={`${t.suggestion}: ${osmHintTitle(hint, categoryName)}`}
                  />
                </div>
              ) : null}
            </li>
          ))}
        </HintGroup>
      ) : null}
      {referenceHints.length > 0 ? (
        <HintGroup title={t.referenceGroupTitle} lead={t.referenceGroupLead(data)}>
          {referenceHints.map((hint) => (
            <li key={hint.id} className="px-4 py-4 text-sm text-slate-100 sm:px-6">
              {renderWithAbbr(referenceHintSentence(hint, sourceKind))}
            </li>
          ))}
        </HintGroup>
      ) : null}
    </section>
  )
}
