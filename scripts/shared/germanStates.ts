import { z } from 'zod'

/**
 * The 16 Länder in ARS order. `code` is the short form used in URLs (`?state=BB`), in the
 * `states` field of table rows and as the file name under `report/public/data/states/`.
 */
export const GERMAN_STATES = [
  { code: 'SH', ars: '01', name: 'Schleswig-Holstein' },
  { code: 'HH', ars: '02', name: 'Hamburg' },
  { code: 'NI', ars: '03', name: 'Niedersachsen' },
  { code: 'HB', ars: '04', name: 'Bremen' },
  { code: 'NW', ars: '05', name: 'Nordrhein-Westfalen' },
  { code: 'HE', ars: '06', name: 'Hessen' },
  { code: 'RP', ars: '07', name: 'Rheinland-Pfalz' },
  { code: 'BW', ars: '08', name: 'Baden-Württemberg' },
  { code: 'BY', ars: '09', name: 'Bayern' },
  { code: 'SL', ars: '10', name: 'Saarland' },
  { code: 'BE', ars: '11', name: 'Berlin' },
  { code: 'BB', ars: '12', name: 'Brandenburg' },
  { code: 'MV', ars: '13', name: 'Mecklenburg-Vorpommern' },
  { code: 'SN', ars: '14', name: 'Sachsen' },
  { code: 'ST', ars: '15', name: 'Sachsen-Anhalt' },
  { code: 'TH', ars: '16', name: 'Thüringen' },
] as const

export type GermanStateCode = (typeof GERMAN_STATES)[number]['code']

export const GERMAN_STATE_CODES = GERMAN_STATES.map((state) => state.code) as [
  GermanStateCode,
  ...GermanStateCode[],
]

export const germanStateCodeSchema = z.enum(GERMAN_STATE_CODES)

export function germanStateByArsPrefix(arsPrefix: string) {
  return GERMAN_STATES.find((state) => state.ars === arsPrefix)
}

export function germanStateName(code: GermanStateCode) {
  return GERMAN_STATES.find((state) => state.code === code)?.name ?? code
}

/**
 * A row belongs to the state with its largest share and to every other state that holds at
 * least this much of it. Below that, a shared border is mostly a sliver between two
 * digitisations (see `docs/state-filter.md`).
 */
export const STATE_MIN_OVERLAP_M2 = 50_000
export const STATE_MIN_OVERLAP_SHARE = 0.1

/** States of one row from its area per state; ordered by share, largest first. */
export function statesFromOverlaps(
  overlaps: readonly { code: GermanStateCode; areaM2: number }[],
  totalM2: number,
): GermanStateCode[] {
  const sorted = [...overlaps].filter((o) => o.areaM2 > 0).sort((a, b) => b.areaM2 - a.areaM2)
  const [main, ...rest] = sorted
  if (!main) return []
  return [
    main.code,
    ...rest
      .filter(
        (o) =>
          o.areaM2 >= STATE_MIN_OVERLAP_M2 ||
          (totalM2 > 0 && o.areaM2 / totalM2 >= STATE_MIN_OVERLAP_SHARE),
      )
      .map((o) => o.code),
  ]
}
