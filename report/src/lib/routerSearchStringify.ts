import { defaultStringifySearch } from '@tanstack/react-router'

/** Keep selected query values human-readable in the URL bar. */
const PRETTY_VALUE_KEYS = new Set(['map'])

function encodeQueryValueForKey(key: string, decodedValue: string): string {
  if (PRETTY_VALUE_KEYS.has(key)) {
    return encodeURIComponent(decodedValue).replaceAll('%2F', '/')
  }
  return encodeURIComponent(decodedValue)
}

/**
 * TanStack `stringifySearch` replacement that keeps `map=z/lat/lon` readable
 * (slashes stay visible instead of `%2F`).
 */
export function stringifySearchPretty(search: Record<string, unknown>): string {
  const defaultQs = defaultStringifySearch(search)
  if (!defaultQs) return ''
  const raw = defaultQs.startsWith('?') ? defaultQs.slice(1) : defaultQs
  if (!raw) return ''

  const params = new URLSearchParams(raw)
  const parts: string[] = []
  for (const [key, value] of params.entries()) {
    parts.push(`${encodeURIComponent(key)}=${encodeQueryValueForKey(key, value)}`)
  }
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}
