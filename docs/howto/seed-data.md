# Seed data, Dev-Preview test data

Recipes for generated test data. Index: [HOW-TO](../HOW-TO.md). Commands run in `web/`.

## Seed bauen (mandatory for every module)
1. Manifest: `seed: { version: 1, dependsOn: [] }` (`dependsOn` = modules whose rows you reference or write to, e.g. `['finance']`). No stored data (live desktop data): `seed: { version: 1, dependsOn: [], none: 'live-data' }` and no `seed.ts`.
2. `src/modules/<id>/seed.ts`: `export default { seed } satisfies SeedModule` (`core/seed/types.ts`; `gen:module` writes a starting point). `seed(ctx)` returns `{ <collection>: [{ id, data }] }`, `data` matching the collection's Zod schema. Rows for a dependency use the key `<moduleId>.<collection>` (invoices book their paid invoices as `finance.transaction`, id `inv-<invoiceId>`, like the real event handler).
3. Pure and deterministic: only `ctx.rng` (mulberry32, one stream per module), `ctx.today`, `ctx.day(n)`, `ctx.at(n, 'HH:mm')`, `ctx.count({ small, medium, large })`, `ctx.id(module, collection, key)`. Never `Date.now()`, `Math.random()`, `new Date()`.
4. Content: invented German data only (no real names, addresses, IBANs, mails; `example.org`); dates relative to `ctx.today` so every widget is non-empty. `small` = what E2E needs (≈ 3–12 rows per collection), `medium` = realistic default, `large` = performance (5,000 bookings); `small ≤ medium ≤ large` is tested.
5. Data that is not plain rows (the vault demo): export `afterSeed(ctx)` (returns the created ids, they are registered) and optionally `beforeRemove()`; only the module's own API. The demo vault is created only when none exists, passphrase `nemo-demo-tresor` (shown in Settings → Entwickler).
6. Output changed → bump `seed.version` and renew E2E snapshots on purpose.
7. `npx vitest run src/core/seed` (contract for ALL modules: schema, determinism, dependency order, removal) and `npm run check:modules`.

## Dev app with test data
- Only builds with `VITE_RELEASE_CHANNEL=dev` contain the tooling; `core/seed/load.ts` is the only door and `core/seed/devFlag.test.ts` builds twice to prove a stable build contains none of it. Dev UI texts live in `strings.dev.ts` for the same reason.
- First start with an empty database: all modules on, `medium` set loaded, setup assistant done, banner "Testdaten geladen, entfernen unter Einstellungen → Entwickler". Never over existing data; not again after removal or reset (mark in `localStorage`).
- Settings → Entwickler: load (scale), remove (only registered seed rows), reset everything (type `ZURÜCKSETZEN`), "Seed-Sync erlauben" (default off), seed version, reference date, counts per module. Palette: "Testdaten laden/entfernen".
- Seed rows are registered in the local table `_seeds` before they are written; `readOutbox`, `markAllDirty` and `createBackup` skip them. With the switch on they are queued once and removal writes tombstones.

## Test data for E2E and screenshots
- `npm run e2e:seed` runs project `seed-dev` (`e2e/seed/`): the app built with `--mode e2e-seed` (`.env.e2e-seed`, `VITE_RELEASE_CHANNEL=dev`) on :4174 (`build:e2e-seed`, `preview:e2e-seed`, folder `dist-e2e-seed`). `npm run e2e` runs it too; the other specs stay on the stable build.
- `bootDev(page)` fixes the clock to `SEED_TODAY` and switches the first-start auto-fill off; `seedApp(page, 'small')` loads through Settings → Entwickler.
- `npm run screenshots` (project `seeded`) uses the same seeds (`SCREENS_SCALE`, default `medium`); the demo vault passphrase unlocks the accounts shot. Setup/disk screenshots stay on the stable build.
