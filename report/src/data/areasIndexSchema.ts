import { z } from 'zod'
import { osmProfileIdSchema } from '../../../scripts/shared/osmProfiles.ts'
import { sourceKindSchema } from '../../../scripts/shared/sourceKind.ts'

export const geoDataSourceSchema = z.object({
  name: z.string().min(1),
  href: z.string().optional(),
})
export type GeoDataSource = z.infer<typeof geoDataSourceSchema>

export const areaHomeSummarySchema = z.object({
  area: z.string().min(1),
  displayName: z.string().min(1),
  matched: z.number(),
  officialOnly: z.number(),
  unmatchedOsm: z.number(),
  reviews: z.number(),
  issues: z.number(),
  staleOfficialKey: z.number().optional(),
  /** OSM profile of the dataset; drives the home page grouping. */
  osmProfile: osmProfileIdSchema.optional(),
  osmMatchProperties: z.array(z.string().min(1)).min(1).optional(),
  osmAdminLevels: z.array(z.string().min(1)).optional(),
  /** Wording of the official side on the home card; absent means `official`. */
  sourceKind: sourceKindSchema.optional(),
})
export type AreaHomeSummary = z.infer<typeof areaHomeSummarySchema>
export type AreaSummary = AreaHomeSummary

export const areaLicenseSummarySchema = z.object({
  area: z.string().min(1),
  displayName: z.string().min(1),
  officialSourceGroupKey: z.string().min(1),
  officialLicenseLabel: z.string().min(1),
  officialLicenseSourceUrl: z.string().optional(),
  officialOsmCompatibility: z.enum(['unknown', 'no', 'yes_licence', 'yes_waiver', 'partial']),
  officialOsmCompatibilitySourceUrl: z.string().optional(),
  officialOsmCompatibilityComment: z.string().optional(),
  /** Set when the dataset has a licence per geometry (`licenseBreakdown`): rows that may go into OSM vs. all rows. */
  officialLicenseMixed: z
    .object({
      compatibleCount: z.number().int().nonnegative(),
      totalCount: z.number().int().nonnegative(),
      /** Set when every geometry carries the same licence (e.g. all BfN GeoNutzV). */
      singleLicenseLabel: z.string().optional(),
    })
    .optional(),
})
export type AreaLicenseSummary = z.infer<typeof areaLicenseSummarySchema>

export const areasIndexPayloadSchema = z.object({
  areas: z.array(z.string()),
  summaries: z.array(areaHomeSummarySchema),
  geoDataSources: z.array(geoDataSourceSchema),
  licenseSummaries: z.array(areaLicenseSummarySchema),
})
export type AreasIndexPayload = z.infer<typeof areasIndexPayloadSchema>
