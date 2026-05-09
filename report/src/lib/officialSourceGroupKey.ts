import { BKG_ZIP_URL } from '../../../scripts/shared/bkg.ts'
import type { DatasetConfig } from '../../../scripts/shared/datasetConfig.ts'

/** Canonical group key for all BKG VG250 WFS profile variants (`bkg_vg25_*`). */
export const OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25 = 'preset:bkg_vg25' as const

const BKG_VG25_PROFILE_PREFIX = 'bkg_vg25_'

const BKG_VG25_ZIP_HREF = new URL(BKG_ZIP_URL).href

/**
 * True when persisted `sourceDownloadUrl` refers to BKG VG25 (ZIP product or VG25 WFS endpoint).
 * Aligns direct-mode areas with profile-mode `preset:bkg_vg25` for homepage licence grouping.
 */
export function isBkgVg25OfficialDownloadHref(normalizedHref: string): boolean {
  try {
    const u = new URL(normalizedHref)
    const host = u.hostname.toLowerCase()
    const pathLower = u.pathname.toLowerCase()
    if (normalizedHref === BKG_VG25_ZIP_HREF) return true
    if (host === 'daten.gdz.bkg.bund.de' && pathLower.includes('vg25_ebenen')) return true
    if (host === 'sgx.geodatenzentrum.de' && pathLower.includes('wfs_vg25')) return true
    return false
  } catch {
    return false
  }
}

/** Normalizes official download URLs for stable grouping (trimmed absolute href). */
export function normalizedOfficialDownloadUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  try {
    return new URL(t).href
  } catch {
    return null
  }
}

/**
 * Internal key for merging homepage licence rows by official source.
 * Not intended for end-user display.
 */
export function officialSourceGroupKey(
  config: DatasetConfig,
  officialSourceDownloadUrl: string | undefined,
  areaSlugForFallback: string,
): string {
  if (config.officialMode === 'profile') {
    const id = config.officialProfile
    if (id.startsWith(BKG_VG25_PROFILE_PREFIX)) {
      return OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25
    }
    return `preset:${id}`
  }
  const norm =
    officialSourceDownloadUrl != null
      ? normalizedOfficialDownloadUrl(officialSourceDownloadUrl)
      : null
  if (norm && isBkgVg25OfficialDownloadHref(norm)) {
    return OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25
  }
  if (norm) {
    return `download:${norm}`
  }
  return `download:missing:${areaSlugForFallback}`
}

/** When area config cannot be read: group by download URL only, else isolate by area. */
export function fallbackOfficialSourceGroupKey(
  officialSourceDownloadUrl: string | undefined,
  areaSlugForFallback: string,
): string {
  const norm =
    officialSourceDownloadUrl != null
      ? normalizedOfficialDownloadUrl(officialSourceDownloadUrl)
      : null
  if (norm && isBkgVg25OfficialDownloadHref(norm)) {
    return OFFICIAL_SOURCE_GROUP_KEY_BKG_VG25
  }
  if (norm) {
    return `download:${norm}`
  }
  return `fallback:${areaSlugForFallback}`
}

export type OfficialLicenseTupleParts = {
  officialLicenseLabel: string
  officialLicenseSourceUrl?: string
  officialOsmCompatibility: string
  officialOsmCompatibilitySourceUrl?: string
  officialOsmCompatibilityComment?: string
}

export function officialLicenseTupleFingerprint(parts: OfficialLicenseTupleParts): string {
  return [
    parts.officialLicenseLabel,
    parts.officialLicenseSourceUrl ?? '',
    parts.officialOsmCompatibility,
    parts.officialOsmCompatibilitySourceUrl ?? '',
    parts.officialOsmCompatibilityComment ?? '',
  ].join('\x1f')
}

/** Groups rows only when source key and licence/OSM-compat metadata agree. */
export function officialLicenseTableMergeKey(
  sourceGroupKey: string,
  parts: OfficialLicenseTupleParts,
): string {
  return `${sourceGroupKey}\x1f${officialLicenseTupleFingerprint(parts)}`
}
