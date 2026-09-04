import type { RegionalHubMismatchFlag } from './regionalHubPayload.ts'

export type RegionalHubCompareInput = {
  destatisPop?: number
  destatisDate?: string
  osmPop?: number
  osmDate?: string
  osmWikidata?: string
  osmId?: string
  wdQid?: string
  wdPop?: number
  wdDate?: string
  wdOsmRelationId?: string
}

function normalizeIsoDate(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10)
  if (/^\d{4}$/.test(trimmed)) return `${trimmed}-12-31`
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed)
  if (de) {
    return `${de[3]}-${de[2]!.padStart(2, '0')}-${de[1]!.padStart(2, '0')}`
  }
  return undefined
}

export function parsePopulationNumber(raw: string | number | undefined | null): number | undefined {
  if (raw === null || raw === undefined) return undefined
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw)
  const digits = String(raw).replace(/\D/g, '')
  if (digits === '') return undefined
  const n = Number(digits)
  return Number.isFinite(n) ? n : undefined
}

export function numericOsmRelationId(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const match = /(?:relation\/)?(\d+)/i.exec(raw.trim())
  return match?.[1]
}

function p402Agrees(osmId: string | undefined, wdOsmRelationId: string | undefined): boolean {
  if (!wdOsmRelationId) return true
  const osm = numericOsmRelationId(osmId)
  const wd = numericOsmRelationId(wdOsmRelationId)
  if (!osm || !wd) return true
  return osm === wd
}

function dateIsOlder(candidate: string | undefined, reference: string | undefined): boolean {
  const a = normalizeIsoDate(candidate)
  const b = normalizeIsoDate(reference)
  if (!a || !b) return false
  return a < b
}

function numbersDiffer(a: number | undefined, b: number | undefined): boolean {
  if (a === undefined || b === undefined) return false
  return a !== b
}

export function regionalHubIssues(input: RegionalHubCompareInput): RegionalHubMismatchFlag[] {
  const issues: RegionalHubMismatchFlag[] = []
  const osmWd = input.osmWikidata?.trim()
  const wdQid = input.wdQid?.trim()
  if (wdQid && !osmWd && p402Agrees(input.osmId, input.wdOsmRelationId)) {
    issues.push('osm_wikidata')
  } else if (wdQid && osmWd && normalizeQid(osmWd) !== normalizeQid(wdQid)) {
    issues.push('osm_wikidata')
  }

  const destatisPop = input.destatisPop
  const osmPop = input.osmPop
  if (destatisPop !== undefined) {
    if (
      osmPop === undefined ||
      numbersDiffer(osmPop, destatisPop) ||
      dateIsOlder(input.osmDate, input.destatisDate)
    ) {
      issues.push('osm_population')
    }
  }

  if (destatisPop !== undefined && wdQid) {
    if (
      input.wdPop === undefined ||
      numbersDiffer(input.wdPop, destatisPop) ||
      dateIsOlder(input.wdDate, input.destatisDate)
    ) {
      issues.push('wikidata_population')
    }
  }

  if (wdQid && numericOsmRelationId(input.osmId)) {
    const wdOsm = numericOsmRelationId(input.wdOsmRelationId)
    if (!wdOsm || !p402Agrees(input.osmId, input.wdOsmRelationId)) {
      issues.push('wikidata_p402')
    }
  }
  return issues
}

/**
 * One primary mapper action, matching hub CTA priority:
 * (1) OSM `wikidata` on a unique P1388 hit whose P402 agrees,
 * (2) OSM population/date,
 * (3) Wikidata P1082 from Destatis,
 * (4) Wikidata P402.
 */
export function primaryRegionalHubIssue(
  input: RegionalHubCompareInput,
): RegionalHubMismatchFlag | null {
  return regionalHubIssues(input)[0] ?? null
}

export function normalizeQid(raw: string): string {
  const trimmed = raw.trim()
  if (/^Q\d+$/i.test(trimmed)) return trimmed.toUpperCase()
  const match = /\/(Q\d+)/i.exec(trimmed)
  return match?.[1]?.toUpperCase() ?? trimmed
}

export { normalizeIsoDate, p402Agrees }
