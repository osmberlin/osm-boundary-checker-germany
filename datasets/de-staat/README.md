# Deutschland — Staatsgebiet (`vg25_sta`)

Amtliche Grenze aus BKG **VG25** (Layer `vg25_sta` in `DE_VG25.gpkg` vom aktuellen ZIP). Official FlatGeobuf wird mit dem Workspace-Skript erzeugt (siehe [../README.md](../README.md) und [../docs/vg25-bkg.md](../docs/vg25-bkg.md)).

**OSM:** passende Relationen (Land) exportieren und als `source/osm.fgb` ablegen.

**Hinweis:** Prüfe mit `ogrinfo` die genaue Schlüsselspalte (`ARS` o. ä.) und passe `config.jsonc` bei Bedarf an.
