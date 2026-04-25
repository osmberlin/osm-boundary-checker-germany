import type { MetricInfoCopy } from '../metricInfoCopy.ts'

/** External reference for the algorithm (feature map footnote). */
export const hausdorffRustDocDe = {
  label: 'Hausdorff (Rust / geo)',
  href: 'https://docs.rs/geo/latest/geo/algorithm/hausdorff_distance/trait.HausdorffDistance.html',
  title: 'GeoRust `geo`: HausdorffDistance — wird im Rust-Geom-Sidecar für diese Metrik verwendet.',
} as const

export const hausdorffModalDe: MetricInfoCopy = {
  triggerAria: 'Erklärung zum Hausdorff-Abstand anzeigen',
  title: 'Was ist der Hausdorff-Abstand?',
  lead: 'Kurz gesagt: ein Maß dafür, wie weit die beiden Grenzlinien maximal auseinanderliegen — in Metern, im projizierten Koordinatensystem des Vergleichs.',
  paragraphs: [
    'Der Hausdorff-Abstand vergleicht die amtliche Grenze mit der OSM-Grenze. Er sucht die größte „Lücke“ zwischen den beiden Umrissen: An welcher Stelle muss man am weitesten von einem Rand zum anderen gehen? Dieser maximale Abstand (in beide Richtungen betrachtet) ist der angezeigte Wert.',
    'Kleine Werte bedeuten: Die Linien liegen überall nah beieinander. Größere Werte deuten auf eine Stelle hin, an der eine der beiden Quellen stärker abweicht — zum Beispiel durch Vereinfachung der Geometrie, unterschiedliche Toleranzen oder lokale Kartierungsunterschiede.',
    'Andere Spalten wie IoU oder Flächenabweichung beschreiben vor allem die Überlappung der Flächen. Der Hausdorff-Abstand ergänzt das: Er betont den schlechtesten Punkt entlang der Grenze, nicht nur den Durchschnitt.',
    'Technisch wird der Hausdorff-Abstand im Rust-Geom-Sidecar mit der `geo`-Bibliothek auf den projizierten Polygonen berechnet.',
  ],
  close: 'Schließen',
}
