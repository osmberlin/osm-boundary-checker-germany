import { z } from 'zod'

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
  osmMatchProperties: z.array(z.string().min(1)).min(1).optional(),
  osmAdminLevels: z.array(z.string().min(1)).optional(),
})
export type AreaHomeSummary = z.infer<typeof areaHomeSummarySchema>
export type AreaSummary = AreaHomeSummary

export const areaLicenseSummarySchema = z.object({
  area: z.string().min(1),
  displayName: z.string().min(1),
  officialSourceGroupKey: z.string().min(1),
  officialLicenseLabel: z.string().min(1),
  officialLicenseSourceUrl: z.string().optional(),
  officialOsmCompatibility: z.enum(['unknown', 'no', 'yes_licence', 'yes_waiver']),
  officialOsmCompatibilitySourceUrl: z.string().optional(),
  officialOsmCompatibilityComment: z.string().optional(),
})
export type AreaLicenseSummary = z.infer<typeof areaLicenseSummarySchema>

export const areasIndexPayloadSchema = z.object({
  areas: z.array(z.string()),
  summaries: z.array(areaHomeSummarySchema),
  geoDataSources: z.array(geoDataSourceSchema),
  licenseSummaries: z.array(areaLicenseSummarySchema),
})
export type AreasIndexPayload = z.infer<typeof areasIndexPayloadSchema>
