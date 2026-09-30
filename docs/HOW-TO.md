# How-to recipes – Nemo

Commands run in `web/` unless stated. Background: [`ARCHITECTURE-MAP.md`](ARCHITECTURE-MAP.md), [`architecture.md`](architecture.md).

## Set up & run locally
- `cd web && npm ci`, `cd ../server && npm ci` (and `cd ../mcp && npm ci` if you touch `mcp/`).
- Dev server: `npm run dev`. Production build: `npm run build`; serve: `npm run preview` (:4173).
- Native shell: `npm run tauri -- dev` (needs Rust; Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev …`). Compile with embedded frontend: `npm run tauri -- build --debug --no-bundle`.
- Sync server: `cd server && cp .env.example .env` (set `SYNC_TOKEN`, ≥ 16 chars), `npm run dev`. Docker: `server/docker-compose.yml` (serves PWA + API).

## Tests & checks
| What | Command |
|---|---|
| Lint / types / format | `npm run lint`, `npm run typecheck`, `npm run format:check` (also in `server/`, `mcp/`) |
| Unit + component | `npm test` (single file: `npx vitest run <path>`) |
| E2E app (desktop-chrome + pixel-7) then sync | `npm run e2e`; parts: `npm run e2e:app`, `npm run e2e:sync` |
| One spec | `npx playwright test e2e/<name>.spec.ts` |
| Server | `cd server && npm test` (+ `typecheck`, `lint`, `build`) |
| MCP wrapper | `cd mcp && npm test` (+ `typecheck`, `lint`) |
| Rust | `cd web/src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test` (local API only: `cargo test -p taschenmesser-local-api`) |
| Version consistency | `npm run version:check` |
- Definition of done: `lint`, `typecheck`, `test`, `e2e` green; CLAUDE.md/docs updated.
- Before `npm run e2e` stop any own `vite preview` on :4173 (`pkill -f "[v]ite preview"`). Chromium is at `/opt/pw-browsers/chromium`; never `playwright install`.

## New module
1. `npm run gen:module -- <id> "<Name>"` (id lowercase alphanumeric; copies `templates/module`, runs `db:bump`).
2. Edit `src/modules/<id>/`: `schema.ts` (Zod), `repo.ts` (`createRepo`), `ai.ts` (compact; `titleField` must be a field; omit for private data), `settings.ts`, `routes/`, `widgets/`, `migrations.ts`, `manifest.ts` (`icon`, `description`, `defaultEnabled`, `layout`, `order`).
3. Routes start with `/<id>`; `nav: true` for navigation; `contributions.quickAdd` for the FAB.
4. `contributions.onboarding` is required: importers (`onboarding.ts`, `importer.ts`, see `modules/todos`) or `noOnboarding`.
5. Data-API: every synced collection gets the generic JSON importer; collections holding secrets/connector data need `dataApi: false`.
6. German strings in `src/strings.ts`. Add the route to `PAGES` and the id to `MODULES` in `e2e/a11y.spec.ts`. Add an E2E case for user flows.
7. Collection/index change later → `npm run db:bump` **and** add previous stores to `src/core/db/schema-history.json`; data-shape change → bump `manifest.version` + `manifest.migrations`.
8. `npm run lint && npm run typecheck && npm test`.

## New tool
Tools are not modules (no own data, no cross-imports; see `tools/isolation.test.ts`).
1. Create `web/src/tools/<id>/` with `manifest.ts` (copy `tools/uuid/manifest.ts`: `id`, `name`, `icon`, `description`, `group` `basis|extra|dev`, `offline`, `defaultEnabled`, `order`, `component: () => import('./Tool')`), `Tool.tsx`, optional pure `logic.ts` + `logic.test.ts`.
2. Strings under `t.tools.<id>` in `src/strings.ts`. Discovery is automatic (`core/tools/registry.ts` glob).
3. Persist anything through `useSettings` (scope `tools.<id>`); do not import modules, connectors, `core/db`, `core/ai`.
4. No generator exists (`gen:module` is modules only).

## New connector
1. `web/src/connectors/<id>/index.ts` default-exporting a `ConnectorDef` (`core/connectors/types.ts`; model: `connectors/ics/index.ts`, OAuth model: `connectors/google/`). Auto-discovered via glob `connectors/*/index.ts`.
2. Fill `id, name, authType, platforms, features[] (own scopes), calendar? / mail?, isConfigured, settings?`. Use only the `ConnectorContext` (`fetch`, `accessToken()`, `fetchPublic`, scoped `secrets`, `redact()`).
3. Isolation: must not import modules, `@/core/db/*`, `@/core/sync|backup/*`, `@/core/ai/*` (lint + `connectors/isolation.test.ts`). Deliver data via manifest contributions (`externalCalendar`, importer input kind `connector`).
4. Secrets only via `getPlatform().secrets`; error text through `redact()`; tests use invented tokens (allow-list in `.gitleaksignore` / `gitleaks:allow` if needed).
5. Public URLs in the browser need the sync server proxy (`server/src/proxy.ts`).

## New setup step (module / tool / connector)
1. Create the step component (default export, props `SetupStepProps`): keep the draft in state, `registerCommit(async () => …)` in an effect (return `null` on cleanup), `setCanContinue(false)` while input is invalid. Return `'skipped'` from the commit to record the step as skipped.
2. Define it: `setupSteps: SetupStepDef[]` in the manifest (`id` = `<owner id>.<name>`, `title`/`description` from `strings.ts`, `order`, `since` = current `SETUP_VERSION`, optional `when(ctx)` and `isDone(ctx)`, `component: () => import(...)`). Keep heavy imports lazy (`isDone`/`when` run when the checklist renders).
3. Core steps (not owned by a module) go to `core/setup/steps/index.ts`, component in `layout/setup/steps/`.
4. Never write secrets into the setup state; use `getPlatform().secrets` / the crypto service. Reuse existing explicit actions instead of duplicating them.
5. New steps in a later release: bump `SETUP_VERSION` and set `since`; users who finished earlier see them as "Neu" in the checklist.
6. Tests: component test with `registerCommit` harness (see `layout/setup/steps/steps.test.tsx`), plus `registry.test.ts` checks ids/prefixes.

## New AI provider
- **OpenAI-compatible endpoint (usual case):** add a preset in `web/src/core/ai/providers/presets.ts` (`kind: 'openai-compatible'`, base URL, default model/prices/limits, `tier` `local|free|paid`, `mayTrainOnInputs`). No code elsewhere; model names/prices are only editable defaults – verify them.
- **New protocol:** new adapter `core/ai/providers/<name>.ts` implementing `AiProvider` (`types.ts`), map errors to `AiErrorCode`, extend `ProviderKind` (`presets.ts`) and the `kind` enum + `createProviderFor` (`core/ai/config.ts`), all HTTP through `PlatformService.fetch`.
- Add the adapter to `core/ai/privacy.test.ts` (request must contain only question, date, schema text; key only in its header) and a fixture test for request/response shapes. Router/fallback needs no change.

## Import: new importer for a module
Add `ImporterMeta` entries in the module manifest `contributions.onboarding` and a lazy `load()` returning `ImporterRuntime` (parse, dedupe key) – see `modules/todos/onboarding.ts` and `core/importer/types.ts`. Parsers shared in `core/io/`.

## Release (needs the maintainer; keys never in CI/repo)
1. `develop` green in CI. Do not weaken signing/audit steps.
2. `cd web && npm run version:set -- X.Y.Z[-beta.N]` (suffix only `alpha|beta|rc`), commit `chore(release): X.Y.Z`.
3. Stable release: merge `develop` into `main` (as for 0.2.0: `Merge develop into main (release X.Y.Z)`); pre-release tags were cut from `develop`.
4. `git tag vX.Y.Z && git push origin <branch> vX.Y.Z` (tag must equal `web/package.json`). Workflow `release.yml` builds portable exe + APK, gitleaks, audit, publishes; then checks all download links.
5. Changelog preview: `npm run changelog -- --version X.Y.Z`. Keys/secrets/audit details: `architecture.md` → "Releases & CI". Dry run without release: push to `develop` touching `web/src-tauri/**`, `web/scripts/**` or the workflow, or run the workflow manually.

## Git workflow
- Work on a feature branch, PRs into `develop`; `main` only receives release merges. Conventional Commits (`feat(scope):`, `fix:`, `feat!:`). Merge `develop` into your branch (no rebase of shared history).

## Other recipes
- Regenerate PWA icons: `npm run gen:icons` (native: `npx tauri icon public/icon.svg`).
- Screenshots (manual, not CI): `npm run screenshots`.
- Use the local AI import API / MCP: `docs/AI-IMPORT.md`.
