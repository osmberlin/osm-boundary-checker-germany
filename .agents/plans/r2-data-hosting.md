# Plan: Datensätze nach Cloudflare R2 auslagern

Status: **noch nicht begonnen**, liegt als Option bereit (Stand 2026-10-31). Anlass, ihn umzusetzen: Die Site kommt wieder in die Nähe des 1-GB-Limits von GitHub Pages, oder neue Datensätze brauchen mehr Platz.

## Ausgangslage

Der Engpass ist das **1-GB-Limit von GitHub Pages**, nicht der Speicher von GitHub Actions. Die Warnung bei 90 % kommt aus `bun run site-size` ([docs/cache-policy.md](../../docs/cache-policy.md), Abschnitt „Site size budget“).

Messung vom Refresh am 2026-10-26:

- Site: 952 von 1000 MB, davon 903 MB unter `report/public/datasets/`
- Rund 57.000 Dateien: 37.500 `features`, 19.300 `official_for_edit`, dazu die PMTiles
- Größter Datensatz: `de-verwaltungsgemeinschaften` mit 216 MB

Artifacts und Cache sind kein Limit-Problem, weil das Repo öffentlich ist (damals rund 5,7 GB Artifacts, 432 MB Actions-Cache). Sie bremsen aber: Jeder Deploy lädt `report-runtime-last-good` (655 MB) herunter und lädt ein Pages-Artifact von etwa 610 MB wieder hoch.

Seitdem umgesetzt:

- `compare.tileMaxZoom: 13` für `de-landkreise` und `de-verwaltungsgemeinschaften`
- Keine Edit-GeoJSON mehr für Gebiete mit Bewertung „OK“ (`needsOfficialForEditFile` in `scripts/compare/lib/writeOutputs.ts`)

Erwartet sind damit rund 700 MB und etwa 44.000 Dateien. Das ist eine Schätzung; vor dem Start die aktuellen Werte aus dem letzten `site-size`-Log nehmen.

## Entscheidung: R2 für die Daten, Pages nur für die App

Warum R2:

- 10 GB frei, kein Geld für Traffic nach außen
- HTTP-Range-Requests, die PMTiles braucht
- S3-API: `rclone sync` lädt pro Lauf nur geänderte Dateien hoch, das Auflisten von 57.000 Dateien kostet nur etwa 60 Abfragen
- Passt ins Frei-Kontingent von 1 Mio. Schreib-Operationen pro Monat
- Standort-Hinweis `weur` (Westeuropa), weil die Nutzer in Deutschland sitzen

Die Zahlen zum Frei-Kontingent stammen aus dem Gedächtnis und wurden nicht nachgeschlagen; vor dem Start kurz gegen die aktuelle Cloudflare-Preisseite prüfen.

Warum nicht FTP: Jede Nacht zehntausende Einzeldateien hochzuladen ist sehr langsam. Ob Range-Requests, CORS und Cache-Header gehen, hängt vom Hoster ab, und klassisches FTP überträgt die Zugangsdaten unverschlüsselt. Als Ausweichweg taugt der eigene Server nur, wenn er SSH/rsync kann.

**Voraussetzung:** eine eigene Domain auf Cloudflare, zum Beispiel `daten.grenzabgleich.osm-verkehrswende.org`. Die `r2.dev`-URL ist gedrosselt und nur für Tests gedacht. Die Site läuft unter `grenzabgleich.osm-verkehrswende.org`. Noch offen ist, ob `osm-verkehrswende.org` bei Cloudflare liegt; falls nicht, wäre eine kleine eigene Domain dort der einfachste Weg.

## Schritte

1. **R2 einrichten (manuell):** Bucket anlegen, eigene Domain verbinden, CORS-Regel für `grenzabgleich.osm-verkehrswende.org` und `localhost` setzen. API-Token nur für diesen Bucket erstellen und als GitHub-Secrets speichern: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`.
2. **Report umstellen:** In `report/src/data/paths.ts` bekommen alle Pfade unter `/datasets/*` eine Basis-URL `VITE_DATA_BASE_URL`. Ohne die Variable gilt wie bisher die eigene Origin, lokal ändert sich also nichts. Die drei `pmtiles://${window.location.origin}`-Stellen ziehen mit. `/data/*` (8 MB) kann vorerst auf Pages bleiben.
3. **Hochladen im Refresh:** Neuer Schritt nach `site-size` in `.github/workflows/data-refresh.yml`: `rclone sync report/public/datasets r2:<bucket>/datasets --checksum`. Dazu Cache-Header: PMTiles und Shards lange cachen, `comparison_table.json` und `snapshots.json` kurz.
4. **Deploy verschlanken:** `.github/workflows/pages-deploy.yml` baut nur noch die App ohne `datasets/`. Der Download des Artifacts `report-runtime-last-good` fällt im Deploy weg. `site-size` prüft danach nur noch die App auf Pages; eine zweite Prüfung warnt bei etwa 8 GB im Bucket.
5. **Artifacts aufräumen:** `report-runtime-last-good` wird überflüssig, weil der Bucket der neue Stand „zuletzt gut“ ist. Dabei beachten: Das Artifact transportiert auch `data/*` und die Regional-Hub-JSONs, dafür braucht es einen neuen Weg.
6. **Optional, ohne Eile:** Quell-Caches (`source-cache-osm` 345 MB, `-official` 310 MB, `-dtp`) ebenfalls nach R2. Dann laufen sie nicht mehr nach 3–14 Tagen ab, und es gibt keinen kalten Neustart des DtP-Caches. Schneller wird der Download dadurch eher nicht.
7. **Doku anpassen:** `docs/cache-policy.md` (Abschnitt „Site size budget“ und die Artifact-Scopes), Eintrag in `changelog.registry.yaml`.

## Was das bringt

- Pages schrumpft auf wenige MB, das Limit ist praktisch weg. R2 bietet das Zehnfache an Platz.
- Der Deploy läuft in Sekunden statt Minuten.
- Im Refresh entfallen der Artifact-Upload von etwa 1 Minute und die Pages-Runde mit 610 MB. Neu kommt nur der Upload geänderter Dateien hinzu.

## Bekanntes Risiko

Während `rclone sync` läuft, passen alte und neue Dateien ein paar Minuten lang nicht ganz zusammen. Das ist vertretbar. Ein eigener Ordner pro Lauf würde es lösen, müsste aber jedes Mal alles neu hochladen; bei etwa 44.000 Dateien und rund 30 Läufen im Monat läge das nahe am Frei-Kontingent für Schreib-Operationen.
