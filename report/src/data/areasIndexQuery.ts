import { queryOptions } from '@tanstack/react-query'
import { areasIndexUrl } from './paths'

export type AreaSummary = {
  area: string
  displayName: string
  matched: number
  officialOnly: number
  unmatchedOsm: number
}

export type GeoDataSource = {
  name: string
  href?: string
}

export type AreaLicenseSummary = {
  area: string
  displayName: string
  officialLicenseLabel: string
  officialLicenseSourceUrl?: string
  officialOsmCompatibility: 'unknown' | 'no' | 'yes_licence' | 'yes_waiver'
  officialOsmCompatibilitySourceUrl?: string
  officialOsmCompatibilityComment?: string
}

export type AreasIndexPayload = {
  areas: string[]
  summaries: AreaSummary[]
  geoDataSources: GeoDataSource[]
  licenseSummaries: AreaLicenseSummary[]
}

function parseAreaSummary(raw: unknown): AreaSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const area = typeof rec.area === 'string' ? rec.area : null
  if (!area) return null
  return {
    area,
    displayName:
      typeof rec.displayName === 'string' && rec.displayName.trim() !== ''
        ? rec.displayName.trim()
        : area,
    matched: typeof rec.matched === 'number' ? rec.matched : 0,
    officialOnly: typeof rec.officialOnly === 'number' ? rec.officialOnly : 0,
    unmatchedOsm: typeof rec.unmatchedOsm === 'number' ? rec.unmatchedOsm : 0,
  }
}

function parseGeoDataSource(raw: unknown): GeoDataSource | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const name = typeof rec.name === 'string' ? rec.name.trim() : ''
  if (!name) return null
  const href = typeof rec.href === 'string' ? rec.href.trim() : ''
  return href ? { name, href } : { name }
}

function parseAreaLicenseSummary(raw: unknown): AreaLicenseSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const area = typeof rec.area === 'string' ? rec.area.trim() : ''
  if (!area) return null
  const displayName =
    typeof rec.displayName === 'string' && rec.displayName.trim() !== ''
      ? rec.displayName.trim()
      : area
  const officialLicenseLabel =
    typeof rec.officialLicenseLabel === 'string' && rec.officialLicenseLabel.trim() !== ''
      ? rec.officialLicenseLabel.trim()
      : 'unknown'
  const compatibility =
    rec.officialOsmCompatibility === 'no' ||
    rec.officialOsmCompatibility === 'yes_licence' ||
    rec.officialOsmCompatibility === 'yes_waiver'
      ? rec.officialOsmCompatibility
      : 'unknown'
  const officialLicenseSourceUrl =
    typeof rec.officialLicenseSourceUrl === 'string' && rec.officialLicenseSourceUrl.trim() !== ''
      ? rec.officialLicenseSourceUrl.trim()
      : undefined
  const officialOsmCompatibilitySourceUrl =
    typeof rec.officialOsmCompatibilitySourceUrl === 'string' &&
    rec.officialOsmCompatibilitySourceUrl.trim() !== ''
      ? rec.officialOsmCompatibilitySourceUrl.trim()
      : undefined
  const officialOsmCompatibilityComment =
    typeof rec.officialOsmCompatibilityComment === 'string' &&
    rec.officialOsmCompatibilityComment.trim() !== ''
      ? rec.officialOsmCompatibilityComment.trim()
      : undefined
  return {
    area,
    displayName,
    officialLicenseLabel,
    ...(officialLicenseSourceUrl ? { officialLicenseSourceUrl } : {}),
    officialOsmCompatibility: compatibility,
    ...(officialOsmCompatibilitySourceUrl ? { officialOsmCompatibilitySourceUrl } : {}),
    ...(officialOsmCompatibilityComment ? { officialOsmCompatibilityComment } : {}),
  }
}

export async function loadAreasIndex(): Promise<AreasIndexPayload> {
  const response = await fetch(areasIndexUrl())
  if (!response.ok) throw new Error(`Failed to load areas index: ${response.status}`)
  const body = (await response.json()) as {
    areas?: unknown
    summaries?: unknown
    geoDataSources?: unknown
    licenseSummaries?: unknown
  }

  const areas = Array.isArray(body.areas)
    ? body.areas.filter((x): x is string => typeof x === 'string')
    : []
  const summaries = Array.isArray(body.summaries)
    ? body.summaries.map(parseAreaSummary).filter((x): x is AreaSummary => x != null)
    : []
  const geoDataSources = Array.isArray(body.geoDataSources)
    ? body.geoDataSources.map(parseGeoDataSource).filter((x): x is GeoDataSource => x != null)
    : []
  const licenseSummaries = Array.isArray(body.licenseSummaries)
    ? body.licenseSummaries
        .map(parseAreaLicenseSummary)
        .filter((x): x is AreaLicenseSummary => x != null)
    : []

  return { areas, summaries, geoDataSources, licenseSummaries }
}

export function areasIndexQueryOptions() {
  return queryOptions({
    queryKey: ['areas-index'],
    queryFn: loadAreasIndex,
  })
}
