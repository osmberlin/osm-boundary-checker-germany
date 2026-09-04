import rawAreasIndex from './areasIndex.gen'
import {
  areasIndexPayloadSchema,
  type AreaLicenseSummary,
  type AreaSummary,
  type AreasIndexPayload,
  type GeoDataSource,
} from './areasIndexSchema'

export type { AreaLicenseSummary, AreaSummary, AreasIndexPayload, GeoDataSource }

export const areasIndex: AreasIndexPayload = areasIndexPayloadSchema.parse(rawAreasIndex)
