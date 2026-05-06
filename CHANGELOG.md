# Changelog

Automatisch aus `changelog.registry.yaml` erzeugt.

## 2026-05

### `5a370a1`, `22ad7ab`

Auf der Karte der Detailseite kann man jetzt die Anzeige zwischen der ausgewählten Grenze und allen Grenzen wechseln. Das erlaubt den Wechsel zu benachbarten Detailansichten sowie besser zu verstehen, wie man Grenzen präzisieren muss im Editor, wenn mehrere Grenzen aufeinander treffen. Denn die Editor-Grenzen enthalten immer nur den ausgewählten Datensatz, nicht die Nachbarn.

### `8fd952e`, `d340945`

Bessere Darstellung der Regeln, die beim Vergleich der Grenzen angewendet werden.

### `7b4309a`, `741b621`, `8fd017c`, `5754fdf`, `5135821`

Hilfswerkzeug [Regional- und Gemeindeschlüssel-Explorer](/tools/german-key) hat eine statische (per Skript manuell zu aktualisierende) Liste aller Schlüssel die wir zum Datenabgleich nutzen. Einschließlich einiger historischer Daten, die nicht mehr aktuell sind, aber in OSM noch in Verwendung sein können.

### `f6ad863`, `e712d51`, `31cb300`, `c03bbcf`, `602ea38`, `e26f71a`

Pro Datensatz extrahieren wir jetzt ein Datum der offiziellen letzten Aktualisierung. Das ist wichtig um die Daten einzuschätzen. Bspw. sind in den BKG Daten die Schlüssel von Anfang des Jahres verwendet, aber inzwischen gibt es neuere Datensätze zu den Schlüsseln. Genau Daten helfen solche Sonderfälle zu erkennen.

### `038fa9f`

Die iD- und JOSM-Editor-Links enthalten jetzt auch das Hashtag `#grenzabgleich` als Vorschlag für das Changeset.

### `062d511`, `acb6ffc`

Wenn zwei Flächen in der Karte übereinander liegen aber kein match sind, wird jetzt ein Dialog angezeigt über dem man beide Detailseiten öffnen kann. Auf der Detailseite der amtlichen Daten (nicht nicht gematched wurden) steht zudem, welche Tags nötig wären in OSM, um die Fläche zu matchen.

### `884ab63`, `63a213f`, `7735ab1`, `ad8925b`, `f4902f9`, `8732ac5`, `cb71b10`, `8eb1ae9`, `5c3744a`, `4235f47`

Neues Logo, Favicon, Sharing-Text und Bild und Intro-Text. Außerdem einige Text- und Styling-Verbesserungen. Die Seite ist jetzt unter grenzabgleich.osm-verkehrswende.org erreichbar.

### `4a505d3`, `3f88c2c`, `a34e3e4`

Auf der `/status`-Seite wird erklärt an welchen Tagen und Zeiten die Daten aktualisiert werden.

## 2026-04

### `6483d38`

Unter `/review` gibt es jetzt eine Übersichter aller Grenzen, die als "zu prüfen" oder (wahrscheinlich) "fehlerhaft" markiert sind.

### `4ed60e2`

Der iD-Editor-Link hat jetzt andere Einstellungen, so dass die Grenzen nicht mehr verschwinden, wenn man sie verschiebt. Das ist ein iD-Editor-Bug den wir jetzt umgehen, in dem wir für unseren UseCase nicht relevante Daten angezeigt lassen (nicht verstecken).

### `5b636c2`

Bisher haben die KPI immer nur eine Fläche bewertet. Große Flächen konnten dann bpsw. sehr hohe Werte bekommen – aber nicht weil der Unterschied groß ist, sondern wegen der großen Fläche. Jetzt gibt es KPI die die Fläche mit berücksichtigen. Außerdem gibt es eine Bewertung (und Begründung der Bewertung) ob eine Zeile geprüft werden muss oder nicht, die alle Indikatoren betrachtet.

### `1b69c86`

Unter `/changelog` gibt es eine Übersicht von Änderungen für die Nuzter:innen der App relevant sein könnten.
