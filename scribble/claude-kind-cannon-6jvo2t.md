# claude/kind-cannon-6jvo2t – own offline map from OSM data, phase 0 (report only)

Done: feasibility report `docs/features/map-own.md` (sources, builder, renderer, storage, levels, progress, free services vs own servers, 5 packages, risks, 4 open questions), one decision bullet, STATUS line, CHATS rows. No app code, no dependency, nothing measured (sandbox has no network to map services).

Decided without asking (as proposals in the report, not implemented): Overpass per Mercator cell (z13 lean / z14 full), own MVT writer/reader as the stored tile format, device-local collections `maps_region` / `maps_tile` with `local: true` instead of OPFS, own Canvas renderer rendered into the existing `blob:` tile pipeline of `TileMap.tsx`.

for the next chat:

- Start only after the maintainer's yes (CHATS.md "Wartet auf Sven"). Package 1 = `feat/map-own-tiles` (store + MVT + renderer with a fixture region, no Overpass yet); packages are listed at the end of the report.
- Hotspots you will touch from package 1 on: `modules/maps/*` (`tiles.ts`, `TileMap.tsx`, `settings.ts`, `manifest.ts`), `core/db` via `npm run db:bump` (+ `schema-history.json`), from package 2: `core/legal/notices.ts` (new id `maps-build`), `strings.legal.ts` (data flow wording), `core/net/netlog.ts` (host `overpass-api.de`), `strings.ts` block `maps` + 4 locales, `docs/legal/DATA-FLOWS.md` row `maps`.
- `local: true` collections are supported by the framework but nobody uses them yet (`core/db/repo.ts`, `syncedTableNames`, `dataapi/scope.ts`): expect to be the first; `createRepo(..., { local: true })` skips the outbox and offers `purge`.
- The Overpass answer shape and the fair-use numbers come from the docs, not from a live call: the first device run is a hand test, as with Transitous (`scribble/feat-maps-transit.md`).
- Nice to have while building package 1: a `TileSource` seam in `tiles.ts` (`online` template vs `local` region) so `TileMap.tsx` needs one prop change only.
