/**
 * One-line preview for error messages:
 * collapse whitespace and keep only the first `maxLength` chars.
 */
export function textPreview(input: string, maxLength = 120): string {
  return input.slice(0, maxLength).replace(/\s+/g, ' ')
}
