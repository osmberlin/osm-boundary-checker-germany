import type { MetricInfoCopy } from '../metricInfoCopy.ts'

export const iouModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zu IoU anzeigen',
  title: 'Was ist IoU (Intersection over Union)?',
  lead: 'IoU ist ein Maß dafür, wie stark sich die beiden Flächen — amtliche Grenze und OSM — überlappen. Der Wert liegt zwischen 0 und 1; höhere Werte bedeuten mehr Übereinstimmung der Flächen.',
  paragraphs: [
    'Technisch ist IoU der Quotient aus Schnittfläche und Vereinigungsfläche der beiden Polygone (Jaccard-Index für die Flächen). Steht viel Fläche in beiden Polygonen gemeinsam im Verhältnis zur gesamten von beiden bedeckten Fläche, liegt IoU nahe 1. Bei 1 wären die Flächen identisch (kein nur-amtlicher und kein nur-OSM-Bereich innerhalb der Vereinigung).',
    'Niedrigere Werte bedeuten: Es gibt mehr Fläche, die nur bei einer der Quellen vorkommt — etwa durch versetzte Grenzen, fehlende oder zusätzliche Geometrie.',
    'In diesem Projekt werden die Polygone im projizierten Metrik-Koordinatensystem des Vergleichs ausgewertet. IoU fasst die Übereinstimmung in einer Kennzahl zusammen; sie sagt wenig darüber aus, wo entlang der Linie die größte Abweichung liegt — dafür ist der Hausdorff-Abstand gedacht.',
  ],
  close: 'Schließen',
}
