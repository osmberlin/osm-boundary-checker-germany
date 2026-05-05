import {
  berlinBezirkToCanonical,
  normalizeOsmValue,
  type NormalizedGermanKey,
} from '../../../scripts/compare/lib/normalizeGermanKey.ts'
import type { IdNormalizationPreset } from '../../../scripts/shared/comparisonPayload.ts'

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
  if (d.length < 8) return null
  return d.slice(0, 8)
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

export const ALL_ID_NORMALIZATION_PRESETS: IdNormalizationPreset[] = [
  'berlin-bezirk-ags',
  'amtlicher-8',
  'regional-12',
  'brandenburg-gemeinden-8',
  'plz-5',
  'text',
]

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
  preset: IdNormalizationPreset
  result: NormalizedGermanKey
}

export function normalizationsForAllPresets(raw: string): PresetNormalizationRow[] {
  return ALL_ID_NORMALIZATION_PRESETS.map((preset) => ({
    preset,
    result: normalizeForPreset(raw, preset),
  }))
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
