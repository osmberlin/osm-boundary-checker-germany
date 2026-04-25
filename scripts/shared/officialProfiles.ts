import { z } from 'zod'
import { BKG_ZIP_URL } from './bkg.ts'
import { datasetLicenseIdSchema } from './sourceMetadata.ts'

export const officialProfileIdSchema = z.enum([
  'bkg_vg25_gem',
  'bkg_vg25_krs',
  'bkg_vg25_rbz',
  'bkg_vg25_lan',
  'bkg_vg25_sta',
  'bkg_vg25_vwg',
])
export type OfficialProfileId = z.infer<typeof officialProfileIdSchema>

const officialProfileSchema = z.object({
  provider: z.string().trim().min(1),
  dataset: z.string().trim().min(1),
  extractLayer: z.string().trim().min(1),
  sourcePublicUrl: z.string().trim().url(),
  sourceDownloadUrl: z.string().trim().url(),
  licenseId: datasetLicenseIdSchema,
  licenseSourceUrl: z.string().trim().url(),
  osmCompatibility: z.enum(['unknown', 'no', 'yes_licence', 'yes_waiver']),
  osmCompatibilitySourceUrl: z.string().trim().url(),
  osmCompatibilityComment: z.string().trim().min(1),
})
export type OfficialProfile = z.infer<typeof officialProfileSchema>

const BKG_SOURCE_PUBLIC_URL =
  'https://gdz.bkg.bund.de/index.php/default/digitale-geodaten/verwaltungsgebiete/verwaltungsgebiete-1-25-000-stand-31-12-vg25.html'
const BKG_PROFILE_COMMON = {
  provider: 'BKG',
  dataset: 'VG25',
  sourcePublicUrl: BKG_SOURCE_PUBLIC_URL,
  sourceDownloadUrl: BKG_ZIP_URL,
  licenseId: 'cc_by_40',
  licenseSourceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  osmCompatibility: 'unknown',
  osmCompatibilitySourceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  osmCompatibilityComment:
    'Kompatibilitaet fuer OSM ist je Datensatz und Freigabekontext zu pruefen.',
} as const

export const OFFICIAL_PROFILES: Record<OfficialProfileId, OfficialProfile> = {
  bkg_vg25_gem: { ...BKG_PROFILE_COMMON, extractLayer: 'vg25_gem' },
  bkg_vg25_krs: { ...BKG_PROFILE_COMMON, extractLayer: 'vg25_krs' },
  bkg_vg25_rbz: { ...BKG_PROFILE_COMMON, extractLayer: 'vg25_rbz' },
  bkg_vg25_lan: { ...BKG_PROFILE_COMMON, extractLayer: 'vg25_lan' },
  bkg_vg25_sta: { ...BKG_PROFILE_COMMON, extractLayer: 'vg25_sta' },
  bkg_vg25_vwg: { ...BKG_PROFILE_COMMON, extractLayer: 'vg25_vwg' },
}

export function resolveOfficialProfile(profileId: OfficialProfileId): OfficialProfile {
  return officialProfileSchema.parse(OFFICIAL_PROFILES[profileId])
}
