import { z } from 'zod'
import {
  berlinBezirkToCanonical,
  normalizeOsmValue,
  type NormalizedGermanKey,
} from '../../../scripts/compare/lib/normalizeGermanKey.ts'
import type { IdNormalizationPreset } from '../../../scripts/shared/comparisonPayload.ts'
import { de } from '../i18n/de'

/** GV100AD-derived lookup maps for one Destatis dataset (from germanKeyLookup.gen). */
export type GermanKeyLookupTables = {
  bundeslaender: Record<string, string>
  regierungsbezirke: Record<string, string>
  kreise: Record<string, string>
  gemeindeverbaende: Record<string, string>
  gemeindenByAgs: Record<string, string>
  gemeindenByArs: Record<string, string>
}

/** Gemeindeverzeichnis Online deep links use 8-digit AGS (amtlicher Gemeindeschlüssel). */
export const STATISTIKPORTAL_GEMEINDEVERZEICHNIS =
  'https://www.statistikportal.de/de/gemeindeverzeichnis'

export type Ars12Segments = {
  bundesland: string
  regierungsbezirk: string
  kreis: string
  gemeindeverband: string
  gemeinde: string
}

export function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, '')
}

/** Full 12-digit ARS layout per OSM wiki (DE:Key:de:regionalschluessel). */
export function parseArs12Segments(digits: string): Ars12Segments | null {
  const d = digitsOnly(digits)
  if (d.length < 12) return null
  const full = d.slice(0, 12)
  return {
    bundesland: full.slice(0, 2),
    regierungsbezirk: full.slice(2, 3),
    kreis: full.slice(3, 5),
    gemeindeverband: full.slice(5, 9),
    gemeinde: full.slice(9, 12),
  }
}

/** First 8 digits of a 12-digit ARS: matches AGS when Gemeindeebene applies (see Destatis / wiki). */
export function ags8FromArs12Digits(digits12: string): string | null {
  const d = digitsOnly(digits12)
  if (d.length < 12) return null
  return `${d.slice(0, 5)}${d.slice(9, 12)}`
}

export function statistikportalGemeindeUrl(ags8: string): string {
  const d = digitsOnly(ags8)
  return `${STATISTIKPORTAL_GEMEINDEVERZEICHNIS}/${d.slice(0, 8)}`
}

/** Brandenburg compare preset: first 5 + last 3 of 12-digit RS. */
export function brandenburgGemeinden8From12(digits12: string): string | null {
  const d = digitsOnly(digits12)
  if (d.length < 12) return null
  return `${d.slice(0, 5)}${d.slice(9, 12)}`
}

/**
 * Presets this page documents: AGS / ARS / Berlin / Brandenburg Schlüssel — not PLZ or
 * text-based matching (see dataset `idNormalization` for those).
 */
export const GERMAN_SCHLUESSEL_EXPLORER_PRESETS = [
  'berlin-bezirk-ags',
  'amtlicher-8',
  'regional-12',
  'brandenburg-gemeinden-8',
] as const

export type GermanSchluesselExplorerPreset = (typeof GERMAN_SCHLUESSEL_EXPLORER_PRESETS)[number]

export const germanSchluesselExplorerPresetSchema = z.enum(GERMAN_SCHLUESSEL_EXPLORER_PRESETS)

export function coerceSchluesselExplorerPreset(
  raw: string | undefined,
): GermanSchluesselExplorerPreset | '' {
  if (raw === undefined || raw === '') return ''
  const p = germanSchluesselExplorerPresetSchema.safeParse(raw)
  return p.success ? p.data : ''
}

export function isSchluesselExplorerPreset(
  p: IdNormalizationPreset | undefined,
): p is GermanSchluesselExplorerPreset {
  if (p === undefined) return false
  return (GERMAN_SCHLUESSEL_EXPLORER_PRESETS as readonly string[]).includes(p)
}

/** Match key tag used when normalizing (compare uses the tag implied by osmProfile). */
export function sourceKeyForPreset(preset: IdNormalizationPreset): string {
  switch (preset) {
    case 'plz-5':
      return 'postal_code'
    case 'text':
      return 'name'
    default:
      return 'de:regionalschluessel'
  }
}

