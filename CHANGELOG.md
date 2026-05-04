# Changelog

Automatisch aus `changelog.registry.yaml` erzeugt.

## 2026-05

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
