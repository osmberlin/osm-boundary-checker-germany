import type { IdNormalizationPreset } from './config.ts'

export type NormalizedGermanKey = {
  sourceKey: string
  rawValue: string
  digits: string
  canonicalMatchKey: string
  hierarchy: {
    bundesland: string
    regierungsbezirk: string
    kreis: string
    gemeinde: string
  } | null
  preset: string
  notes: string[]
}

/** Berlin Bezirk: de:regionalschluessel 5-digit (11001) → 8-digit AGS-style (11000001). */
export function berlinBezirkToCanonical(raw: string): string {
  const d = raw.replace(/\D/g, '')
  if (d.length !== 5) {
    throw new Error(`berlin-bezirk-ags: expected 5 digits, got "${raw}"`)
  }
  return `${d.slice(0, 2)}000${d.slice(2).padStart(3, '0')}`
}

function parseRegional12(d: string): NormalizedGermanKey['hierarchy'] {
  if (d.length !== 12) return null
  return {
    bundesland: d.slice(0, 2),
    regierungsbezirk: d.slice(2, 3),
    kreis: d.slice(3, 5),
    gemeinde: d.slice(5, 8),
  }
}

function parseRegional8(d: string): NormalizedGermanKey['hierarchy'] {
  if (d.length !== 8) return null
  return {
    bundesland: d.slice(0, 2),
    regierungsbezirk: d.slice(2, 3),
    kreis: d.slice(3, 5),
    gemeinde: d.slice(5, 8),
  }
}

function normalizeBrandenburgGemeindenOfficial(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  if (v.includes(';')) {
    const parts = v
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
    if (parts.length !== 4) {
      throw new Error(`brandenburg-gemeinden-8: expected 4 semicolon-separated parts, got "${raw}"`)
    }
    const [land, rb, kreis, gemeinde] = parts.map((p) => {
      if (!/^\d+$/.test(p)) {
        throw new Error(`brandenburg-gemeinden-8: expected numeric segment, got "${raw}"`)
      }
      return p
    })
    return `${land.padStart(2, '0').slice(-2)}${rb.padStart(1, '0').slice(-1)}${kreis
      .padStart(2, '0')
      .slice(-2)}${gemeinde.padStart(3, '0').slice(-3)}`
  }
  const digits = v.replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length >= 8) return digits.slice(0, 8)
  return digits.padStart(8, '0')
}

function normalizePlz5Digits(digits: string): string {
  if (!digits) return ''
  if (digits.length >= 5) return digits.slice(0, 5)
  return digits.padStart(5, '0')
}

export function normalizeOsmValue(
  sourceKey: string,
  rawValue: string | undefined | null,
  preset: IdNormalizationPreset,
): NormalizedGermanKey {
  const raw = rawValue == null ? '' : String(rawValue)
  const digits = raw.replace(/\D/g, '')
  const notes: string[] = []

  let canonicalMatchKey = digits
  let hierarchy: NormalizedGermanKey['hierarchy'] = null
  let presetLabel: string = preset

  if (preset === 'berlin-bezirk-ags') {
    if (digits.length === 5) {
      canonicalMatchKey = berlinBezirkToCanonical(digits)
      notes.push('berlin-5-digit→8-digit-ags')
    } else if (digits.length === 8) {
      canonicalMatchKey = digits
      notes.push('already-8-digit')
    } else {
      notes.push(`unexpected-digit-length:${digits.length}`)
      canonicalMatchKey = digits
    }
    presetLabel = 'berlin-bezirk-short-to-ags8'
  } else if (preset === 'amtlicher-8') {
    canonicalMatchKey = digits.padStart(8, '0').slice(-8)
    hierarchy = digits.length === 12 ? parseRegional12(digits) : null
    presetLabel = '8-digit-ags'
  } else if (preset === 'regional-12') {
    // BKG VG250 often uses shortened ARS; OSM typically has full 12-digit keys — align to 12.
    if (digits.length >= 12) {
      canonicalMatchKey = digits.slice(0, 12)
      hierarchy = parseRegional12(canonicalMatchKey)
    } else if (digits.length > 0) {
      canonicalMatchKey = digits.padEnd(12, '0')
      hierarchy = parseRegional12(canonicalMatchKey)
      notes.push('regional-12-padded')
    } else {
      canonicalMatchKey = digits
    }
    presetLabel = 'full-12-digit-regional'
  } else if (preset === 'brandenburg-gemeinden-8') {
    if (digits.length >= 12) {
      // Brandenburg municipality compare: derive LLRKKGGG from OSM 12-digit key.
      canonicalMatchKey = `${digits.slice(0, 5)}${digits.slice(9, 12)}`
      hierarchy = parseRegional8(canonicalMatchKey)
      notes.push('bb-gemeinden-first5-plus-last3')
    } else if (digits.length === 8) {
      canonicalMatchKey = digits
      hierarchy = parseRegional8(canonicalMatchKey)
      notes.push('bb-gemeinden-already-8')
    } else {
      canonicalMatchKey = digits
      notes.push(`unexpected-digit-length:${digits.length}`)
    }
    presetLabel = 'brandenburg-gemeinden-8'
  } else if (preset === 'plz-5') {
    canonicalMatchKey = normalizePlz5Digits(digits)
    if (digits.length > 5) notes.push('plz-5-truncated')
    if (digits.length > 0 && digits.length < 5) notes.push('plz-5-left-padded')
    presetLabel = 'plz-5'
  }

  return {
    sourceKey,
    rawValue: raw,
    digits,
    canonicalMatchKey,
    hierarchy,
    preset: presetLabel,
    notes,
  }
}

export function normalizeOfficialValue(
  rawValue: string | undefined | null,
  preset: IdNormalizationPreset,
): string {
  const raw = rawValue == null ? '' : String(rawValue)
  const digits = raw.replace(/\D/g, '')
  if (preset === 'brandenburg-gemeinden-8') {
    return normalizeBrandenburgGemeindenOfficial(raw)
  }
  if (preset === 'plz-5') {
    return normalizePlz5Digits(digits)
  }
  if (preset === 'regional-12' && digits.length > 0) {
    if (digits.length >= 12) return digits.slice(0, 12)
    return digits.padEnd(12, '0')
  }
  return digits || raw.trim()
}
