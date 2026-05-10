# Changelog

Automatisch aus `changelog.registry.yaml` erzeugt.

## 2026-05

### `fa4b95f`, `f864f52`, `ba7e243`, `282f588`, `6e13e7e`

Die Performance des Datenabgleichs ist verbessert; vorher war der Datenabgleich so langsam geworden, dass er quasi kaputt war in Github Actions.

### `8547aeb`

Die Lizenz-Tabelle auf der Startseite ist jetzt gruppiert nach Quelle.

### `0649caf`, `8613273`

Inteface Design verbessert.

### `e699d5f`

Gemeinde-Abgleich (`admin_rs`) erfolgt nur noch über `de:regionalschluessel` und das amtliche Schlüsselfeld (ARS bzw. LGB `ARS`). `de-gemeinden-bb` und `brandenburg-gemeinden` nutzen damit dieselbe RS/ARS-Achse wie die übrigen Gemeinde-Datensätze.

### `97bed55`

Auf der Detailseite ist die Anzeige wie der Vergleich und die Filterung funktionieren, verbessert.

### `d6a2abe`, `29f6e81`, `790d9fd`

Die Regeln für die Filterung der OSM-Kandidaten sind verbessert. Wir suchen jetzt zuerst immer nach einem Treffe für den Referenzwert in allen OSM Daten. Die Kandidaten verwenden dann bspw. den `admin_level` filter, damit es möglichst relevante Kandidaten sind. Dabei ignorieren wir weiterhin, dass die `admin_level` bei Dingen wie "Kreisefreihe Stadt" zu einfach gedacht sind. Außerdem gibt es jetzt OSM Match Kandidaten für alle "Nur Amtlich" Datensätze. Die sind noch nicht verknüpft mit anderen Teilen der App aber werden schonmal aufgelistet.

### `2d5862a`

Hilfswerkzeug [Regional- und Gemeindeschlüssel-Explorer](/tools/german-key) korrigiert. Die 8-stelligen Gemeindeschlüssel werden jetzt korrekt verarbeitet. Außerdem gibt es Erklärung wie die Schlüssel funktionieren.

### `8e0461b`, `df9a665`, `2c412da`

Alle Gemeinde-Datensätze werden jetzt sowohl mit dem `de:amtlicher_gemeindeschluessel` als auch mit dem `de:regionalschluessel` (transformiert) verglichen. Die Anzeige wie der Vergleich funktioniert, ist darauf angepasst. Und es gibt eine neue Sektion die darauf hinweißt, dass ein `de:amtlicher_gemeindeschluessel` fehlt, wenn das der Fall ist.

### `0f3489b`, `5ac5b74`, `4e6f720`, `2e2d549`, `3716bc3`, `306c18f`, `fbeaf8c`

Interface verbessert: Datums-Anzeige; Filter-Anzeige über den Karten; Anzeige-Toggle unter der Karte; uvm. Man kann unter anderem in der Detailansicht Nachbar-Grenzen anzeigen und dort hin navigieren.

### `e750eae`, `00b407d`, `78ef63e`, `fa54283`, `c670af4`, `e7b896f`, `4f80fb9`

Die Sektion "Live-Daten anzeigen" kann jetzt gefiltert werden, was auch die Kartenansicht beeinflusst. Außerdem werden die OSM-Daten dort mit den Referenzdaten verglichen und betont, wenn sie sich unterscheiden. Und sie bleiben beim Navigieren in der App erhalten. Die Live-Abfragen verwenden die BBOX der Karte am Kopf der Detailseite.

### `7873f42`

Die Seiten zeigen jetzt einen Lade-Spinner, wenn sie geladen werden. Einige Seiten sind leider sehr groß und laden daher länger.

### `9015e77`

Wenn man die Live OSM Daten anzeigen lässt, verlinken die Ergebnisse jetzt auf osm.org. Und es gibt Hilfs-Links zum Schlüssel-Explorer. Und die Werte aus den Referenzdaten, werden in den OSM Daten gesucht und hervorgehoben. Damit ist es einfacher zu verstehen, welche OSM Daten editiert werden müssen um ein Match zu erhalten.
Die URL `/resolve/relation/ID` erzeugt einen intelligenten Deeplink in den Grenzabgleich. Die Seite leitet entweder direkt zum Ergebnis in der App weiter oder zeigt eine Liste, wenn es mehrere mögliche Ergebnisse gibt.

### `5a370a1`, `22ad7ab`

Auf der Karte der Detailseite kann man jetzt die Anzeige zwischen der ausgewählten Grenze und allen Grenzen wechseln. Das erlaubt den Wechsel zu benachbarten Detailansichten sowie besser zu verstehen, wie man Grenzen präzisieren muss im Editor, wenn mehrere Grenzen aufeinander treffen. Denn die Editor-Grenzen enthalten immer nur den ausgewählten Datensatz, nicht die Nachbarn.

### `8fd952e`, `d340945`

Bessere Darstellung der Regeln, die beim Vergleich der Grenzen angewendet werden.

### `7b4309a`, `741b621`, `8fd017c`, `5754fdf`, `5135821`, `4e7c048`

Hilfswerkzeug [Regional- und Gemeindeschlüssel-Explorer](/tools/german-key) hat eine statische (per Skript manuell zu aktualisierende) Liste aller Schlüssel die wir zum Datenabgleich nutzen. Einschließlich einiger historischer Daten, die nicht mehr aktuell sind, aber in OSM noch in Verwendung sein können.

### `f6ad863`, `e712d51`, `31cb300`, `c03bbcf`, `602ea38`, `e26f71a`, `76074f3`

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
