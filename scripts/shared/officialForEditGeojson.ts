/** FNV-1a 32-bit — stable short id when the key sanitizes to empty. */
function stableIdFromString(str: string): string {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Lowercase, then keep only `a-z`, digits, `_`, `-` (filesystem- and URL-friendly).
 */
export function sanitizeOfficialForEditFileStem(canonicalMatchKey: string): string {
  const s = canonicalMatchKey.toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (s.length > 0) return s
  return `key_${stableIdFromString(canonicalMatchKey)}`
}

/**
 * Map each canonical key (in order) to a unique file stem (no extension).
 * Colliding sanitized names get `_2`, `_3`, … suffixes.
 */
export function assignOfficialForEditStems(canonicalMatchKeys: string[]): Map<string, string> {
  const result = new Map<string, string>()
  const occurrence = new Map<string, number>()
  for (const key of canonicalMatchKeys) {
    const base = sanitizeOfficialForEditFileStem(key)
    const n = occurrence.get(base) ?? 0
    occurrence.set(base, n + 1)
    const stem = n === 0 ? base : `${base}_${n + 1}`
    result.set(key, stem)
  }
  return result
}

export function officialForEditGeojsonBasename(stem: string): string {
  return `${stem}.geojson`
}
