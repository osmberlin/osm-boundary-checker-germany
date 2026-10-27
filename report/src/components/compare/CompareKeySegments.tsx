import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import type { GermanKeyLookupBundle } from '../../../../scripts/shared/germanKeyLookupPayload.ts'
import { germanKeyLookupQueryOptions } from '../../data/load'
import { de } from '../../i18n/de'
import { cn } from '../../lib/cn'
import { parseArs12Segments, type Ars12Segments } from '../../lib/germanKeyExplorer'
import {
  lookupArsSegmentNameCells,
  type ArsSegmentNameCells,
  type ResolvedField,
} from '../../lib/germanKeyLookupBundle'
import { ProvenanceGridSectionHeader } from '../ProvenanceGridSectionHeader'

const SEGMENTS: ReadonlyArray<{ id: keyof Ars12Segments; label: string }> = [
  { id: 'bundesland', label: de.germanKeyExplorer.segmentBl },
  { id: 'regierungsbezirk', label: de.germanKeyExplorer.segmentRb },
  { id: 'kreis', label: de.germanKeyExplorer.segmentKreis },
  { id: 'gemeindeverband', label: de.germanKeyExplorer.segmentVg },
  { id: 'gemeinde', label: de.germanKeyExplorer.segmentGem },
]

type KeySide = { key: string; segments: Ars12Segments; cells: ArsSegmentNameCells | null }

function keySide(bundle: GermanKeyLookupBundle | undefined, key: string): KeySide | null {
  const segments = parseArs12Segments(key)
  if (!segments || key.replace(/\D/g, '').length !== 12) return null
  return { key, segments, cells: bundle ? lookupArsSegmentNameCells(bundle, key) : null }
}

function SegmentCell({
  digits,
  field,
  differs,
  loading,
}: {
  digits: string
  field: ResolvedField | undefined
  differs: boolean
  loading: boolean
}) {
  return (
    <div
      className={cn(
        'min-w-0 rounded px-2 py-1',
        differs && 'bg-amber-900/30 ring-1 ring-amber-700/60',
      )}
    >
      <span className="font-mono text-xs text-slate-100">{digits}</span>{' '}
      <span className="text-sm text-slate-300">
        {loading ? '…' : (field?.value ?? de.compare.keysNotFound)}
      </span>
      {field?.obsolete ? (
        <span className="ml-1 text-xs text-amber-300/90">
          ({de.compare.keysObsolete(field.obsolete.year)})
        </span>
      ) : null}
    </div>
  )
}

function ExplorerLink({ keyValue }: { keyValue: string }) {
  return (
    <Link
      to="/tools/german-key"
      search={{ key: keyValue }}
      className="text-xs font-medium text-sky-400 underline decoration-slate-600 underline-offset-2 hover:decoration-sky-400"
    >
      {de.compare.keysOpenExplorer}
    </Link>
  )
}

/** Column head: the side and the field the key comes from, then the key and the explorer link. */
function KeyColumnHeader({
  side,
  field,
  keyValue,
}: {
  side: string
  /** Official property or OSM tag the key is read from (`ARS`, `de:regionalschluessel`). */
  field: string
  keyValue: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 px-2 pb-1">
      <span className="text-sm font-semibold text-slate-100">
        {side} <span className="font-mono text-xs font-normal text-slate-400">{field}</span>
      </span>
      <span className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-mono text-xs text-slate-300">{keyValue}</span>
        <ExplorerLink keyValue={keyValue} />
      </span>
    </div>
  )
}

/**
 * Both 12-digit Regionalschlüssel split into their levels and resolved in the key directory,
 * so the page answers "which level changed?" without opening the explorer twice.
 */
export function CompareKeySegments({
  officialKey,
  osmKey,
  officialField,
  osmField,
}: {
  officialKey: string
  osmKey: string
  officialField: string
  osmField: string
}) {
  const lookupQuery = useQuery(germanKeyLookupQueryOptions())
  const official = keySide(lookupQuery.data, officialKey)
  const osm = keySide(lookupQuery.data, osmKey)
  if (!official || !osm) return null
  const loading = lookupQuery.isPending

  return (
    <section
      className="overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50 shadow-sm"
      aria-label={de.compare.keysHeading}
    >
      <ProvenanceGridSectionHeader title={de.compare.keysHeading}>
        <p className="mt-2 max-w-4xl text-sm text-slate-400">{de.compare.keysLead}</p>
      </ProvenanceGridSectionHeader>
      <div className="overflow-x-auto border-t border-slate-700 px-4 py-4 sm:px-6">
        <div className="grid min-w-[36rem] grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-1">
          <span className="text-xs font-medium tracking-wide text-slate-400 uppercase">
            {de.compare.keysColumnSegment}
          </span>
          <KeyColumnHeader
            side={de.compare.keysColumnOfficial}
            field={officialField}
            keyValue={officialKey}
          />
          <KeyColumnHeader side={de.compare.keysColumnOsm} field={osmField} keyValue={osmKey} />
          {SEGMENTS.map(({ id, label }) => {
            const differs = official.segments[id] !== osm.segments[id]
            return (
              <div key={id} className="contents">
                <span className="py-1 text-sm text-slate-300">
                  {label}
                  {differs ? (
                    <span className="ml-2 text-xs text-amber-300/90">{de.compare.keysDiffer}</span>
                  ) : null}
                </span>
                <SegmentCell
                  digits={official.segments[id]}
                  field={official.cells?.[id]}
                  differs={differs}
                  loading={loading}
                />
                <SegmentCell
                  digits={osm.segments[id]}
                  field={osm.cells?.[id]}
                  differs={differs}
                  loading={loading}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
