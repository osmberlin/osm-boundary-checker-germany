import type { GermanKeyGemeindeAttribute } from './germanKeyLookupPayload.ts'

function roundKm2(value: number) {
  return Math.round(value * 100) / 100
}

/**
 * Sum Fläche/EWZ for Gemeinden whose ARS starts with `prefix`.
 * `attributes` is satzart-60 Gemeinden only — Land/Kreis/Verband keys are
 * not in the map, so prefix totals do not double-count higher rows.
 */
export function sumGemeindeAttributesForPrefix(
  attributes: Record<string, GermanKeyGemeindeAttribute>,
  prefix: string,
) {
  if (prefix === '') return null
  let areaKm2 = 0
  let populationTotal = 0
  let populationMale = 0
  let hasArea = false
  let hasPop = false
  let hasMale = false
  for (const [ars, attr] of Object.entries(attributes)) {
    if (!ars.startsWith(prefix)) continue
    if (attr.areaKm2 !== undefined) {
      areaKm2 += attr.areaKm2
      hasArea = true
    }
    if (attr.populationTotal !== undefined) {
      populationTotal += attr.populationTotal
      hasPop = true
    }
    if (attr.populationMale !== undefined) {
      populationMale += attr.populationMale
      hasMale = true
    }
  }
  if (!hasArea && !hasPop) return null
  return {
    ...(hasArea ? { areaKm2: roundKm2(areaKm2) } : {}),
    ...(hasPop ? { populationTotal } : {}),
    ...(hasMale ? { populationMale } : {}),
  }
}

/** Direct Gemeinde attributes, or Land/Kreis/Verband totals from member Gemeinden. */
export function destatisAttributesForArs(
  bundle: {
    latest: { gemeindeAttributesByArs: Record<string, GermanKeyGemeindeAttribute> }
  },
  ars12: string,
) {
  const attrs = bundle.latest.gemeindeAttributesByArs
  const direct = attrs[ars12]
  if (direct && (direct.populationTotal !== undefined || direct.areaKm2 !== undefined)) {
    return direct
  }
  if (ars12.endsWith('0000000000')) return sumGemeindeAttributesForPrefix(attrs, ars12.slice(0, 2))
  if (ars12.endsWith('0000000')) return sumGemeindeAttributesForPrefix(attrs, ars12.slice(0, 5))
  if (ars12.endsWith('000')) return sumGemeindeAttributesForPrefix(attrs, ars12.slice(0, 9))
  return direct ?? null
}
