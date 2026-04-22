# Deutschland — Staatsgebiet (`vg25_sta`)

Amtliche Grenze aus BKG **VG25** (Layer `vg25_sta` in `DE_VG25.gpkg` vom aktuellen ZIP). Official FlatGeobuf wird mit dem Workspace-Skript erzeugt (siehe [../README.md](../README.md) und [../docs/vg25-bkg.md](../docs/vg25-bkg.md)).

**OSM:** compare nutzt den shared OSM-Extract und matched Deutschland explizit auf Relation `51477` (`relation/51477`) statt auf einen synthetischen Regionalschlüssel.

**Hinweis:** `config.jsonc` nutzt `official.constantMatchKey` plus `osm.matchCriteria.kind = "relation_id"` als stabile Join-Strategie für die Nationalgrenze.
