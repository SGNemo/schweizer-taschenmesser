# feat/map-own-tiles – own map package 1 (store and draw)

Done: `modules/maps/own/` (mvt, cut, style + palette, render, draw, local, theme, sample), device-local collections `maps_region` / `maps_tile`, setting `offlineOnly`, `TileMap` `resolve` seam, page wiring, unit + page + e2e tests. Details: `docs/features/map-own.md` "Status", decision bullet in `docs/decisions/maps.md`.

Decided without asking: tile id `z/x/y` (one tile per address; a newer overlapping build replaces it); overzoom ≤ 5 levels; palette via a hidden probe element (`color-mix` with token fallbacks); the map waits for the region query before it asks for any tile; uncompressed tiles in the fixture, gzip supported on read.

for the next chat (package 2, `feat/map-own-build`):

- Output contract of the builder = `Feature[]` from `own/cut.ts` (`layer`, `type`, `coords` lon/lat, `tags` with `class` and `name`, `minZoom`), then `cutTile(features, z, x, y)` + `encodeTile(tile)` per tile and `tileRepo.create/upsert` with id `z/x/y`, `regionId`, `size`; set `gzip: true` only if you compress with `CompressionStream('gzip')` (the reader inflates with `DecompressionStream`).
- Classes the style table knows: see `STYLES` in `own/style.ts` (`landuse/*`, `water/*`, `waterway/*`, `building/*`, `rail/*`, `road/<highway class>`, `boundary/*`, `place/<class>`, `poi/*`). Map OSM tags to these; unknown classes fall back to `layer/*`.
- Write the region row first (`status: 'building'`, `cells`), update it after each cell: the page re-asks tiles whenever a region's `updatedAt` changes (`regionsKey` in `MapsPage`), so the map fills visibly.
- Build in a Worker (`tools/regex/worker.ts` is the pattern); the Overpass request goes through `getPlatform().fetch` (connection log, "Netzwerk sperren"), needs a new notice id `maps-build`, a netlog host, a data-flow row and strings in 5 languages.
- `local: true` repos are new in the app (first users): `purge(ids)` exists for "Karte löschen"; `createMany` is one transaction.
- jsdom has no canvas: page tests mock `../own/draw` (see `maps.page.test.tsx`); the renderer is tested with a recording fake context.
