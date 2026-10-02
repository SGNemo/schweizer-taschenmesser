# Decisions – modules and tools (package 1 "Aufräumen", 0.4.0)

Index: [DECISIONS](../DECISIONS.md). Plan: [product/MODULE-PLAN.md](../product/MODULE-PLAN.md).

## Retired modules
- **Why not delete the tables:** a sync pull skips ops for unknown tables and the cursor moves on (the data never returns); Dexie drops tables that leave the schema together with their data; the server accepts any table name, so an older device keeps writing. Hence `retired` keeps `schema.ts`, `repo.ts`, `migrations.ts`, `manifest.ts`.
- **Contract (`validateRetired`):** no routes, widgets, `aiSchema`, `area`, `contributions`, `defaultEnabled`; `seed: { none: 'retired' }` and no `seed.ts`. `visibleManifests` (and so `availableManifests`, library, router, nav, AI, services) skips them; `allManifests` keeps them for schema, sync, backup, setup "has data". `apiCollections` returns `[]` (import API closed). Old paths `/news`, `/habits`, `/timetrack` redirect to `/` (`router.tsx`).
- **Removed with news:** `core/ai/newsBrief.ts`, start package, `e2e/news.spec.ts`, manual tests N1–N4, `architecture/news.md`. Kept: `core/io/feed.ts`, `core/net/fetchPublic.ts`, proxy `/v1/proxy` (also used by ICS).
- **Tables leave in package 6** (all devices ≥ 0.7, `schema-upgrade.test` allow-list).

## Tools
- IDs: percent/split → `calc`, base64/json/uuid/hash → `dev`, scratch dropped. `migrateToolIds` maps on read (explicit choice for the new id wins, otherwise "on" if any source was on); nothing is written until the next normal save.
- Tools may not import each other (`tools/isolation.test.ts`), so the merged logic moved into `calc/` and `dev/`.

## Notizzettel
- `scratch` note: id `scratch`, title "Zettel", pinned, sorted first, no delete (only "Zettel leeren"). `notes/services.ts` copies `_settings` `tools.scratch.text` once (not if the note exists, deleted ones count as existing, not for empty text) and re-checks on every change of that row (covers sync pull and backup import). Notizen is off by default; the copy runs when it is on.

## Dieser PC
- `disk` is "Dieser PC" with tabs Laufwerke · System (`?tab=`). Widgets `disk:status` and `disk:system`. Still no data, no aiSchema, blocked twice for the data API (`BLOCKED_MODULES` no longer lists `system`).
