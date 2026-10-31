# Discussion issues and compare pages

How GitHub issues show up as hints in the report, and how the compare page links one issue to two
detail pages.

## Linking an issue to a page

- An issue is linked when it has the label `discussion` and its **title is the page path**, without
  query or hash (for example `/de-gemeinden-th/feature/160625054009`). A trailing slash is ignored;
  the comparison is otherwise exact and case-sensitive.
- The issue body is not read. Several URLs in one issue, or a comma-separated list in the title,
  do not link it to several pages.
- Several issues may link to the same page; all of them show.
- The button "Datensatz diskutieren" on the dataset and detail pages opens a new issue with the
  label and the title already set.
- [`report/syncDiscussionsRegistry.ts`](../report/syncDiscussionsRegistry.ts) fetches the labelled
  issues (open and closed) into `report/public/discussions.registry.json` during
  `sync-runtime-assets`. A new issue shows after the next report build.
- Matching: [`scripts/shared/discussMatch.ts`](../scripts/shared/discussMatch.ts) and
  [`scripts/shared/discussionsRegistry.ts`](../scripts/shared/discussionsRegistry.ts).
- For Digitize the Planet rows, the detail page and the compare page also link "Korrektur für DtP vorschlagen", which opens the `dtp-override` issue form ([`.github/ISSUE_TEMPLATE/dtp-override.yml`](../.github/ISSUE_TEMPLATE/dtp-override.yml)) with the page path as title, so the issue links to the page like a discussion; how a proposal is taken over is described in [`data/dtp-overrides/README.md`](../data/dtp-overrides/README.md).

## Compare page

`/<areaId>/compare/<officialKey>/<osmKey>` shows an official-only row next to an unmatched OSM row
of the same dataset: both geometries on one map, the Regionalschlüssel of both split into their
levels and resolved in the key directory, the official properties next to the OSM tags, and the
iD and JOSM links for the OSM relation with the official geometry.

The page is built in the browser from the data both detail pages load
(`output/features/<officialKey>.json` and `comparison_table.json`); the pipeline generates nothing
for it. Any pair of the two categories in one dataset works; other pairs show a notice.

Ways in:

- "Vergleichen" next to the title of an official-only or OSM-only detail page opens a dialog. It
  offers the pipeline candidates of the row (official-only side) and the detail pages of the other
  category in the same dataset that were opened in this browser in the last three hours. Those
  visits are kept in `localStorage`, shared by all tabs, and dropped after three hours
  ([`report/src/lib/recentFeatureVisits.ts`](../report/src/lib/recentFeatureVisits.ts)).
- "Vergleichen" in the candidate list of an official-only row, for candidates and nearby search
  hits that are unmatched OSM relations of the same dataset.

## Issues for a pair

"Vergleich diskutieren" on the compare page opens an issue titled with the compare path. A title
of that form also matches the detail pages of both keys, so the hint shows on the compare page and
on both detail pages. The compare page also lists the issues of both detail pages.
