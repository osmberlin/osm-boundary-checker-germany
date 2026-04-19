# Berlin Bezirke

Run the boundary checker from the workspace root (see [../README.md](../README.md)):

`docker compose run --rm pipeline env CI=1 bun run compare -- --area berlin-bezirke`  
(or: `docker compose run --rm pipeline bun run compare:boundaries -- --area berlin-bezirke`)

Configuration: [config.jsonc](./config.jsonc).

## Source

Official and OSM layers live under **`source/`** as **FlatGeobuf** (`.fgb`). Timestamps for the report UI go in [source/metadata.json](./source/metadata.json) (`official.downloadedAt`, `osm.downloadedAt`).

Convert GeoJSON from WFS or Overpass before replacing the `.fgb` files:

```bash
docker compose run --rm pipeline ogr2ogr -f FlatGeobuf datasets/berlin-bezirke/source/official.fgb /tmp/official.geojson
docker compose run --rm pipeline ogr2ogr -f FlatGeobuf datasets/berlin-bezirke/source/osm.fgb /tmp/export.geojson
```

- https://wfsexplorer.odis-berlin.de/?wfs=https%3A%2F%2Fgdi.berlin.de%2Fservices%2Fwfs%2Falkis_bezirke
- https://daten.berlin.de/datensaetze/alkis-berlin-bezirke-wfs-ced31d7d
- WFS GeoJSON URL is in **`download.official`** (and duplicated under **`sources.official.sourceUrl`** for docs) in [config.jsonc](./config.jsonc). Run **`docker compose run --rm pipeline bun run download:official -- --area berlin-bezirke`**, **`bun run berlin:download`** (all HTTP-official areas), or **`docker compose run --rm pipeline bun run pipeline:nightly`** (scheduled runs refresh BKG + all `download.official` datasets) to fetch and build **`source/official.fgb`**.

## OSM

- https://overpass-turbo.eu/s/2mZo

```
[out:json][timeout:25];
{{geocodeArea:Berlin, Germany}}->.searchArea;
nwr["admin_level"="9"](area.searchArea);
out geom;
```
