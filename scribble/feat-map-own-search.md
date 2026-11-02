# feat/map-own-search – own map package 5 (local search)

Done: `own/names.ts` (named features of a tile → name, kind, position; normalising, tokens, dedupe), collection `maps_name` (`local: true`, multi-entry index `*tokens`, schema v22, history 21), builder writes the names of every cell (Overpass: from the cut tiles in the worker; file regions and pre-index regions: `names` request on the stored bytes; `ensureIndexed()` on the first search; `indexedAt` on the region; purged with the region, rebuilt on upgrade), `own/search.ts` (`searchOwn`: word-prefix match, ranking, one hit per kind and name), map tab "Aus deiner Karte" first, online only when nothing local or on "Online weitersuchen", never by itself with "Nur eigene Karte"; legal texts, DATA-FLOWS, tests (names, builder, page, e2e).

Decided without asking: index at write time (not at query time); named buildings count as venues (`poi`); search on submit only (no typing suggestions); offline-only also keeps the search local; regions from before the index are indexed on the first search (local, once) instead of asking for a rebuild.

for the next chat:

- A real Planetiler/OpenMapTiles file names its layers differently (`transportation`, `place`, `poi`, `water_name`, …): `kindOf` in `own/names.ts` and the style table need a small layer mapping once the maintainer has a file (the `name` tag is the same).
- Possible follow-ups, none started: typing suggestions from the own map (local, so cheap – but the project prefers one click), house numbers (not stored: the cutter keeps no `addr:*`), a "Neu erzeugen" for a stale region.
- Still open from earlier packages: the live Overpass answer on a device; a lean/full choice before the first build; progress for the overview phase; one range per leaf run for big region files.
