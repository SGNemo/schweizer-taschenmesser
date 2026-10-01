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
| Unit + component | `npm test` (single file: `npx vitest run <path>`; only files touched since the last commit: `npm run test:changed`; watch mode: `npm run test:watch`) |
| Everyday gate, fast | `npm run check` = format + lint + the three `tsc` projects in parallel with tool caches (~34 s cold, ~6 s warm; CI keeps the plain uncached commands) |
| E2E app (desktop-chrome + pixel-7) then sync | `npm run e2e`; parts: `npm run e2e:app`, `npm run e2e:sync` |
| One spec | `npx playwright test e2e/<name>.spec.ts` |
| Server | `cd server && npm test` (+ `typecheck`, `lint`, `build`) |
| MCP wrapper | `cd mcp && npm test` (+ `typecheck`, `lint`) |
| Rust | `cd web/src-tauri && cargo fmt --check && cargo clippy --all-targets --locked -p taschenmesser -p taschenmesser-local-api -p taschenmesser-disk-scan -p taschenmesser-system-info -- -D warnings && cargo test --locked -p …` (per crate: `cargo test -p taschenmesser-disk-scan`; perf: `DISK_SCAN_PERF_FILES=1000000 cargo test -p taschenmesser-disk-scan --release -- --ignored --nocapture perf`). Windows-only code compiles without a Windows box: `rustup target add x86_64-pc-windows-msvc`, then `cargo check -p taschenmesser-disk-scan --target x86_64-pc-windows-msvc` (the main crate needs the Windows toolchain). |
| Version consistency | `npm run version:check` |
- Definition of done: `lint`, `typecheck`, `test`, `e2e` green; CLAUDE.md/docs updated.
- **Unit-test environment:** test files run in `node` by default; a file that needs a DOM (React components, `document`, `localStorage`, `window`, `DOMParser`, code such as `stores/ui.ts` that reads them) starts with `// @vitest-environment jsdom`. A forgotten marker fails with "document is not defined" (or, where app code guards the access with try/catch, silently takes the fallback path – add the marker to any test whose subject touches a DOM global). Building a jsdom per file used to cost more than all test bodies together.
- Sandbox: run e2e/vitest in the foreground (`timeout 115 …`, or `--shard`); background jobs only make progress while a foreground command runs. Never `pkill -f` a pattern that appears in your own command line.
- Before `npm run e2e` stop any own `vite preview` on :4173 (`pkill -f "[v]ite preview"`). Chromium is at `/opt/pw-browsers/chromium`; never `playwright install`.

