# feat/map-own-full – own map package 3 (full level, extend, sizes)

Done: `builder.upgrade` (lean → full in place), `createAndStart({ skipBuilt })` + `region.skipCells`, `builder.removeAll`, `viewportBbox`, `TileMap` `onSize`, "Hier erweitern" button (coverage check from the rounded view), `RegionsCard` with size/date, "Genauer machen", "Alle Karten löschen"; tests (builder, plan, page, e2e); docs. Details: `docs/features/map-own.md` "Status", decision bullet.

Decided without asking: the first build is always lean (no level choice yet); upgrade in place instead of a second region; a covered viewport creates no region and says so; "Alle Karten löschen" only from two regions on.

for the next chat:

- Packages 4 (prebuilt PMTiles region files from an own host: `pmtiles.ts` reader, setting `regionUrl`, attribution block) and 5 (local search in built regions) are optional and wait for the maintainer's call. The stored tiles are MVT already, so a PMTiles reader only needs the directory/leaf lookup (spec v3) and the same `tileRepo` rows (or a read-through source in `own/local.ts` that asks the file before the repo).
- Still unverified: the live Overpass answer (sandbox has no network). First device run = hand test; `own/overpass.ts` `readAnswer` / `parseOverpass` are defensive.
- Ideas not done: a lean/full choice before the first build (segmented, default lean), progress for the overview phase, "Neu erzeugen" for a stale region (today: delete + build), an auto-extend-on-scroll opt-in (deliberately not: nothing without a click).
