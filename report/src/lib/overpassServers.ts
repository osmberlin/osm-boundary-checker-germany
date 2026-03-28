/**
 * Public Overpass API interpreter URLs (same set as common UIs, e.g. Overpass Turbo).
 * @see https://wiki.openstreetmap.org/wiki/Overpass_API
 */
export const OVERPASS_INSTANCES = [
  { interpreterUrl: 'https://overpass-api.de/api/interpreter' },
  {
    interpreterUrl: 'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  },
  {
    interpreterUrl: 'https://overpass.openstreetmap.ru/api/interpreter',
  },
  {
    interpreterUrl: 'https://overpass.kumi.systems/api/interpreter',
  },
] as const

export const DEFAULT_OVERPASS_INTERPRETER_URL: string = OVERPASS_INSTANCES[0].interpreterUrl

/** Allowlisted interpreter URLs (used before direct browser `fetch`). */
export const ALLOWED_OVERPASS_INTERPRETER_URLS: ReadonlySet<string> = new Set(
  OVERPASS_INSTANCES.map((i) => i.interpreterUrl),
)
