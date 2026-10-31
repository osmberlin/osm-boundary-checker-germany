# DtP overrides

`overrides.json` lists reviewed corrections for Digitize the Planet (DtP) data: entries where we believe DtP should change a reference. Each entry has a reason (`comment`, German, shown in the report) and a decision date.

We do not patch DtP. We correct the data locally until DtP fixes it, and each entry expires by itself once DtP changes the value we reviewed (see [Guards](#guards-entries-expire-by-themselves)).

The file is tracked in git and is the only source of these corrections. It is read by `scripts/shared/dtpOverrides.ts` (schema and loader) and applied by `scripts/dtp/lib/overrides.ts` during `extract:official`.

## Fields

Each entry in `overrides` has these fields. Unknown fields are an error.

| Field              | Required        | Meaning                                                                                                                                                                               |
| ------------------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dtpUuid`          | yes             | The DtP area uuid. Stored in lower case; uniqueness is checked per file.                                                                                                              |
| `name`             | yes             | The DtP name of the area, for the log and for reviewers.                                                                                                                              |
| `impact`           | yes             | `matching`: without the entry the row pairs with a wrong OSM object or with none. `informational`: the row pairs correctly anyway; the entry only records what DtP should add or fix. |
| `comment`          | yes             | The reason, in German. Shown in the report on the rows that got the override.                                                                                                         |
| `decidedAt`        | yes             | The decision date (`YYYY-MM-DD`).                                                                                                                                                     |
| `issueUrl`         | no              | The GitHub issue (label `dtp-override`) the entry came from.                                                                                                                          |
| `osmRef`           | one of          | The OSM object DtP should name: `way/<id>` or `relation/<id>`. `null` means: DtP's reference is wrong and there is no OSM object to replace it, so the reference is removed.          |
| `reportedOsmRef`   | with `osmRef`   | DtP's `osm` reference as it was when we reviewed it (a string, or `null` when DtP named none). Guards the `osmRef` change.                                                            |
| `wikidata`         | one of          | The Wikidata item that DtP should carry, `Q<id>`.                                                                                                                                     |
| `reportedWikidata` | with `wikidata` | DtP's Wikidata id as it was when we reviewed it (`null` when DtP named none). Guards the `wikidata` change.                                                                           |

Rules: an entry has `osmRef`, `wikidata`, or both. A `reported…` field is required with its change and not allowed without it. `dtpUuid` appears only once in the file.

## What the extract writes

`bun run extract:official` applies an entry to the DtP feature of that uuid in each dataset that selects the area. When a change applies, the feature gets:

- `osmRef` change: `dtp_reported_osm_ref` (DtP's value), `dtp_osm_ref` = `null`, and `override_osm_ref` = the new reference. For `osmRef: null`, `override_osm_ref` is omitted.
- `wikidata` change: `dtp_reported_wikidata` (DtP's value, `null` if none), `override_wikidata` and `wikidata` = the new item.
- Both: `override_comment` = `comment`, `override_impact` = `impact`. Rows without an applied override have none of these properties.

The compare then pairs the row through the rule `osm_reference` `override_osm_ref` (second in the rule list of the four DtP datasets) and, for the Wikidata change, through the rule `osm_tag` `wikidata` (third). The report shows `override_comment` on the feature.

## Guards: entries expire by themselves

Each change applies only while DtP still holds the value we reviewed:

- `osmRef` applies while DtP's `dtp_osm_ref` equals `reportedOsmRef`. Both are compared with the normalized reference (`normalizeOsmObjectRef`, so `way/1` and `https://www.openstreetmap.org/way/1` are equal), and two missing values are equal.
- `wikidata` applies while DtP's `wikidata` equals `reportedWikidata` (`null` = no item).

When DtP changes the value, the guard fails: the feature keeps DtP's data, the change is not applied, and the extract logs `DtP overrides outdated` with the uuid and the name. This does not fail the run. Then either remove the entry (DtP fixed it, or the area is gone) or update it with the new DtP value after review.

## Running it

```sh
bun run extract:official -- --area de-grossschutzgebiete
bun run compare -- --area de-grossschutzgebiete
```

The extract log prints `DtP overrides applied: …` once per run, after all datasets. Use `--area` for one dataset; the other DtP datasets (`de-natura2000`, `de-schutzgebiete-lsg`, `de-schutzgebiete-nsg`) take the same entries. An area that is not in a dataset's selection is neither applied nor outdated for that dataset.

Tests: `bun test scripts/shared/dtpOverrides.test.ts scripts/dtp/lib/overrides.test.ts`.

## Taking over issues (for agents)

Requests come in as GitHub issues with the label `dtp-override`, created from the form `.github/ISSUE_TEMPLATE/dtp-override.yml`. To list them:

```sh
gh issue list --label dtp-override --json number,title,body,url
```

The form headings are German, so read the body by meaning, not by exact heading text. The fields, by their form id, are:

- `page`: the page where the reviewer saw the problem.
- `dtp_uuid`: the DtP area uuid.
- `dtp_name`: the DtP name (optional).
- `dtp_osm_ref`: the OSM reference DtP named when the form was opened (optional).
- `dtp_wikidata`: the Wikidata id DtP named when the form was opened (optional).
- `osm_ref`: the OSM object that is right. Empty means there is no matching object, so `osmRef` is `null`.
- `wikidata`: the Wikidata item that is right (optional).
- `reason`: the reasoning, with sources.

Write `comment` so that it stands on its own. Name the side for every fact ("in den DtP-Daten", "in OSM"), say what is missing or wrong there, why this affects the match, and what DtP should change. Prefer a longer text to a short one that leaves open which data set a sentence refers to.

Set `impact` yourself: compare the row in `datasets/<area>/output/comparison_table.json`. If the area is already matched to the right OSM object, for example by its WDPA id, a missing Wikidata id is `informational`. If the entry is what makes the match right, it is `matching`.

To take over an issue:

1. Check the claim against OSM (the object exists, is the right kind of area, and matches the DtP geometry) and against Wikidata (the item is the same protected area). If it does not hold, do not add the entry; comment on the issue instead.
2. Set `reportedOsmRef` and `reportedWikidata` to DtP's current values, not only the values in the form. Read them from the DtP detail record of the area (API URL: `dtp_url` of the feature, or `.cache/dtp/areas.ndjson.gz` after `download:dtp`), field `external_references` (`osm`, `wikidata`). If they differ from the form, use the current value and say so in the commit.
3. Add the entry to `overrides.json` with `dtpUuid`, `name`, `comment` (German, one or two sentences, with the source), `decidedAt` (the date you decide), and `issueUrl` (the issue URL).
4. Run `bun test scripts/shared/dtpOverrides.test.ts` to validate the file.
5. Commit the file on its own, following the repository rules in `CLAUDE.md` (changelog entry or `hide changelog`). Stage it by its path.
6. Close the issue with a comment that names the commit.

Do not change DtP itself, and do not run `extract:official` or `compare` just to take over an issue unless the reviewer asks for it; those rewrite generated files.
