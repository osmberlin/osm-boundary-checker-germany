/** `official.extractFilter` (direct and profile mode) after trimming (see `normalizeExtractFilter`). */
export type NormalizedExtractFilter = {
  property: string
  /** Keep only features whose property value starts with this prefix (`ARS LIKE '09%'`). */
  valuePrefix?: string
  /** Drop features whose property value equals one of these (exact match after trim). */
  excludeValues?: string[]
}

/** Trim a config `official.extractFilter`; null when it has no usable condition. */
export function normalizeExtractFilter(
  filter: NormalizedExtractFilter | undefined,
): NormalizedExtractFilter | null {
  if (!filter) return null
  const property = filter.property.trim()
  const valuePrefix = filter.valuePrefix?.trim() || undefined
  const excludeValues = (filter.excludeValues ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
  if (!property || (!valuePrefix && excludeValues.length === 0)) return null
  return {
    property,
    ...(valuePrefix ? { valuePrefix } : {}),
    ...(excludeValues.length > 0 ? { excludeValues } : {}),
  }
}

/** SQL WHERE (GPKG/SQLite dialect) for `ogr2ogr -where`. Empty string when nothing applies. */
export function extractFilterWhereClause(filter: NormalizedExtractFilter): string {
  const conditions: string[] = []
  if (filter.valuePrefix) {
    conditions.push(`${filter.property} LIKE '${sqlEscape(filter.valuePrefix)}%'`)
  }
  if (filter.excludeValues && filter.excludeValues.length > 0) {
    const list = filter.excludeValues.map((value) => `'${sqlEscape(value)}'`).join(', ')
    // NULL values are not excluded: `NULL NOT IN (...)` would drop them.
    conditions.push(`(${filter.property} IS NULL OR TRIM(${filter.property}) NOT IN (${list}))`)
  }
  return conditions.join(' AND ')
}

function sqlEscape(value: string): string {
  return value.replaceAll("'", "''")
}
