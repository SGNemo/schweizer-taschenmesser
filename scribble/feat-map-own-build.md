# feat/map-own-build – own map package 2 (lean build from Overpass)

Done: `own/{overpass,plan,pyramid,work,worker,compute,builder,fixtures}.ts`, `RegionsCard`, build button on a search hit with an area, progress line, notice `maps-build`, data-flow row, netlog host, settings `overpassUrl` + `showBuildProgress`, strings in 5 languages, unit + page + e2e tests. Details: `docs/features/map-own.md` "Status", decision bullet in `docs/decisions/maps.md`.

Decided without asking: one region at a time (a second waits in the queue); 64-cell cap around the centre for large areas; lower zooms from the stored z13 tiles (pyramid) instead of keeping features in memory; a repeated cell purges and re-creates its tiles (deepEqual cannot see a changed ArrayBuffer); the region row is created with `status: 'building'` so the first frame already shows the line; delete = two clicks, no undo (a cache).

for the next chat (package 3, `feat/map-own-full`):

- The Overpass answer shape (`out geom`, members with `geometry`, `remark` on overload) comes from the API docs, NOT from a live call: first thing on a device, build a small town and compare with `own/overpass.ts` (`readAnswer`, `parseOverpass`). The parser is defensive; fixtures in `own/fixtures.ts`.
- Full level: `overpassQuery(bbox, 'full')` already asks for buildings, paths, POIs; `CELL_ZOOM.full = 14`, `STORED_ZOOMS.full.max = 16`; the renderer draws buildings from z14, POIs from z16 (`own/styleTable.ts`). Missing: the level choice in the UI (today always `lean`), upgrade lean → full (re-fetch the region's cells at z14, then the pyramid), "Hier erweitern" from the viewport (`tilesCovering(viewportBbox, cellZoom)` minus cells already built: compare with the stored tile ids), sizes and dates per region (`region.bytes`, `builtAt`), "Alle Karten löschen".
- Progress of the overview phase is not counted (fast); if a city turns out slow there, count parents too.
- `builder.settle()` runs on page mount: a build found "building" after a restart becomes "paused" (never resumes alone).
- jsdom has no Worker: `defaultCompute()` falls back inline, so page tests really build; e2e builds through the real Worker (Vite `?worker`-free `new URL(..., import.meta.url)` pattern).
