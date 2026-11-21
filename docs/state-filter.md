# State filter (Bundesland)

Datasets that span several Länder can be narrowed to one Land with `?state=BB`. The codes and names live in [`scripts/shared/germanStates.ts`](../scripts/shared/germanStates.ts).

## Which Land a row belongs to

The compare run computes the area of every row inside every Land (`state-overlap` in the Rust sidecar, called from [`stateAssignment.ts`](../scripts/compare/lib/stateAssignment.ts)). Matched and official-only rows use the official geometry, unmatched OSM rows use the OSM geometry.

A row belongs to:

- the Land with its largest share, and
- every other Land that holds at least **5 ha** or at least **10 %** of the row.

Below that, a shared border is almost always a sliver: the protected area and the BKG Land border are digitised slightly differently. Measured in November 2026 on the DtP and Natura 2000 data:

| Smaller share ≥ | NSG | LSG | Natura 2000 |
| --------------- | --- | --- | ----------- |
| touches         | 451 | 499 | 696         |
| 1 ha            | 68  | 34  | 298         |
| 5 ha            | 17  | 16  | 117         |
| 10 % of area    | 2   | 0   | 7           |

The Land polygons are the exact BKG VG25 Länder from `datasets/de-laender/source/official.fgb` (land and coastal water). The extract phase writes that file before any compare runs. Without it, or when the sidecar fails, compare still finishes: it logs a warning (a GitHub annotation in CI) and the rows get no `states`. Rows outside every Land get none either: offshore EEZ sites such as Doggerbank and sites of neighbouring countries such as the Austrian Salzachauen. Rows inside full interior pieces of one Land skip the overlay; every row near a state or national border is cut exactly.

Rows carry the result as `states: ['ST', 'BB']` (largest share first) in `comparison_table.json`. `report/listComparisonAreas.ts` adds `stateCounts` per Land to the home-page summary.

`compare.stateFilter: false` in a dataset config skips the assignment (`de-laender`, `de-staat`).

## Report

- **Dataset page:** the header holds the dropdown in front of the licence, data source and discussion links. A table without `states` shows no control. Table and numbers follow the filter. The map keeps every boundary, dims everything outside the Land and zooms to it. A dataset whose rows all lie in one Land shows "Nur …" instead of the dropdown.
- **Home page:** the same dropdown above the dataset cards. Cards of datasets that span several Länder show the numbers of the chosen Land. Single-Land datasets (the Gemeinden per Land, Berlin) are highlighted when they match and dimmed when they do not.
- **URL:** the root route keeps `state` on every link (`retainSearchParams`), so the choice carries from the home page into a dataset, the feature pages and back. There is no local storage.

## Map outlines

`report/public/data/states/<code>.geojson` holds one outline per Land for the mask and the zoom: simplified to 50 m, 5 decimals, one minified line per file (about 820 KB for all 16). It is excluded from oxfmt and oxlint. Regenerate it after a new VG25 release:

```bash
bun run --filter ./scripts states:boundaries
```

These outlines are for display only. The row assignment always uses the exact polygons.