## CI layout, caches and sharding
- `ci.yml` jobs run side by side: `changes` (decides whether anything but documentation changed), `secret-scan`, `web-static` (version check, format, lint, typecheck), `web-unit`, `web-e2e` (four Playwright shards `--shard=i/4`, two workers each), `server`, `mcp`, `e2e-sync`, `rust`. The job named **Web (lint, types, unit, E2E)** only aggregates the three web parts and keeps the check name that branch protection may list.
- **Documentation-only changes** (everything under `docs/` except `docs/AI-IMPORT.md` and `docs/user/installation.md`, plus `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `LICENSE`, issue/PR templates) skip every job except the secret scan; skipped jobs count as passed. Files that tests read (`README.md`, the two docs above, `contract/`, workflows) always count as code. When a test starts reading another file, add it to `pinned` in the `changes` job. Any doubt (no diff, new branch, error) runs everything.
- **Shards:** a new E2E spec needs no registration; tests are split by test, not by file. Locally `npx playwright test --shard=1/4` runs one slice. More than two workers per 4-core runner was slower per test and failed under load – add shards, not workers.
- **Caches** (all keyed so that a hit is the normal case): npm per lock file (`setup-node`), Playwright browsers per web lock file, `gitleaks` binary per version, Rust `target` and registry through `Swatinem/rust-cache` (per `Cargo.lock`), Gradle through `setup-java`. Caches are scoped per branch: a pull request restores what `develop` saved, a manual release run on a feature branch starts cold (Android ~9 min instead of ~5 min, Windows ~10 min instead of ~7 min).
- **Cache problems:** a job that is suddenly slow usually missed its cache (look for "cache not found" in the step log). Re-running does not help; changing the lock file or `Cargo.lock` creates a new key. To drop a poisoned cache delete it under Actions → Caches (needs write access), then re-run the job. Never fix a red job by skipping a test or a security step.
- Each job has a `timeout-minutes` so a hang cannot hold a runner for the default six hours.
- Timings before/after: [`docs/perf/BUILD-BASELINE-2026-10-01.md`](perf/BUILD-BASELINE-2026-10-01.md).

## Dev-Preview
- **What:** after every green push to `develop` that changed more than docs, `ci.yml` calls `dev-preview.yml`: gitleaks → version → signed Windows exe + Android APK (same signing, audit and keystore-cleanup steps as `release.yml`, plus `verify-sig.mjs` and `apksigner verify`) → rolling **pre-release** `dev-preview` (`--prerelease --latest=false`, assets replaced, tag moved to the commit, `dev-latest.json` uploaded last, link check, `releases/latest` compared before/after). A failed run publishes nothing; the previous preview stays.
- **Files:** `Nemo-Portable-dev.exe(.sig)`, `Nemo-dev.apk(.sha256)`, `dev-latest.json` under `…/releases/download/dev-preview/`. List: `DEV_ASSETS` in `web/scripts/lib/devPreview.ts`.
- **Version:** `<next stable>-dev.<commit count of HEAD>` (`node scripts/dev-preview.mjs version`; `full` adds `+<sha7>`), only in the build, `package.json` is never changed. Android `versionCode` = minutes since the epoch (own package id, so no relation to the stable codes).
- **Install:** download the exe/APK from the release page or the README link. It is a separate app ("Nemo Dev", identifier `io.github.sgnemo.taschenmesser.dev`, own data, own Windows Credential Manager entries, portable folder `data-dev`); bring data over via sync or backup.
- **Dev channel:** Dev builds (`VITE_RELEASE_CHANNEL=dev`, set only by the workflow) always follow `dev-latest.json` (Settings → App updates shows "Dev-Preview"); a pre-update backup is made as for stable. Stable builds cannot select the channel and ignore the `dev-preview` release (not SemVer).
- **Back to stable:** install/keep the stable app; the Dev app can simply be uninstalled/deleted.
- **Trigger manually:** Actions → Dev-Preview → Run workflow (`artifact-only`, `dev-preview-test` = throw-away pre-release `dev-preview-test`, or `dev-preview` on `develop`). Manual runs work once the workflow file is on `main` (GitHub only offers dispatch for the default branch's workflows); otherwise push to `develop`. Delete a test release with `gh release delete dev-preview-test --cleanup-tag`.
- **Cleanup:** the rolling release keeps only the latest state; workflow artifacts expire after 3 days.

## New module
1. `npm run gen:module -- <id> "<Name>"` (id lowercase alphanumeric; copies `templates/module`, runs `db:bump`).
2. Edit `src/modules/<id>/`: `schema.ts` (Zod), `repo.ts` (`createRepo`), `ai.ts` (compact; `titleField` must be a field; omit for private data), `settings.ts`, `routes/`, `widgets/`, `migrations.ts`, `manifest.ts` (`icon`, `description`, `defaultEnabled`, `layout`, `order`).
3. Routes start with `/<id>`; `nav: true` for navigation; `contributions.quickAdd` for the FAB.
4. `contributions.onboarding` is required: importers (`onboarding.ts`, `importer.ts`, see `modules/todos`) or `noOnboarding`.
5. Data-API: every synced collection gets the generic JSON importer; collections holding secrets/connector data need `dataApi: false`.
6. German strings in `src/strings.ts`. Add the route to `PAGES` and the id to `MODULES` in `e2e/a11y.spec.ts`. Add an E2E case for user flows.
7. Collection/index change later → `npm run db:bump` **and** add previous stores to `src/core/db/schema-history.json`; data-shape change → bump `manifest.version` + `manifest.migrations`.
8. `npm run lint && npm run typecheck && npm test`.

## New module for some platforms only (e.g. desktop)
1. In `manifest.ts` add `platforms: ['desktop']` (`'web' | 'desktop' | 'android'`; missing = everywhere). Use `availableManifests()` (`core/modules/available.ts`) in runtime code, never `visibleManifests`.
2. Native part: put the logic in a Tauri-free crate under `web/src-tauri/crates/<name>` (testable on Linux), wrap it in `src/<name>.rs`, register commands in `src/lib.rs` (desktop block), list them in `build.rs` `COMMANDS` and grant `allow-<command>` in `capabilities/desktop.json`; add the crate to the `-p` lists in `.github/workflows/ci.yml`.
3. JS side: a service in `core/platform/<name>.ts` on `PlatformService`, bridge in `core/platform/tauri/<name>.ts` (`supported` only on desktop), unsupported stub + e2e fake in `web.ts` (`--mode e2e` only).
4. Data that must not leave the device: no collections, no `aiSchema`, `dataApi: false`, id in `BLOCKED_MODULES` (`core/dataapi/scope.ts`), listed in the "no aiSchema" test in `modules/accounts/__tests__/exclusion.test.ts`.
5. E2E: `localStorage.__tmPlatformKind = 'desktop'` (init script) makes the e2e build pose as desktop; see `e2e/disk.spec.ts`.

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

## Icons / branding
- Change the logo (one source): edit the parameters in `design/icon/final.params.mjs` (`ICON`: body height, stripes `at/width/bend`, eye, `soften`, `tilt`, colours, tile `plate`, `adaptive` scale; `DEEP` = logo colour; `WORDMARK`; `MASKABLE_SAFE_RADIUS`). Then
  1. `cd design/icon && npm ci && npm run export` writes `web/brand/*.svg` (mark, mono, app icon, maskable, Android layers, wordmarks), the marked block in `web/src/ui/Logo.tsx` (`// brand:begin … // brand:end`) and the splash in `web/index.html` (`<!-- brand:begin --> … <!-- brand:end -->`). Do not edit those blocks by hand. Then `cd ../../web && npm run format` (the generated splash markup is not prettier-formatted).
  2. `cd web && npx tauri icon brand/app-icon.svg && npm run gen:icons` regenerates the Tauri set (Windows sizes, `icon.icns`, Android legacy mipmaps) and re-renders PWA icons (192/512/maskable), `favicon.svg/.ico/-32.png`, `pwa-badge-96.png`, `icon.ico`, the Android adaptive/monochrome/notification layers, the README headers (light + dark) and the social preview, and deletes the unused iOS/appx sets.
  3. `npm test` (`brand-sync.test.ts` keeps SVGs, `Logo.tsx` and splash in step; SVG ids unique per file), commit the results. If the logo colour changes, also `ANDROID_ICON.iconColor` in `core/platform/tauri/index.ts` (+ `tauri.test.ts`).
  Trying a change first: copy a round folder (`design/icon/rounds/6/variants.mjs`), `node render-round.mjs <path>` renders a preview sheet (16–512 px, light/dark, taskbar/tray, Android masks + safe zone, themed icon) without touching the app.
- Wordmark: the outlines of "Nemo" come from Nunito ExtraBold (OFL, see `web/brand/LICENSES.md`), stored once in `design/icon/glyphs.json`; the SVGs contain paths, no font. Concepts live in `design/icon/wordmark.mjs` (`clown` is the current one, parameters `WORDMARK` in `final.params.mjs`; `npm run export` writes `web/brand/logo-wordmark*.svg`).
- Banner (README header light/dark + social preview): composed in `scripts/gen-icons.mjs` from the wordmark SVGs, a faint school of marks and the claim (`CLAIM` in `final.params.mjs` is the source of truth; the list in `gen-icons.mjs` must match). Trying compositions: `cd design/icon && node banners.mjs rounds/<n>` renders `<n>/banners.mjs` into PNGs and sheets without touching the app.
- Android: the launcher layers reach the APK through the copy step after `tauri android init` in `release.yml`; the status-bar icon is `ic_notification` (referenced from `core/platform/tauri/index.ts`).

## Design tokens
- Colours, radii, shadows, type scale, weights, z-index, motion live in `web/src/ui/tokens.css` only. Change a semantic token there; components pick it up. The dark palette exists twice in the file – edit both (`tokens.test.ts` fails if they differ) and keep the contrast pairs AA (the test checks them, incl. `--border-strong` on `--surface-2`). Do not put `--name:` patterns into comments inside the file (the test's parser reads them as declarations).
- New accent colour: add a `:root[data-accent='<name>']` block with `light-dark()` pairs (`--accent`, `-hover`, `-contrast`, `-soft`), extend `ACCENTS` in `web/src/stores/ui.ts`, the `settings.accentOptions` strings and the inline script in `web/index.html`; `tokens.test.ts` lists the variants to check.
- Trying a look before changing tokens: write overrides into a CSS file and render invented data with `SCREENS_CSS=<file> SCREENS_SCHEME=dark npm run screenshots` (see `docs/design-proposals/variant-*.css`). Compare against `docs/screenshots/`.
- Layout helpers instead of inline styles: `patternStyles.hstack/hstackCenter/hstackWrap/grow/plainList/gridList/gapTop/gapBottom/spacer/fieldset/inlineForm` (`web/src/ui/Patterns.module.css`).

## Release (needs the maintainer; keys never in CI/repo)
1. `develop` green in CI. Do not weaken signing/audit steps.
2. `cd web && npm run version:set -- X.Y.Z[-beta.N]` (suffix only `alpha|beta|rc`), commit `chore(release): X.Y.Z`.
3. Stable release: merge `develop` into `main` (as for 0.2.0: `Merge develop into main (release X.Y.Z)`); pre-release tags were cut from `develop`.
4. `git tag vX.Y.Z && git push origin <branch> vX.Y.Z` (tag must equal `web/package.json`). Workflow `release.yml` builds portable exe + APK, gitleaks, audit, publishes; then checks all download links.
   Alternative without pushing a tag: Actions → Release → Run workflow on `main` with `version` = X.Y.Z (must equal `web/package.json`; fails if tag `vX.Y.Z` exists). The workflow creates tag + release on that commit. Use one way per release, never tag push AND dispatch.
5. Changelog preview: `npm run changelog -- --version X.Y.Z`. Keys/secrets/audit details: `architecture.md` → "Releases & CI". Dry run without release: push to `develop` touching `web/src-tauri/**`, `web/scripts/**` or the workflow, or run the workflow manually without `version`.

## Git workflow
- Work on a feature branch, PRs into `develop`; `main` only receives release merges. Conventional Commits (`feat(scope):`, `fix:`, `feat!:`). Merge `develop` into your branch (no rebase of shared history).

## Other recipes
- Regenerate PWA icons: `npm run gen:icons` (native: `npx tauri icon brand/app-icon.svg`, see *Icons / branding*).
- Screenshots (manual, not CI): `npm run screenshots`; filters `SCREENS_VIEWPORTS`, `SCREENS_PAGES`, `SCREENS_SCHEME=dark`, `SCREENS_DIR`, `SCREENS_CSS`. The README images are `docs/screenshots/readme/dashboard-{light,dark}.png` (1280×720 dashboard).
- Use the local AI import API / MCP: `docs/AI-IMPORT.md`.
