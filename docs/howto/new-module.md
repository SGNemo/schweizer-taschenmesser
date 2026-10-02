# New module, widget, platform-only module

Recipes for modules. Index: [HOW-TO](../HOW-TO.md). Commands run in `web/` unless stated.

## New module
1. `npm run gen:module -- <id> "<Name>"` (alias `npm run new:module`; id lowercase alphanumeric; copies `templates/module` incl. widget, widget hook and widget test, runs `db:bump`).
2. Edit `src/modules/<id>/`: `seed.ts` + `seed` in the manifest (mandatory, [seed-data.md](seed-data.md)), `schema.ts` (Zod), `repo.ts` (`createRepo`), `ai.ts` (compact; `titleField` must be a field; omit for private data), `settings.ts`, `routes/`, `widgets/`, `migrations.ts`, `manifest.ts` (`icon`, `description`, `defaultEnabled`, `layout`, `order`, `area` = navigation area `plan|money|household|knowledge|vault|system`, required).
3. Routes start with `/<id>`; `nav: true` for navigation; `contributions.quickAdd` for the FAB.
4. `contributions.onboarding` is required: importers (`onboarding.ts`, `importer.ts`, see `modules/todos`) or `noOnboarding`.
5. Data-API: every synced collection gets the generic JSON importer; collections holding secrets/connector data need `dataApi: false`.
6. German strings in `src/strings.ts`. Add the route to `PAGES` and the id to `MODULES` in `e2e/a11y.spec.ts`. Add an E2E case for user flows.
7. Collection/index change later → `npm run db:bump` **and** add previous stores to `src/core/db/schema-history.json`; data-shape change → bump `manifest.version` + `manifest.migrations`.
8. `npm run check:modules && npm run lint && npm run typecheck && npm test`. The widget is mandatory, see *Build a widget*.

## Build a widget (mandatory for every module)
1. `manifest.ts`: `widgets: [{ id, title, sizes: ALL_WIDGET_SIZES, defaultSize: 's', component: () => import('./widgets/XWidget') }]` (`ALL_WIDGET_SIZES` from `@/core/modules/types`). `npm run gen:module` / `npm run new:module` creates all of it.
2. `widgets/useX.ts`: a `useLiveQuery` hook that returns `undefined` while loading and reads only the module's own repos. `widgets/XWidget.tsx`: default export, `WidgetList` with `loading`, `empty` + `emptyAction={{ label, to: '/<id>?new=1' }}` (a primary action, not just "Keine …"), `to`/`linkLabel`. Texts in `strings.ts` (`t.homeEmpty.<id>` for the action).
3. No data to show (e.g. desktop modules): a status widget; never file names, vault entries or other private content.
4. Test: `__tests__/<id>.widget.test.tsx` (empty state with action, one entry). `core/modules/widgets.test.tsx` additionally renders every widget empty and with the module's example data.
5. `npm run check:modules && npm run lint && npm run typecheck && npm test`.

## New module for some platforms only (e.g. desktop)
1. In `manifest.ts` add `platforms: ['desktop']` (`'web' | 'desktop' | 'android'`; missing = everywhere). Use `availableManifests()` (`core/modules/available.ts`) in runtime code, never `visibleManifests`.
2. Native part: put the logic in a Tauri-free crate under `web/src-tauri/crates/<name>` (testable on Linux), wrap it in `src/<name>.rs`, register commands in `src/lib.rs` (desktop block), list them in `build.rs` `COMMANDS` and grant `allow-<command>` in `capabilities/desktop.json`; add the crate to the `-p` lists in `.github/workflows/ci.yml`.
3. JS side: a service in `core/platform/<name>.ts` on `PlatformService`, bridge in `core/platform/tauri/<name>.ts` (`supported` only on desktop), unsupported stub + e2e fake in `web.ts` (`--mode e2e` only).
4. Data that must not leave the device: no collections, no `aiSchema`, `dataApi: false`, id in `BLOCKED_MODULES` (`core/dataapi/scope.ts`), listed in the "no aiSchema" test in `modules/accounts/__tests__/exclusion.test.ts`.
5. E2E: `localStorage.__tmPlatformKind = 'desktop'` (init script) makes the e2e build pose as desktop; see `e2e/disk.spec.ts`.

