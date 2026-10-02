# Merge or retire a module

Used for 0.5.0 (shopping + packing → `lists`, launcher → `bookmarks`). Why: [decisions/modules.md](../decisions/modules.md).

1. **Target first:** new or extended module with its own schema, seed, widget, importer; `npm run db:bump` for new collections, previous stores into `core/db/schema-history.json` (+ version in `schema-upgrade.test.ts`).
2. **Step in `core/db/appMigrationSteps.ts`:** `{ id, source, target, map(row), ensure? }`. Keep ids; map `from` for 1:1 fields; invent rows only with `ensure` (stamped `BASE_HLC`). `prepare(database, rows)` reads other tables (e.g. match by name), `ensure(rows, ctx)` makes up rows from the source rows only. Never write with `createRepo` here.
3. **Tests:** step test with a fixture (`core/backup/fixtures/`): merge, replace restore, idempotence, tombstone, edit after migration, old → new device via `MemoryServer`. Show the mapping table to the maintainer before the first real run.
4. **Retire the source:** keep `schema.ts`, `repo.ts`, `migrations.ts`, `manifest.ts` with `retired: true` (contract: `validateRetired`); `git rm` pages, widgets, importers, seed, tests. Tables stay until a later cleanup package (as in 0.9.0: a sync pull would drop ops for unknown tables; removing them = `db:bump`, history, `REMOVED_ON_PURPOSE` in `schema-upgrade.test.ts`, delete the step and the module).
5. **Surroundings:** `LEGACY_REDIRECTS` in `router.tsx`, setup profiles, `strings.ts` blocks, fixed id lists in tests (`exclusion`, `dataapi`, `localapi`, e2e `a11y`/`layout`/`seed`), quick capture targets, docs, CHANGELOG "Breaking" (all devices must update).
