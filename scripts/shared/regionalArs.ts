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
const REGIONAL_VERWALTUNGSGEMEINSCHAFTEN_AREA_ID = 'de-verwaltungsgemeinschaften'

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

/**
 * Pseudo-Verbände (BKG "gemeinschaftsfrei") stand in for a verbandsfreie Gemeinde or a gemeindefreies
 * Gebiet: the Verband part is `0` (or `9`) + the 3-digit Gemeinde number, e.g. `097720207000` for
 * Gemeinde `097720207207`. Some real Verbände also start with `0` or `9`, so the Gemeinde must exist.
 * Returns that Gemeinde key, or null when the key is no pseudo-Verband.
 */
export function pseudoVerbandGemeindeArs(ars12: string, gemeindenByArs: Record<string, string>) {
  if (ars12[5] !== '0' && ars12[5] !== '9') return null
  const gemeindeArs = ars12.slice(0, 9) + ars12.slice(6, 9)
  return Object.hasOwn(gemeindenByArs, gemeindeArs) ? gemeindeArs : null
}

/** Dataset and feature key that hold the geometry for a Regional Hub ARS, or null when none does. */
export function geometryFeatureForArs(ars12: string, gemeindenByArs: Record<string, string>) {
  const gemeindeAreaId = REGIONAL_GEMEINDE_AREA_BY_LAND[arsLandPrefix(ars12)] ?? null
  if (Object.hasOwn(gemeindenByArs, ars12)) {
    return gemeindeAreaId ? { areaId: gemeindeAreaId, featureKey: ars12 } : null
  }
  switch (classifyRegionalArsLevel(ars12)) {
    case 'land':
      return { areaId: REGIONAL_LAENDER_AREA_ID, featureKey: ars12 }
    case 'kreis':
      return { areaId: REGIONAL_LANDKREISE_AREA_ID, featureKey: ars12 }
    case 'verband': {
      // The Verwaltungsgemeinschaften dataset leaves pseudo-Verbände out, their geometry is the Gemeinde's.
      const gemeindeArs = pseudoVerbandGemeindeArs(ars12, gemeindenByArs)
      if (gemeindeArs)
        return gemeindeAreaId ? { areaId: gemeindeAreaId, featureKey: gemeindeArs } : null
      return { areaId: REGIONAL_VERWALTUNGSGEMEINSCHAFTEN_AREA_ID, featureKey: ars12 }
    }
    case 'gemeinde':
      return gemeindeAreaId ? { areaId: gemeindeAreaId, featureKey: ars12 } : null
  }
}
