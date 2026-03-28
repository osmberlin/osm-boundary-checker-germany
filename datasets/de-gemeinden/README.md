# Deutschland — Gemeinden (`vg25_gem`)

BKG **VG25**, Layer `vg25_gem`. Extraktion: `bun run bkg:extract -- --area de-gemeinden`.

OSM typisch `admin_level=8` (Gemeinden) → `source/osm.fgb`.

Viele Gemeinden matchen über **12-stelligen Regionalschlüssel** (`ARS` amtlich ↔ `de:regionalschluessel`). Alternativ **AGS** (`amtlicher-8`) — per `ogrinfo` prüfen und `config.jsonc` anpassen.
