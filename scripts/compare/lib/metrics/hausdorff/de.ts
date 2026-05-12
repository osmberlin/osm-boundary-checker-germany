import type { MetricInfoCopy } from '../metricInfoCopy.ts'

/** External reference for the algorithm (feature map footnote). */
export const hausdorffRustDocDe = {
  label: 'Hausdorff (Rust / geo)',
  href: 'https://docs.rs/geo/latest/geo/algorithm/hausdorff_distance/trait.HausdorffDistance.html',
  title: 'GeoRust `geo`: HausdorffDistance — wird im Rust-Geom-Sidecar für diese Metrik verwendet.',
} as const

/** Keep in sync with `de.feature.stats` in `report/src/i18n/de.ts` (KPI row labels). */
const hausdorffKpiLabels = {
  max: 'Max. Randabstand',
  p95: 'Randabstand P95',
} as const

export const hausdorffModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zu Abständen an den Grenzen (Hausdorff, P95) anzeigen',
  title: 'Abstände an den Grenzen (Hausdorff)',
  lead: `Hier sehen Sie zwei Randabstände in Metern — dieselben Kennzahlen wie in der KPI-Zeile: ${hausdorffKpiLabels.max} und ${hausdorffKpiLabels.p95}.`,
  howToReadHeading: 'Zwei Betrachtungen',
  howToRead: [
    `${hausdorffKpiLabels.max} reagiert stark auf einzelne Ausreißerpunkte an der Grenze.`,
    `${hausdorffKpiLabels.p95} ist stabiler und damit meist besser für die Einordnung geeignet.`,
  ],
  howToReadAsList: true,
  technical: [
    'Aus den Grenzlinien werden Stützpunkte betrachtet und jeweils der kürzeste Abstand zur anderen Grenze ermittelt. Der maximale dieser Abstände entspricht dem größten sichtbaren „Spalt“ irgendwo entlang der Linie. Der P95-Wert verwirft die extremsten wenigen Prozent dieser Punktabstände und beschreibt damit typische Randabweichung robuster als ein reines Maximum.',
  ],
  references: [
    hausdorffRustDocDe,
    {
      label: 'JTS: DiscreteHausdorffDistance (Referenz zum TS/JSTS-Ansatz)',
      href: 'https://github.com/locationtech/jts/blob/master/modules/core/src/main/java/org/locationtech/jts/algorithm/distance/DiscreteHausdorffDistance.java',
    },
    {
      label: 'Hausdorff Distance Image Comparison (Cornell)',
      href: 'https://www.cs.cornell.edu/~dph/hausdorff/hausdorff.html',
    },
    {
      label: 'Robust Hausdorff (Perzentil) — Dokumentation zur Idee',
      href: 'https://segmentationmetrics.readthedocs.io/en/latest/segmentationmetrics.surface_distance.html',
    },
  ],
  close: 'Schließen',
  appendMetricsCrsNote: true,
  metricsCrsNoteStyle: 'appendSentence',
}
