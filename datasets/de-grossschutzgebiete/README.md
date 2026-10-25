# Deutschland Großschutzgebiete (DtP)

Nationalparks, Biosphärenreservate und Naturparks. Bei DtP haben nur wenige Naturparks eine WDPA-ID; die übrigen fehlen hier.

Quelle: DtP-API v2 (Digitize the Planet e.V.), verwaltete und unverwaltete Gebiete mit WDPA-ID. Jede Geometrie hat bei DtP eine eigene Lizenz und Quelle (`geometry_license_*`, `geometry_source_*` im Feature).

Extraktion: `bun run extract:official -- --area de-grossschutzgebiete` (liest den Cache `.cache/dtp/`, den `bun run --filter ./scripts download:dtp` füllt).

Auswahl: `official.dtp.categoryIds` in `config.jsonc`. Abgleich mit OSM über `ref:WDPA` (`osmProfile` `protected_area_wdpa`).

Plan und Aufteilung: [`docs/protected-areas-dtp-plan.md`](../../docs/protected-areas-dtp-plan.md).
