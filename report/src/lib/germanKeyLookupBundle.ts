import type { GermanKeyLookupBundle } from '../../../scripts/shared/germanKeyLookupPayload.ts'
import {
  digitsOnly,
  type ArsSegmentNames,
  type GermanKeyLookupTables,
  parseArs12Segments,
} from './germanKeyExplorer.ts'

export type ObsoleteMeta = {
  year: number
  sourcePublicUrl: string
}

export type ResolvedField = {
  value: string | null
  obsolete?: ObsoleteMeta
}

export type ArsSegmentNameCells = {
  bundesland: ResolvedField
  regierungsbezirk: ResolvedField
  kreis: ResolvedField
  gemeindeverband: ResolvedField
  gemeinde: ResolvedField
}

function publicationUrlForYear(bundle: GermanKeyLookupBundle, year: number): string {
  return bundle.annualSourcePublicUrlsByYear[String(year)] ?? ''
}

function resolveMapField(
  bundle: GermanKeyLookupBundle,
  mapName: keyof GermanKeyLookupTables,
  key: string,
): ResolvedField {
  const latestVal = bundle.latest[mapName][key]
  if (latestVal !== undefined) return { value: latestVal }

  const obsVal = bundle.obsolete.maps[mapName][key]
  if (obsVal !== undefined) {
    const year = bundle.obsolete.lastContainedInYear[mapName][key]
    if (year !== undefined) {
      return {
        value: obsVal,
        obsolete: { year, sourcePublicUrl: publicationUrlForYear(bundle, year) },
      }
    }
    return { value: obsVal }
  }

  return { value: null }
}

/** Merge latest + obsolete maps for presets / normalization tables (single lookup table). */
export function mergeGermanKeyLookupTables(bundle: GermanKeyLookupBundle): GermanKeyLookupTables {
  function mergeRecord(
    primary: Record<string, string>,
    secondary: Record<string, string>,
  ): Record<string, string> {
    return { ...secondary, ...primary }
  }

  return {
    bundeslaender: mergeRecord(bundle.latest.bundeslaender, bundle.obsolete.maps.bundeslaender),
    regierungsbezirke: mergeRecord(
      bundle.latest.regierungsbezirke,
      bundle.obsolete.maps.regierungsbezirke,
    ),
    kreise: mergeRecord(bundle.latest.kreise, bundle.obsolete.maps.kreise),
    gemeindeverbaende: mergeRecord(
      bundle.latest.gemeindeverbaende,
      bundle.obsolete.maps.gemeindeverbaende,
    ),
    gemeindenByAgs: mergeRecord(bundle.latest.gemeindenByAgs, bundle.obsolete.maps.gemeindenByAgs),
    gemeindenByArs: mergeRecord(bundle.latest.gemeindenByArs, bundle.obsolete.maps.gemeindenByArs),
  }
}

/** ARS segment names with per-field obsolete metadata (current quarterly vs GV100ADJ-only keys). */
export function lookupArsSegmentNameCells(
  bundle: GermanKeyLookupBundle,
  ars12: string,
): ArsSegmentNameCells | null {
  const d = digitsOnly(ars12)
  if (d.length < 12) return null
  const full = d.slice(0, 12)
  const segments = parseArs12Segments(full)
  if (!segments) return null

  return {
    bundesland: resolveMapField(bundle, 'bundeslaender', segments.bundesland),
    regierungsbezirk: resolveMapField(bundle, 'regierungsbezirke', full.slice(0, 3)),
    kreis: resolveMapField(bundle, 'kreise', full.slice(0, 5)),
    gemeindeverband: resolveMapField(bundle, 'gemeindeverbaende', full.slice(0, 9)),
    gemeinde: resolveMapField(bundle, 'gemeindenByArs', full),
  }
}

/** Plain names-only view (backward compatible with older callers). */
export function arsSegmentNamesFromCells(
  cells: ArsSegmentNameCells | null,
): ArsSegmentNames | null {
  if (!cells) return null
  return {
    bundesland: cells.bundesland.value,
    regierungsbezirk: cells.regierungsbezirk.value,
    kreis: cells.kreis.value,
    gemeindeverband: cells.gemeindeverband.value,
    gemeinde: cells.gemeinde.value,
  }
}

