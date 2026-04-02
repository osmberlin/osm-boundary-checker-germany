# Hamburg Bezirke (regional statistics)

Official geometries and attributes from the Hamburg **OGC API – Features** dataset [Regionalstatistische Daten der Bezirke](https://suche.transparenz.hamburg.de/dataset/regionalstatistische-daten-der-bezirke-hamburgs-und-hamburg-insgesamt20). The service does not expose `de:regionalschluessel`; we map official `bezirk_nr` to OSM Schlüssel in [`config.jsonc`](./config.jsonc) under `official.keyTransposition`.

## Download

- Configured URL uses `filter=jahr = '2024'` and `limit=20` (7 Bezirke for that year). Update the year in the URL when newer reference years are published.
- Run: `docker compose run --rm pipeline bun run download:official -- --area hamburg-bezirke`

## Schlüssel map

The `map` values are **placeholders** (sequential `020000000001` … `020000000007`). Replace them with the actual `de:regionalschluessel` values used on OSM once those relations are tagged (today many Hamburg `admin_level=9` Bezirk relations omit this tag).

## Performance

`compare.applyBboxFilter` keeps OSM geometry work inside a buffered box around Hamburg official data.
