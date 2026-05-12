import type { MetricInfoCopy } from '../metricInfoCopy.ts'

export const areaDeltaModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zu Δ Fläche % anzeigen',
  title: 'Was bedeutet „Δ Fläche %“?',
  lead: 'Das Delta (Δ) der Fläche in Prozent zeigt, wie stark sich die eingeschlossene OSM-Fläche von der amtlichen Referenzfläche unterscheidet.',
  howToRead: [],
  technical: [
    'Der Kennzahlwert entsteht aus dem Betrag der Differenz zwischen OSM- und amtlicher Fläche, geteilt durch die amtliche Fläche und mit 100 multipliziert — dieselbe Idee wie ein relativer Größenfehler in Prozent, wobei nur die Größe der Abweichung zählt (OSM größer oder kleiner spielt für den Betrag keine Rolle).',
    'Höhere Werte entstehen typischerweise, wenn sich die eingeschlossenen Gebiete deutlich unterscheiden oder wenn die Referenzfläche sehr klein ist und schon moderate Flächenunterschiede relativ groß wirken.',
  ],
  close: 'Schließen',
  appendMetricsCrsNote: true,
  metricsCrsNoteStyle: 'appendSentence',
  hideTechnicalHeading: true,
}