export function resolveGemeindeNameByAgs(
  bundle: GermanKeyLookupBundle,
  ags8: string,
): ResolvedField {
  const d = digitsOnly(ags8)
  if (d.length < 8) return { value: null }
  return resolveMapField(bundle, 'gemeindenByAgs', d.slice(0, 8))
}

export function resolveGemeindeNameByArs(
  bundle: GermanKeyLookupBundle,
  ars12: string,
): ResolvedField {
  const d = digitsOnly(ars12)
  if (d.length < 12) return { value: null }
  return resolveMapField(bundle, 'gemeindenByArs', d.slice(0, 12))
}

export function collectObsoleteFields(fields: ResolvedField[]): ObsoleteMeta[] {
  const out: ObsoleteMeta[] = []
  const seen = new Set<string>()
  for (const f of fields) {
    if (!f.obsolete) continue
    const k = `${f.obsolete.year}\0${f.obsolete.sourcePublicUrl}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(f.obsolete)
  }
  return out
}

export type GermanKeyNameSearchHit = {
  kind: 'ags' | 'ars'
  id: string
  displayName: string
  obsolete?: ObsoleteMeta
}

function normalizeNameQuery(s: string): string {
  return s
    .trim()
    .replace(/\u200b/g, '')
    .replace(/\s+/g, ' ')
    .normalize('NFKC')
    .toLocaleLowerCase('de')
}

function normalizeOfficialDisplayName(name: string): string {
  return normalizeNameQuery(name)
}

/**
 * Lower = better match for sorting name hits.
 * Longer query prefixes outrank short ones (e.g. „Oberwesel“ before hundreds of „Ob…“).
 */
function nameMatchRank(nameNorm: string, q: string): number {
  if (q.length < 2) return 99
  if (nameNorm === q) return 0
  const head = nameNorm.split(',')[0]!.trim()
  if (head === q) return 1
  if (nameNorm.startsWith(`${q},`) || nameNorm.startsWith(`${q} `)) return 2
  if (head.startsWith(q)) return 10 + Math.max(0, 40 - q.length)
  if (nameNorm.includes(q)) return 60
  return 99
}

/**
 * True when the input should use the Schlüssel-/Ziffern-Pfad (submit → `key` in URL), not the
 * Namenssuche. Only digit-like characters (plus spaces and common separators) count as „code“ —
 * any letter forces the name path so strings like `PLZ 12345 Ort` are not misclassified.
 */
export function isGermanKeyDigitHeavyInput(raw: string): boolean {
  const t = raw.trim()
  if (t === '') return false
  if (/[a-zA-ZäöüÄÖÜß]/.test(t)) return false
  return /^[\d\s\-/.]+$/.test(t) && digitsOnly(t).length >= 1
}

type HitWithRank = { hit: GermanKeyNameSearchHit; rank: number }

export function searchGermanKeyDisplayNames(
  bundle: GermanKeyLookupBundle,
  query: string,
  maxResults = 200,
): GermanKeyNameSearchHit[] {
  const q = normalizeNameQuery(query)
  if (q.length < 2) return []

  const collected: HitWithRank[] = []

  function addHit(hit: GermanKeyNameSearchHit, rank: number): void {
    if (rank >= 99) return
    const dedupeKey = `${hit.kind}:${hit.id}`
    const existing = collected.find((c) => `${c.hit.kind}:${c.hit.id}` === dedupeKey)
    if (existing !== undefined && rank >= existing.rank) return
    if (existing !== undefined) {
      existing.hit = hit
      existing.rank = rank
      return
    }
    collected.push({ hit, rank })
  }

  function addIfNameMatches(hit: GermanKeyNameSearchHit, displayName: string): void {
    const nn = normalizeOfficialDisplayName(displayName)
    addHit(hit, nameMatchRank(nn, q))
  }

  for (const [id, name] of Object.entries(bundle.latest.gemeindenByAgs)) {
    addIfNameMatches({ kind: 'ags', id, displayName: name }, name)
  }

  for (const [id, name] of Object.entries(bundle.latest.gemeindenByArs)) {
    addIfNameMatches({ kind: 'ars', id, displayName: name }, name)
  }

  for (const [id, name] of Object.entries(bundle.obsolete.maps.gemeindenByAgs)) {
    const year = bundle.obsolete.lastContainedInYear.gemeindenByAgs[id]
    addIfNameMatches(
      {
        kind: 'ags',
        id,
        displayName: name,
        obsolete:
          year !== undefined
            ? { year, sourcePublicUrl: publicationUrlForYear(bundle, year) }
            : undefined,
      },
      name,
    )
  }

  for (const [id, name] of Object.entries(bundle.obsolete.maps.gemeindenByArs)) {
    const year = bundle.obsolete.lastContainedInYear.gemeindenByArs[id]
    addIfNameMatches(
      {
        kind: 'ars',
        id,
        displayName: name,
        obsolete:
          year !== undefined
            ? { year, sourcePublicUrl: publicationUrlForYear(bundle, year) }
            : undefined,
      },
      name,
    )
  }

  const qDigits = digitsOnly(query)
  if (qDigits.length === 8) {
    const nameLatest = bundle.latest.gemeindenByAgs[qDigits]
    if (nameLatest !== undefined) {
      addHit({ kind: 'ags', id: qDigits, displayName: nameLatest }, 0)
    }
    const nameObs = bundle.obsolete.maps.gemeindenByAgs[qDigits]
    if (nameObs !== undefined) {
      const year = bundle.obsolete.lastContainedInYear.gemeindenByAgs[qDigits]
      addHit(
        {
          kind: 'ags',
          id: qDigits,
          displayName: nameObs,
          obsolete:
            year !== undefined
              ? { year, sourcePublicUrl: publicationUrlForYear(bundle, year) }
              : undefined,
        },
        0,
      )
    }
  }
  if (qDigits.length === 12) {
    const nameLatest = bundle.latest.gemeindenByArs[qDigits]
    if (nameLatest !== undefined) {
      addHit({ kind: 'ars', id: qDigits, displayName: nameLatest }, 0)
    }
    const nameObs = bundle.obsolete.maps.gemeindenByArs[qDigits]
    if (nameObs !== undefined) {
      const year = bundle.obsolete.lastContainedInYear.gemeindenByArs[qDigits]
      addHit(
        {
          kind: 'ars',
          id: qDigits,
          displayName: nameObs,
          obsolete:
            year !== undefined
              ? { year, sourcePublicUrl: publicationUrlForYear(bundle, year) }
              : undefined,
        },
        0,
      )
    }
  }

  collected.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank
    const na = a.hit.displayName.localeCompare(b.hit.displayName, 'de', { sensitivity: 'base' })
    if (na !== 0) return na
    if (a.hit.kind !== b.hit.kind) return a.hit.kind === 'ags' ? -1 : 1
    return a.hit.id.localeCompare(b.hit.id, 'de', { numeric: true })
  })

  return collected.slice(0, maxResults).map((c) => c.hit)
}

/** Summary line for header: Destatis TXT snapshot inside latest quarterly zip. */
export function germanKeyLatestSnapshotLabelDe(bundle: GermanKeyLookupBundle): string {
  const raw = bundle.latest.source.snapshotDate
  if (Number.isNaN(new Date(raw).getTime())) return raw
  return new Date(raw).toLocaleDateString('de-DE')
}

export type GermanKeyExplorerHeaderSource = {
  label: string
  href: string
}

export function germanKeyExplorerHeaderSources(
  bundle: GermanKeyLookupBundle,
): GermanKeyExplorerHeaderSource[] {
  const rows: GermanKeyExplorerHeaderSource[] = [
    {
      label: bundle.latest.label,
      href: bundle.latest.sourcePublicUrl,
    },
  ]
  const years = Object.keys(bundle.annualSourcePublicUrlsByYear).sort(
    (a, b) => Number(a) - Number(b),
  )
  for (const y of years) {
    const href = bundle.annualSourcePublicUrlsByYear[y]
    if (href) {
      rows.push({
        label: `GV100ADJ Jahresausgabe 31.12.${y}`,
        href,
      })
    }
  }
  return rows
}
