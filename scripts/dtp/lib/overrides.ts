/**
 * Applies the reviewed DtP overrides (`data/dtp-overrides/overrides.json`, schema in
 * `shared/dtpOverrides.ts`) to the official features of one dataset. Pure: no file I/O.
 *
 * Each change has a guard: it applies only while DtP still holds the value we reviewed
 * (`reportedOsmRef` for `osmRef`, `reportedWikidata` for `wikidata`). When DtP changed that value the
 * feature keeps DtP's data and the change is reported as outdated, so the entry can be removed or updated.
 */
import { normalizeOsmObjectRef } from '../../compare/lib/runMatchRules.ts'
import type { DtpOverride } from '../../shared/dtpOverrides.ts'
import type { DtpOfficialFeature } from './officialRows.ts'

export type DtpOverridePart = 'osmRef' | 'wikidata'

/** One feature that an override entry touched, with the parts that were applied or are outdated. */
export type DtpOverrideHit = { dtpUuid: string; name: string; parts: DtpOverridePart[] }

export type DtpOverrideOutcome = {
  features: DtpOfficialFeature[]
  /** Features where at least one change was applied (its guard passed). */
  applied: DtpOverrideHit[]
  /** Features where a change's guard failed: DtP changed the reviewed value. */
  outdated: DtpOverrideHit[]
}

export function applyDtpOverrides(
  features: readonly DtpOfficialFeature[],
  overrides: readonly DtpOverride[],
): DtpOverrideOutcome {
  const byUuid = new Map(overrides.map((entry) => [entry.dtpUuid, entry]))
  const applied: DtpOverrideHit[] = []
  const outdated: DtpOverrideHit[] = []
  const out = features.map((feature): DtpOfficialFeature => {
    const entry = byUuid.get(feature.properties.dtp_uuid)
    if (!entry) return feature
    const properties = { ...feature.properties }
    const appliedParts: DtpOverridePart[] = []
    const outdatedParts: DtpOverridePart[] = []

    if (entry.osmRef !== undefined) {
      const current = feature.properties.dtp_osm_ref
      const guard =
        normalizeOsmObjectRef(current) === normalizeOsmObjectRef(entry.reportedOsmRef ?? null)
      if (guard) {
        appliedParts.push('osmRef')
        properties.dtp_reported_osm_ref = current
        properties.dtp_osm_ref = null
        if (entry.osmRef !== null) properties.override_osm_ref = entry.osmRef
      } else {
        outdatedParts.push('osmRef')
      }
    }

    if (entry.wikidata !== undefined) {
      const current = feature.properties.wikidata
      if (current === (entry.reportedWikidata ?? null)) {
        appliedParts.push('wikidata')
        properties.dtp_reported_wikidata = current
        properties.override_wikidata = entry.wikidata
        properties.wikidata = entry.wikidata
      } else {
        outdatedParts.push('wikidata')
      }
    }

    const hit = { dtpUuid: entry.dtpUuid, name: entry.name }
    if (outdatedParts.length > 0) outdated.push({ ...hit, parts: outdatedParts })
    if (appliedParts.length === 0) return feature
    properties.override_comment = entry.comment
    applied.push({ ...hit, parts: appliedParts })
    return { ...feature, properties }
  })
  return { features: out, applied, outdated }
}
