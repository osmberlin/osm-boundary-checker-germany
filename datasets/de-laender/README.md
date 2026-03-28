# Deutschland — Bundesländer (`vg25_lan`)

Amtliche Grenzen aus BKG **VG25**, Layer `vg25_lan`. Extraktion: `bun run bkg:extract -- --area de-laender` (nach `bkg:download`).

OSM: `admin_level=4` für Bundesländer exportieren → `source/osm.fgb`.

Schlüsselfelder im GPKG mit `ogrinfo` prüfen; `matchProperty` ggf. anpassen.
