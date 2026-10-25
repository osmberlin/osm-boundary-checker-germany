/**
 * Zod schemas for the DtP API v2 responses we read and for our own cache files.
 * Only the fields the sync needs are kept; zod strips the rest.
 * Shapes checked against `.cache/dtp/2026-10-25/schema.yaml` and the cached responses.
 */

import { z } from 'zod'

export const dtpExternalReferenceSchema = z.object({
  /** `wdpa`, `wikidata`, `osm`, `outdooractive` or `source_id` (see `NameEnum`). */
  name: z.string().min(1),
  id: z.string().min(1),
  url: z.string().nullish(),
})

/** One item of `GET /protected-areas?fields=all` (no geometry). */
export const dtpListItemSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().nullable(),
  category_id: z.number().int(),
  external_references: z.array(dtpExternalReferenceSchema),
  parent_uuid: z.string().nullable(),
  /** Change marker of the area and its rules, pictures, wildlife and legal documents. */
  updated_at: z.string().min(1),
  area_in_km2: z.number(),
})

export const dtpListPageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(dtpListItemSchema),
})

/** One item of `GET /protected-areas?fields=uuid` (managed sweep). */
export const dtpUuidListPageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(z.object({ uuid: z.string().min(1) })),
})

/** `GET /organizations` item (`DtpOrganizationLite`). */
export const dtpOrganizationLiteSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  homepage: z.string().nullish(),
})

export const dtpOrganizationsPageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(dtpOrganizationLiteSchema),
})

/** `.cache/dtp/organizations.json`: one entry per DtP organization id, kept as `{ id, name, url }`. */
export const dtpOrganizationsFileSchema = z.object({
  fetchedAt: z.string().min(1),
  count: z.number().int().nonnegative(),
  organizations: z.array(
    z.object({
      id: z.number().int(),
      name: z.string(),
      url: z.string().nullable(),
    }),
  ),
})

/** Ring of a MultiPolygon: at least four positions (closed), each `[lon, lat]` or `[lon, lat, z]`. */
const dtpPolygonRingSchema = z.array(z.array(z.number()).min(2)).min(4)

export const dtpGeodataSchema = z.object({
  geometry: z.object({
    type: z.literal('MultiPolygon'),
    /** MultiPolygon: polygons → rings → positions → numbers. */
    coordinates: z.array(z.array(dtpPolygonRingSchema)),
  }),
  centroid: z
    .object({
      type: z.literal('Point'),
      coordinates: z.array(z.number()).min(2),
    })
    .nullish(),
  source: z
    .object({
      id: z.number().int(),
      name: z.string(),
      acronym: z.string().nullish(),
      url: z.string().nullish(),
    })
    .nullish(),
  license: z
    .object({
      name: z.string(),
      uri: z.string().nullish(),
    })
    .nullish(),
})

/**
 * `GET /protected-areas/{uuid}?fields=<DTP_DETAIL_FIELDS>`.
 * `geodata` is nullable in the API schema; a null value is kept in the cache and reported as "no geometry".
 */
export const dtpDetailSchema = z.object({
  name: z.string().nullable(),
  category_id: z.number().int(),
  external_references: z.array(dtpExternalReferenceSchema),
  state_ids: z.array(z.number().int()),
  parent_uuid: z.string().nullable(),
  updated_at: z.string().min(1),
  area_in_km2: z.number(),
  geodata: dtpGeodataSchema.nullable(),
  /**
   * Organization ids of a managed area (`[]` for unmanaged). Optional because records fetched before this field
   * was requested lack it; `plan.ts` backfills managed areas without it.
   */
  responsible_organization_ids: z.array(z.number().int()).nullish(),
})

/** `GET /protected-areas/deleted?deleted_after=YYYY-MM-DD`. */
export const dtpDeletedItemSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().nullable(),
  deleted_at: z.string().nullable(),
})

export const dtpDeletedPageSchema = z.object({
  count: z.number().int().nonnegative(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(dtpDeletedItemSchema),
})

/** One line of `.cache/dtp/areas.ndjson.gz`. */
export const dtpCachedRecordSchema = z.object({
  uuid: z.string().min(1),
  /** When `detail` was fetched (ISO instant). Drives the rolling re-verify. */
  fetchedAt: z.string().min(1),
  /** `updated_at` from the list item at fetch time. */
  listUpdatedAt: z.string().min(1),
  /** `area_in_km2` from the list item at fetch time (geometry fingerprint). */
  listAreaKm2: z.number(),
  detail: dtpDetailSchema,
})

/** A list item plus `managed` from the managed sweep (`include_unmanaged=false`). */
export const dtpInventoryItemSchema = dtpListItemSchema.extend({
  /** True when the uuid is in the managed sweep. Carried over from the previous inventory if that sweep failed. */
  managed: z.boolean(),
})

/** `.cache/dtp/inventory.json`: the list sweep, the source of truth for which uuids exist. */
export const dtpInventorySchema = z.object({
  fetchedAt: z.string().min(1),
  /** `count` reported by the first list page. */
  serverCount: z.number().int().nonnegative(),
  pageCount: z.number().int().nonnegative(),
  /** List items whose uuid was already seen on an earlier page of the same sweep. */
  duplicateCount: z.number().int().nonnegative(),
  items: z.array(dtpInventoryItemSchema),
})

/** `.cache/dtp/download-metadata.json`. */
export const dtpDownloadMetadataSchema = z.object({
  /** Max `updated_at` over the inventory. */
  sourceUpdatedAt: z.string().min(1),
  /** When the list sweep that confirmed `sourceUpdatedAt` finished. */
  sourceUpdatedAtVerifiedAt: z.string().min(1),
  /** When this sync run started. */
  downloadedAt: z.string().min(1),
  inventoryCount: z.number().int().nonnegative(),
  cachedCount: z.number().int().nonnegative(),
  /** Candidates that were due in this run but not fetched successfully (cap, `--limit`, errors). */
  pendingDetailCount: z.number().int().nonnegative(),
  lastRunFetched: z.number().int().nonnegative(),
  /** Inventory items with `managed: true`. */
  managedCount: z.number().int().nonnegative(),
  /** `count` of the managed sweep's first page. */
  managedServerCount: z.number().int().nonnegative(),
  /** False when the managed sweep was short or failed; `managed` values then come from the previous inventory. */
  managedSweepComplete: z.boolean(),
})

export type DtpExternalReference = z.infer<typeof dtpExternalReferenceSchema>
export type DtpListItem = z.infer<typeof dtpListItemSchema>
export type DtpListPage = z.infer<typeof dtpListPageSchema>
export type DtpUuidListPage = z.infer<typeof dtpUuidListPageSchema>
export type DtpOrganizationLite = z.infer<typeof dtpOrganizationLiteSchema>
export type DtpOrganizationsFile = z.infer<typeof dtpOrganizationsFileSchema>
export type DtpInventoryItem = z.infer<typeof dtpInventoryItemSchema>
export type DtpGeodata = z.infer<typeof dtpGeodataSchema>
export type DtpDetail = z.infer<typeof dtpDetailSchema>
export type DtpDeletedItem = z.infer<typeof dtpDeletedItemSchema>
export type DtpDeletedPage = z.infer<typeof dtpDeletedPageSchema>
export type DtpCachedRecord = z.infer<typeof dtpCachedRecordSchema>
export type DtpInventory = z.infer<typeof dtpInventorySchema>
export type DtpDownloadMetadata = z.infer<typeof dtpDownloadMetadataSchema>
