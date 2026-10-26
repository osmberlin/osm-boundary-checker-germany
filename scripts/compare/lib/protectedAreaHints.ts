import type { AttributeHint } from '../../shared/comparisonPayload.ts'

function trimmed(raw: unknown): string {
  return raw == null ? '' : String(raw).trim()
}

/** `way/1` / `relation/1` from a DtP `osm` ref or an OSM `@id`; null for anything else. */
function osmObjectRef(raw: unknown): string | null {
  const m = /(way|relation|node)\/(\d+)/i.exec(trimmed(raw))
  return m ? `${m[1]!.toLowerCase()}/${m[2]}` : null
}

function osmObjectRefFromProps(props: Record<string, unknown>): string | null {
  const fromId = osmObjectRef(props['@id'])
  if (fromId) return fromId
  const way = trimmed(props.osm_way_id)
  if (/^\d+$/.test(way) && way !== '0') return `way/${way}`
  const relation = trimmed(props.osm_id).replace(/^-/, '')
  if (/^\d+$/.test(relation) && relation !== '0') return `relation/${relation}`
  return null
}

/**
 * Notes for a matched protected-area row that its attribute checks (`compare.attributeChecks`:
 * Wikidata, name, WDPA-ID, Natura 2000, category) do not cover. Nothing here changes the match or
 * its metrics.
 */
export function computeProtectedAreaAttributeHints(input: {
  officialProperties: Record<string, unknown> | null
  osmProperties: Record<string, unknown> | null
}): AttributeHint[] {
  const official = input.officialProperties
  const osm = input.osmProperties
  if (!official || !osm) return []
  const hints: AttributeHint[] = []

  const dtpRef = osmObjectRef(official.dtp_osm_ref)
  const osmRef = osmObjectRefFromProps(osm)
  if (dtpRef && osmRef && dtpRef !== osmRef) {
    hints.push({ id: 'osm_ref_differs', target: 'osm', expected: [dtpRef], actual: [osmRef] })
  }

  return hints
}
