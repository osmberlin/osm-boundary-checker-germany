# Live OSM data (Postpass)

The report app asks OSM for current state in three places: the tags of one object, the boundaries
around the map view, and the `addr:postcode` objects around the map view. All of them go to the public
[Postpass](https://github.com/woodpeck/postpass) service (`https://postpass.geofabrik.de/api/interpreter`),
which answers SQL over HTTP. The earlier Overpass queries are gone.

## What loads when

| Where                                                  | What                                | Request                              |
| ------------------------------------------------------ | ----------------------------------- | ------------------------------------ |
| Compare page, open                                     | tags of the matched relation        | by id, geometry only without PMTiles |
| Feature detail, matched row, open                      | tags of the matched object          | by id, tags only                     |
| Feature detail, admin dataset without a match, open    | tags of the relation (relation row) | by id, tags only                     |
| Regional hub, open                                     | tags of the relation                | by id, tags only                     |
| Candidate row, "Aktuellen Stand laden"                 | tags and geometry                   | by id, with geometry                 |
| Map view, "Weitere OSM-Objekte in der Umgebung suchen" | boundaries in the view              | one search per click                 |
| Map view, "PLZ-Punktdaten im Gebiet anzeigen"          | `addr:postcode` objects in the view | one search per click                 |

The compare page loads the geometry on open only when the map has no OSM tiles for the dataset
(`hasUnmatchedPmtiles` is false). Otherwise the tags are enough and the geometry comes from the tiles.

Nothing loads on its own from the map: moving the map never sends a request. A search runs only on its
button, for the view at that moment.

## Rules for the client

- One request per action, no retries. A failed request shows its error and a button to try again.
- Timeout of 20 seconds (`TIMEOUT_MS` in `postpass.ts`).
- Postpass sends neither size nor compression. The client stops reading at 8 MB.
- Every value in the SQL is a validated number or a constant: IDs must be positive integers, bounding
  boxes must be finite and inside WGS84. Nothing user-typed goes into the query.
- Postpass holds tags only for relations of `type=multipolygon`, `type=boundary` or `type=route`, and
  leaves the `type` tag itself out of the answer. An object of another type therefore shows no tags.
- Searches cap their answers: 500 boundaries (`MAX_NEARBY_OBJECTS`) and 20 000 addresses
  (`MAX_ADDR_POSTCODE_OBJECTS`). The UI shows a hint when the cap is reached, and the address list
  shows only its first 200 cards while the map shows all of them.

## Cache

Answers are kept for 24 hours in the browser's IndexedDB (`report/src/lib/liveOsmCache.ts`, via
`idb-keyval`). Tags and geometry of one object are stored by object (`object:relation/123`); the
searches are stored by page (`nearby:<feature key>`, `addr-postcode:<feature key>`). A stored answer
shows again without a request. Pressing the button again asks Postpass anew. Old entries are pruned at
startup (`pruneLiveOsmCache` in `report/src/main.tsx`).

## Measured sizes

Measured sizes of the answers:

| Request                                 | Time  | Answer                |
| --------------------------------------- | ----- | --------------------- |
| Tags by id                              | 80 ms | a few KB              |
| Boundaries, nearby search at 25 km view | 1.4 s | 216 KB                |
| `addr:postcode`, search at 2 km view    | 0.3 s | 790 KB, 4 780 objects |

## Code

- `report/src/lib/postpass.ts`: client, SQL, parsing, the types of the answers.
- `report/src/lib/liveOsmError.ts`: German messages for failed requests.
- `report/src/lib/liveOsmCache.ts`: the 24-hour cache.
- `report/src/stores/liveOsmObjectsStore.ts`: state of objects per page (loading, done, error).
- `report/src/hooks/useLiveOsmObjects.ts`: objects of a page, loading on open and restoring from the cache.
- `report/src/hooks/useLiveAreaSearches.ts`: the two map-view searches (`useNearbyOsmSearch`, `useAddrPostcodeSearch`).
- `report/src/hooks/useLiveBboxSearch.ts`: the common search state behind them.
- `report/src/lib/addrPostcode.ts`: colours of the postcode map and which datasets show the search.
