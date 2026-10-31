import { parseLiveOsmObjectRef } from './osmObjectRef'

/** Our reviewed OSM reference for a DtP area; DtP does not name this object. */
export const DTP_OVERRIDE_OSM_REF_PROPERTY = 'override_osm_ref'

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * What a reviewed DtP override changed, as the detail page shows it. `null` for a reported value
 * means DtP named none.
 */
export type DtpOverrideNotice = {
  comment: string
  /** Null for rows extracted before `override_impact` existed. */
  impact: 'matching' | 'informational' | null
  osmRef: { reported: string | null; used: string | null } | null
  wikidata: { reported: string | null; used: string } | null
}

/** The override notice of a DtP row, or `null` when no override applies (no `override_comment`). */
export function dtpOverrideNotice(
  props: Record<string, unknown> | null | undefined,
): DtpOverrideNotice | null {
  if (!props) return null
  const comment = nonEmpty(props.override_comment)
  if (comment == null) return null

  const reportedOsm = nonEmpty(props.dtp_reported_osm_ref)
  const usedOsm = nonEmpty(props[DTP_OVERRIDE_OSM_REF_PROPERTY])
  const osmRef = reportedOsm || usedOsm ? { reported: reportedOsm, used: usedOsm } : null

  const usedWikidata = nonEmpty(props.override_wikidata)
  const wikidata =
    usedWikidata == null
      ? null
      : { reported: nonEmpty(props.dtp_reported_wikidata), used: usedWikidata }

  const impact =
    props.override_impact === 'matching' || props.override_impact === 'informational'
      ? props.override_impact
      : null

  return { comment, impact, osmRef, wikidata }
}

/** Values of the DtP correction form for a row: DtP's own data, the reported values first. */
export function dtpCorrectionFormValues(props: Record<string, unknown> | null | undefined): {
  dtpUuid: string
  dtpName: string | undefined
  dtpOsmRef: string | undefined
  dtpWikidata: string | undefined
} {
  return {
    dtpUuid: nonEmpty(props?.dtp_uuid) ?? '',
    dtpName: nonEmpty(props?.name) ?? undefined,
    dtpOsmRef: nonEmpty(props?.dtp_reported_osm_ref) ?? nonEmpty(props?.dtp_osm_ref) ?? undefined,
    dtpWikidata:
      (props?.override_wikidata != null
        ? nonEmpty(props.dtp_reported_wikidata)
        : nonEmpty(props?.wikidata)) ?? undefined,
  }
}

/** `relation/123` or `way/123` of a row's OSM reference (bare relation ids included); '' otherwise. */
export function osmObjectText(raw: string | null | undefined): string {
  const ref = parseLiveOsmObjectRef(raw ?? '')
  return ref ? `${ref.type}/${ref.id}` : ''
}
