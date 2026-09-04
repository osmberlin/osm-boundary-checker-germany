import { normalizeOsmValue } from '../compare/lib/normalizeGermanKey.ts'

export function padRegional12(raw: string) {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 0) return null
  return normalizeOsmValue('de:regionalschluessel', digits, 'regional-12').canonicalMatchKey
}

export function arsLandPrefix(ars12: string) {
  return ars12.slice(0, 2)
}

export function arsKreisPrefix(ars12: string) {
  return ars12.slice(0, 5)
}

export type RegionalArsLevel = 'land' | 'kreis' | 'verband' | 'gemeinde'

export function classifyRegionalArsLevel(ars12: string) {
  const gem = ars12.slice(9, 12)
  const vb = ars12.slice(5, 9)
  const kreis = ars12.slice(3, 5)
  if (gem !== '000') return 'gemeinde'
  if (vb !== '0000') return 'verband'
  if (kreis !== '00') return 'kreis'
  return 'land'
}

/** BKG/OSM compare datasets keyed by 12-digit ARS (`admin_rs`). */
export const REGIONAL_LAENDER_AREA_ID = 'de-laender'
export const REGIONAL_LANDKREISE_AREA_ID = 'de-landkreise'

export const REGIONAL_GEMEINDE_AREA_BY_LAND: Record<string, string> = {
  '01': 'de-gemeinden-sh',
  '02': 'de-gemeinden-hh',
  '03': 'de-gemeinden-ni',
  '04': 'de-gemeinden-hb',
  '05': 'de-gemeinden-nw',
  '06': 'de-gemeinden-he',
  '07': 'de-gemeinden-rp',
  '08': 'de-gemeinden-bw',
  '09': 'de-gemeinden-by',
  '10': 'de-gemeinden-sl',
  '11': 'de-gemeinden-be',
  '12': 'de-gemeinden-bb',
  '13': 'de-gemeinden-mv',
  '14': 'de-gemeinden-sn',
  '15': 'de-gemeinden-st',
  '16': 'de-gemeinden-th',
}

export function geometryAreaIdForArs(ars12: string, gemeindenByArs: Record<string, string>) {
  if (Object.hasOwn(gemeindenByArs, ars12)) {
    return REGIONAL_GEMEINDE_AREA_BY_LAND[arsLandPrefix(ars12)] ?? null
  }
  const level = classifyRegionalArsLevel(ars12)
  switch (level) {
    case 'land':
      return REGIONAL_LAENDER_AREA_ID
    case 'kreis':
      return REGIONAL_LANDKREISE_AREA_ID
    case 'verband':
    case 'gemeinde':
      return REGIONAL_GEMEINDE_AREA_BY_LAND[arsLandPrefix(ars12)] ?? null
  }
}
