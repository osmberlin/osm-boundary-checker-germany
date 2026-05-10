/**
 * Discussion registry rows use GitHub issue titles as the match key.
 * Same normalization must be applied to browser pathnames when comparing.
 */
export function normalizeDiscussMatchString(input: string): string {
  const t = input.trim()
  if (t.length > 1 && t.endsWith('/')) {
    return t.slice(0, -1)
  }
  return t
}
