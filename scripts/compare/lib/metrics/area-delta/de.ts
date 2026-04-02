import type { MetricInfoCopy } from '../metricInfoCopy.ts'

export const areaDeltaModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zu Δ Fläche % anzeigen',
  title: 'Was bedeutet „Δ Fläche %“?',
  lead: 'Die Spalte zeigt, wie stark sich die eingeschlossene Fläche von OSM von der amtlichen Referenzfläche unterscheidet — als Prozent der amtlichen Fläche.',
  paragraphs: [
    'Berechnung: Betrag der Differenz aus OSM-Fläche minus amtlicher Fläche, geteilt durch die amtliche Fläche, mal 100. Angezeigt wird der absolute Wert (ohne Vorzeichen): Es geht nur um die Größe der Abweichung, nicht darum, ob OSM größer oder kleiner ist.',
    'Eine kleine Prozentzahl heißt: Die Gesamtflächen sind annähernd gleich groß. Eine große Zahl kann auch dann auftreten, wenn die Grenzlinien lokal noch nah beieinander liegen — etwa bei unterschiedlicher Generalisierung oder wenn eine Quelle das Gebiet anders „füllt“.',
    'Gemeinsam mit IoU hilft diese Kennzahl, Fälle zu erkennen, in denen die Flächenbilanz stark von der Referenz abweicht. Sie ergänzt IoU und Hausdorff: IoU betont Überlappung, Hausdorff den schlimmsten Punkt entlang der Linie, Δ Fläche % die reine Größenabweichung der Flächen.',
  ],
  close: 'Schließen',
}
