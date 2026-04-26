import { z } from 'zod'
import {
  GERMANY_OSM_SHARED_FGB_BASENAME,
  GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
} from './germanyOsmPbf.ts'

export const osmProfileIdSchema = z.enum(['admin_rs', 'admin_name', 'postal_code'])
export type OsmProfileId = z.infer<typeof osmProfileIdSchema>

const osmProfileSchema = z.object({
  sharedFgbBasename: z.string().trim().min(1),
  matchProperty: z.string().trim().min(1),
})

export type OsmProfile = z.infer<typeof osmProfileSchema>

export const OSM_PROFILES: Record<OsmProfileId, OsmProfile> = {
  admin_rs: {
    sharedFgbBasename: GERMANY_OSM_SHARED_FGB_BASENAME,
    matchProperty: 'de:regionalschluessel',
  },
  admin_name: {
    sharedFgbBasename: GERMANY_OSM_SHARED_FGB_BASENAME,
    matchProperty: 'name',
  },
  postal_code: {
    sharedFgbBasename: GERMANY_OSM_SHARED_PLZ_FGB_BASENAME,
    matchProperty: 'postal_code',
  },
}

export function resolveOsmProfile(profileId: OsmProfileId): OsmProfile {
  return osmProfileSchema.parse(OSM_PROFILES[profileId])
}
