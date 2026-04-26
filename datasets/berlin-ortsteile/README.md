# Berlin Ortsteile (ALKIS)

Official boundaries from Berlin **ALKIS Ortsteile** WFS, compared to OSM administrative polygons via Ortsteil `name` (`official.nam` ↔ OSM `name`).

## References

- WFS Explorer: [ALKIS Ortsteile](https://wfsexplorer.odis-berlin.de/?wfs=https%3A%2F%2Fgdi.berlin.de%2Fservices%2Fwfs%2Falkis_ortsteile)
- `official.download` GeoJSON URL is in [`config.jsonc`](./config.jsonc). Run `bun run download:official -- --area berlin-ortsteile` to build `source/official.fgb`.

## Notes

- `compare.bboxFilter=official_bbox_overlap` limits OSM features to a buffered bbox around official data (faster compare; same Schlüssel matching as elsewhere).
