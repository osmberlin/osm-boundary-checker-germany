# Berlin Bezirke

Run the boundary checker from the workspace root (see [../README.md](../README.md)):

`CI=1 bun run compare -- --area berlin-bezirke`  
(or: `bun run compare:boundaries -- --area berlin-bezirke`)

Configuration: [config.jsonc](./config.jsonc).

## Source

Official and OSM layers live under **`source/`** as **FlatGeobuf** (`.fgb`). Timestamps for the report UI go in [source/metadata.json](./source/metadata.json) (`official.downloadedAt`, `osm.downloadedAt`).

Convert GeoJSON from WFS or Overpass before replacing the `.fgb` files:

```bash
ogr2ogr -f FlatGeobuf source/official.fgb official.geojson
ogr2ogr -f FlatGeobuf source/osm.fgb export.geojson
```

- https://wfsexplorer.odis-berlin.de/?wfs=https%3A%2F%2Fgdi.berlin.de%2Fservices%2Fwfs%2Falkis_bezirke
- https://daten.berlin.de/datensaetze/alkis-berlin-bezirke-wfs-ced31d7d
- WFS GeoJSON URL is in **`download.official`** (and duplicated under **`sources.official.sourceUrl`** for docs) in [config.jsonc](./config.jsonc). Run **`bun run download:official`** (or full **`bun run download`**) to fetch and build **`source/official.fgb`**.

## OSM

- https://overpass-turbo.eu/s/2mZo

```
[out:json][timeout:25];
{{geocodeArea:Berlin, Germany}}->.searchArea;
nwr["admin_level"="9"](area.searchArea);
out geom;
```
