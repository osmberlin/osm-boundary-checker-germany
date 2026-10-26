import { withSiteBasePath } from './siteBasePath'

/** Link to this app's relation resolver (Grenzabgleich) for an OSM relation, scoped to a dataset. */
export function relationResolverHref(dataset: string, relationId: string | number): string {
  const query = new URLSearchParams()
  const trimmed = dataset.trim()
  if (trimmed.length > 0) query.set('dataset', trimmed)
  const search = query.toString()
  return withSiteBasePath(
    `/resolve/relation/${encodeURIComponent(String(relationId))}${search ? `?${search}` : ''}`,
  )
}
