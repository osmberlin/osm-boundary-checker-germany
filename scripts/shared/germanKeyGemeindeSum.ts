import type { GermanKeyGemeindeAttribute } from './germanKeyLookupPayload.ts'

function roundKm2(value: number): number {
  return Math.round(value * 100) / 100
}

export function sumGemeindeAttributesForPrefix(
  attributes: Record<string, GermanKeyGemeindeAttribute>,
  prefix: string,
): GermanKeyGemeindeAttribute | null {
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
