# Deutschland — Schutzgebiete (Digitize the Planet)

Quelle: DtP-API v2 (Digitize the Planet e.V.), Gebiete mit WDPA-ID. Jede Geometrie hat bei DtP eine eigene Lizenz und Quelle (`geometry_license_*`, `geometry_source_*` im Feature).

Extraktion: `bun run extract:official -- --area de-schutzgebiete` (liest den Cache `.cache/dtp/`, den `bun run --filter ./scripts download:dtp` füllt).

Auswahl: `official.dtp.categoryIds` in `config.jsonc`. Abgleich mit OSM über `ref:WDPA` (`osmProfile` `protected_area_wdpa`).

Mehrere DtP-Gebiete mit derselben WDPA-ID bleiben erhalten und werden beim Vergleich zu einer Geometrie vereinigt; der Extrakt listet sie im Log.

Plan: [`docs/protected-areas-dtp-plan.md`](../../docs/protected-areas-dtp-plan.md).
