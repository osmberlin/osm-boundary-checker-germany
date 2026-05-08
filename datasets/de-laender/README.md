# Deutschland — Bundesländer (`vg25_lan`)

Amtliche Grenzen aus BKG **VG25**, Layer `vg25_lan`. ZIP: `bun run download -- --yes --targets bkg`, dann Extraktion: `bun run extract:official -- --area de-laender`.

OSM: `admin_level=4` für Bundesländer exportieren → `source/osm.fgb`.

Schlüsselfelder im GPKG mit `ogrinfo` prüfen; `matchProperty` ggf. anpassen.