export function normalizeForPreset(
  raw: string,
  preset: IdNormalizationPreset,
): NormalizedGermanKey {
  return normalizeOsmValue(sourceKeyForPreset(preset), raw, preset)
}

export type PresetNormalizationRow = {
  preset: GermanSchluesselExplorerPreset
  result: NormalizedGermanKey
}

export function normalizationsForSchluesselPresets(raw: string): PresetNormalizationRow[] {
  return GERMAN_SCHLUESSEL_EXPLORER_PRESETS.map((preset) => ({
    preset,
    result: normalizeForPreset(raw, preset),
  }))
}

/**
 * Rows for the Schlüssel-Explorer normalization table only.
 * Omits `berlin-bezirk-ags`: that preset targets 5-digit Berlin Bezirk codes (and passthrough 8-digit);
 * full 12-digit ARS inputs only produce a misleading `unexpected-digit-length` note there, while
 * Berlin expansion is shown in the dedicated block when applicable (`tryBerlinBezirkCanonical5`).
 */
export function normalizationsForSchluesselExplorerTable(raw: string): PresetNormalizationRow[] {
  return normalizationsForSchluesselPresets(raw).filter((r) => r.preset !== 'berlin-bezirk-ags')
}

const UNEXPECTED_DIGIT_LENGTH_NOTE = /^unexpected-digit-length:(\d+)$/

/** Human-readable German labels for compare `notes` tokens (explorer table only). */
export function formatNormalizationNotesForExplorerUi(notes: readonly string[]): string {
  const t = de.germanKeyExplorer
  const labels = t.normalizationNotesUi as Record<string, string>
  return notes
    .map((note) => {
      const m = UNEXPECTED_DIGIT_LENGTH_NOTE.exec(note)
      if (m?.[1]) return t.normalizationNoteUnexpectedDigitLength(m[1])
      return labels[note] ?? note
    })
    .join('; ')
}

export type ArsSegmentNames = {
  bundesland: string | null
  regierungsbezirk: string | null
  kreis: string | null
  gemeindeverband: string | null
  gemeinde: string | null
}

export function lookupArsSegmentNames(
  tables: GermanKeyLookupTables,
  ars12: string,
): ArsSegmentNames | null {
  const d = digitsOnly(ars12)
  if (d.length < 12) return null
  const full = d.slice(0, 12)
  const segments = parseArs12Segments(full)
  if (!segments) return null
  return {
    bundesland: tables.bundeslaender[segments.bundesland] ?? null,
    regierungsbezirk: tables.regierungsbezirke[full.slice(0, 3)] ?? null,
    kreis: tables.kreise[full.slice(0, 5)] ?? null,
    gemeindeverband: tables.gemeindeverbaende[full.slice(0, 9)] ?? null,
    gemeinde: tables.gemeindenByArs[full] ?? null,
  }
}

export function lookupGemeindeNameByAgs(
  tables: GermanKeyLookupTables,
  ags8: string,
): string | null {
  const d = digitsOnly(ags8)
  if (d.length < 8) return null
  return tables.gemeindenByAgs[d.slice(0, 8)] ?? null
}

export function lookupGemeindeNameByArs(
  tables: GermanKeyLookupTables,
  ars12: string,
): string | null {
  const d = digitsOnly(ars12)
  if (d.length < 12) return null
  return tables.gemeindenByArs[d.slice(0, 12)] ?? null
}

export function lookupNameForNormalizedPresetKey(
  tables: GermanKeyLookupTables,
  preset: GermanSchluesselExplorerPreset,
  canonicalKey: string,
): string | null {
  switch (preset) {
    case 'regional-12':
      return lookupGemeindeNameByArs(tables, canonicalKey)
    case 'amtlicher-8':
    case 'brandenburg-gemeinden-8':
      return lookupGemeindeNameByAgs(tables, canonicalKey)
    case 'berlin-bezirk-ags':
      return null
  }
}

export function tryBerlinBezirkCanonical5(
  raw: string,
): { ok: true; value: string } | { ok: false } {
  const d = digitsOnly(raw)
  if (d.length !== 5) return { ok: false }
  try {
    return { ok: true, value: berlinBezirkToCanonical(d) }
  } catch {
    return { ok: false }
  }
}
