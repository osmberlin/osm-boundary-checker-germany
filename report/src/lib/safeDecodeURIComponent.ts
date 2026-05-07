/** Router params like `featureKey` arrive URL-encoded; malformed `%` sequences make `decodeURIComponent` throw. */
export function safeDecodeURIComponent(encoded: string): string {
  try {
    return decodeURIComponent(encoded)
  } catch {
    return encoded
  }
}
