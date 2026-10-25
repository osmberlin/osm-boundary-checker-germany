/**
 * Pure selection and row building for `dtp/extract.ts`: cached DtP records -> official FlatGeobuf features.
 * No file I/O here.
 */

import type { DtpSelection } from '../../shared/dtpOfficial.ts'
import { dtpAreaApiUrl } from '../../shared/dtpOfficial.ts'
import type { DtpCachedRecord, DtpExternalReference, DtpListItem } from './schemas.ts'

/** Natura 2000 site code, for example `DE5519304`. */
const NATURA2000_CODE = /^DE\d{7}$/

export type DtpCategoryNames = ReadonlyMap<number, string>

export type DtpOfficialProperties = {
  wdpa: string
  dtp_uuid: string
  name: string | null
  category_id: number
  category_name: string | null
  /** DtP `osm` reference, for example `relation/123`. */
  dtp_osm_ref: string | null
  wikidata: string | null
  natura2000_code: string | null
  parent_uuid: string | null
  /** Comma-separated DtP state ids. */
  state_ids: string | null
  geometry_source_name: string | null
  geometry_source_url: string | null
  geometry_license_name: string | null
  geometry_license_url: string | null
  dtp_url: string
}

export type DtpOfficialFeature = {
  type: 'Feature'
  properties: DtpOfficialProperties
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] }
}

export type DtpSelectionStats = {
  /** Inventory areas that match the dataset selection (category, wdpa). */
  selectedInInventory: number
  /** Selected areas without a cache record yet (harvest incomplete). */
  missingFromCache: number
  /** Cache records of selected areas without usable geometry. */
  noGeometry: number
  /** Features written to the dataset. */
  written: number
  /** `wdpa` -> uuids, only ids shared by more than one written area. */
  duplicateWdpa: Map<string, string[]>
}

function referenceId(refs: DtpExternalReference[], name: string): string | null {
  const found = refs.find((ref) => ref.name === name)
  const id = found?.id.trim()
  return id ? id : null
}

export function wdpaFromReferences(refs: DtpExternalReference[]): string | null {
  return referenceId(refs, 'wdpa')
}

export function natura2000CodeFromReferences(refs: DtpExternalReference[]): string | null {
  for (const ref of refs) {
    if (ref.name === 'source_id' && NATURA2000_CODE.test(ref.id.trim())) return ref.id.trim()
  }
  return null
}

/** Inventory areas selected by the dataset config (by category and, if required, `wdpa`). */
export function selectInventoryItems(items: DtpListItem[], selection: DtpSelection): DtpListItem[] {
  const categories = new Set(selection.categoryIds)
  return items.filter((item) => {
    if (!categories.has(item.category_id)) return false
    if (selection.requireWdpa && wdpaFromReferences(item.external_references) === null) return false
    return true
  })
}

export function officialFeatureFromRecord(
  record: DtpCachedRecord,
  categoryNames: DtpCategoryNames,
): DtpOfficialFeature | null {
  const { detail } = record
  const geometry = detail.geodata?.geometry
  if (!geometry || geometry.coordinates.length === 0) return null
  const refs = detail.external_references
  const source = detail.geodata?.source
  const license = detail.geodata?.license
  return {
    type: 'Feature',
    properties: {
      // Empty string when `requireWdpa` is off; compare drops rows without a key.
      wdpa: wdpaFromReferences(refs) ?? '',
      dtp_uuid: record.uuid,
      name: detail.name,
      category_id: detail.category_id,
      category_name: categoryNames.get(detail.category_id) ?? null,
      dtp_osm_ref: referenceId(refs, 'osm'),
      wikidata: referenceId(refs, 'wikidata'),
      natura2000_code: natura2000CodeFromReferences(refs),
      parent_uuid: detail.parent_uuid,
      state_ids: detail.state_ids.length > 0 ? detail.state_ids.join(',') : null,
      geometry_source_name: source?.name ?? null,
      geometry_source_url: source?.url ?? null,
      geometry_license_name: license?.name ?? null,
      geometry_license_url: license?.uri ?? null,
      dtp_url: dtpAreaApiUrl(record.uuid),
    },
    geometry: { type: 'MultiPolygon', coordinates: geometry.coordinates },
  }
}

/**
 * Build the official features for one dataset selection.
 * `recordsByUuid` may hold more than the selection (and may lag behind the inventory while a harvest runs).
 */
export function buildOfficialFeatures(
  inventoryItems: DtpListItem[],
  recordsByUuid: ReadonlyMap<string, DtpCachedRecord>,
  selection: DtpSelection,
  categoryNames: DtpCategoryNames,
): { features: DtpOfficialFeature[]; stats: DtpSelectionStats } {
  const selected = selectInventoryItems(inventoryItems, selection)
  const features: DtpOfficialFeature[] = []
  let missingFromCache = 0
  let noGeometry = 0
  for (const item of selected) {
    const record = recordsByUuid.get(item.uuid)
    if (!record) {
      missingFromCache++
      continue
    }
    const feature = officialFeatureFromRecord(record, categoryNames)
    if (!feature) {
      noGeometry++
      continue
    }
    features.push(feature)
  }
  features.sort((a, b) =>
    a.properties.dtp_uuid < b.properties.dtp_uuid
      ? -1
      : a.properties.dtp_uuid > b.properties.dtp_uuid
        ? 1
        : 0,
  )

  const byWdpa = new Map<string, string[]>()
  for (const feature of features) {
    const wdpa = feature.properties.wdpa
    if (!wdpa) continue
    const list = byWdpa.get(wdpa)
    if (list) list.push(feature.properties.dtp_uuid)
    else byWdpa.set(wdpa, [feature.properties.dtp_uuid])
  }
  const duplicateWdpa = new Map([...byWdpa].filter(([, uuids]) => uuids.length > 1))

  return {
    features,
    stats: {
      selectedInInventory: selected.length,
      missingFromCache,
      noGeometry,
      written: features.length,
      duplicateWdpa,
    },
  }
}
