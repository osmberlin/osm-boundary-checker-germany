const DAY_MS = 24 * 60 * 60 * 1000

export function isOlderThanDays(rawIso: string | null | undefined, days: number): boolean {
  if (!rawIso) return false
  const ms = Date.parse(rawIso)
  if (!Number.isFinite(ms)) return false
  return Date.now() - ms > days * DAY_MS
}
