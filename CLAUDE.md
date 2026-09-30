# CLAUDE.md – Nemo

Modular, local-first everyday app (formerly "Schweizer Taschenmesser" – internal identifiers keep that name): PWA, plus a portable Windows exe and an Android APK (Tauri 2 shell around the same web app).
Data lives in IndexedDB; sync is a separate optional layer; an AI assistant answers questions with as few tokens as possible and never sees user data.
Code, comments and commits are **English**; the UI is **German only** (all texts in `web/src/strings.ts`).

**Stack:** Vite, React 19, TypeScript strict (pinned 6.0.x), Dexie, Zod, zustand, CSS Modules; Tauri 2 (Rust); sync server Fastify 5 + better-sqlite3; Vitest, Playwright.

## Docs (read the one for the area you touch; keep it current when a decision changes)
@docs/ARCHITECTURE-MAP.md
@docs/HOW-TO.md
@docs/DECISIONS.md
- [`docs/README.md`](docs/README.md) – index: German user docs (`docs/user/`), developer docs, reviews.
- [`docs/architecture.md`](docs/architecture.md) – long design notes per phase (not imported; read the section you need).
- [`docs/STATUS.md`](docs/STATUS.md) – done / open / known problems / next steps, plus the German hardware checklists "Manuelle Tests offen" and "Offen – macht Sven" (not imported).
- [`docs/ROADMAP.md`](docs/ROADMAP.md) – ideas for later (not implemented); [`docs/AI-IMPORT.md`](docs/AI-IMPORT.md) – German guide of the local AI import API + MCP.
- The README is short and German for users; details live in `docs/user/`. Keep it that way (no new sections in the README).

## Repo layout
- `web/src-tauri/` – native shell (Tauri 2, Rust) around the web app: portable Windows exe, Android APK. Thin by design.
- `web/` – the PWA (Vite, React 19, TypeScript strict). Own `package.json`.
- `server/` – sync server (Fastify 5 + better-sqlite3, own `package.json`, Dockerfile, compose). Separate project, no shared package.
- `mcp/` – MCP server (stdio, `@modelcontextprotocol/sdk`) wrapping the local import API; own `package.json`, no data access of its own.
- `contract/` – JSON fixtures of the sync merge rule, read by the tests of both projects.


## Commands (run in `web/`)
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm run preview` | Production build / serve on :4173 |
| `npm run typecheck` | tsc for app, service worker, node configs |
| `npm run lint` | ESLint (incl. module isolation rules) |
| `npm run format:check` / `format` | Prettier check / write (also in `server/`) |
| `npm test` | Vitest unit + component tests |
| `npm run e2e` | `e2e:app` (Playwright, projects `desktop-chrome` + `pixel-7`, builds with `--mode e2e`) followed by `e2e:sync` (`playwright.sync.config.ts`: serial multi-device tests against the real server started from `../server`, in-memory DB) |
| `npm run gen:module -- <id> "<Name>"` | Generate a new module from `templates/module` |
| `npm run db:bump` | Regenerate `src/core/db/schema.snapshot.json` + bump Dexie version |
| `npm run gen:icons` | Re-render all brand rasters (PWA, favicon, ICO, Android layers, README/social images) from `web/brand/*.svg` (native base set first: `npx tauri icon brand/app-icon.svg`) |
| `npm run tauri -- dev` / `build` | Native app (needs Rust; on Linux `libwebkit2gtk-4.1-dev libgtk-3-dev …`). `tauri build --debug --no-bundle` compiles the binary with the embedded frontend |
| `npm run version:check` / `version:sync` / `version:set -- <semver>` | Version consistency, Cargo mirror, release bump (see *Versioning*) |
| `npm run changelog -- --version <x.y.z>` | Release notes from Conventional Commits |

MCP wrapper (run in `mcp/`): `npm test`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run build` (→ `dist/index.js`).

Server (run in `server/`): `npm test` (Vitest + `fastify.inject`, in-memory SQLite), `npm run typecheck`, `npm run lint`, `npm run build` (→ `dist/`), `npm start`, `npm run dev`.

Definition of done for every phase: `lint`, `typecheck`, `test`, `e2e` green; app starts; CLAUDE.md updated; commit + push to `develop`.

Sandbox note: a Chromium is pre-installed at `/opt/pw-browsers/chromium`; `playwright.config.ts` and `gen-icons.mjs` pick it up automatically (override with `PW_CHROMIUM_PATH`). Never run `playwright install` there.

## Git workflow
- **`develop`** is the integration branch: feature branches and PRs go there. **`main`** only receives release merges (`Merge develop into main (release X.Y.Z)`); never commit or push to `main` directly.
- Tags `vX.Y.Z[-beta.N]` trigger `release.yml` (alternative: manual run on `main` with input `version`, which creates the tag itself – never both) – only the maintainer cuts releases (recipe in `docs/HOW-TO.md`). No force-push, no history rewriting on shared branches; bring `develop` in with a merge.
- Conventional Commits (`feat(scope):`, `fix:`, `feat!:`); release notes are generated from them. Do not change branch protection.


## Rules that must hold (details: `docs/architecture.md`, rationale: `docs/DECISIONS.md`)
- **Module isolation:** modules never import each other; they use the event bus (`core/events`) and manifest contributions. Only sanctioned exceptions: `finance` → `subscriptions/public.ts`, `invoices/public.ts`; `budgets` → `finance/public.ts`. ESLint + `registry.test.ts` enforce this.
- **AI import:** `core/dataapi` derives the import format from `dataSchema` (no second schema); `scope.ts` is the single filter, `accounts` must stay unreachable (`dataApi: false` + id block). New collections holding secrets/connector data need `dataApi: false`.
- **Local API (desktop):** loopback only, off by default; transport/security in `src-tauri/crates/local-api` (never add a bind-address setting, CORS, or logging of tokens/bodies), meaning in `core/localapi/handler.ts`. Tokens only as SHA-256 in `_meta`; blocked/unknown modules must answer identically. User guide: `docs/AI-IMPORT.md` (its prompt must equal `buildApiPrompt`, tested).
- **Data:** one Dexie table per collection (`<moduleId>_<collection>`); every synced record has the envelope `id, createdAt, updatedAt, deviceId, deletedAt, _f`. **Write only via `createRepo`** (`core/db/repo.ts`); modules must not import `@/core/db/db`. Never await non-Dexie promises inside Dexie transactions.
- **Schema:** collection/index change → `npm run db:bump` **and** add the previous stores to `core/db/schema-history.json`; stored data-shape change → bump `manifest.version` + `manifest.migrations`.
- **Formats:** money = integer cents; dates `'YYYY-MM-DD'`, times `'HH:mm'` (local wall clock); epoch ms only for technical timestamps. Use `now()` / `today()` from `core/time/now.ts`, never `Date.now()` in logic.
- **Sync:** field-level last-write-wins by greatest HLC; the rule exists twice (`core/sync/ops.ts`, `server/src/store.ts`) and is pinned by `contract/lww-cases.json` – change both or neither.
- **Disk module:** desktop only (`manifest.platforms`), never holds data; deleting goes through node ids → Rust plan → block list (`crates/disk-scan/src/guard.rs`, unit-tested, do not weaken) → typed confirmation checked in Rust; recycle bin by default, never a silent permanent delete. New Tauri commands need `build.rs` `COMMANDS` + `capabilities/desktop.json`.
- **Platform:** only `core/platform/**` knows about Tauri (`@tauri-apps/*` only in `core/platform/tauri/**`); everything else uses `getPlatform()`. Platform-only modules: `manifest.platforms` + `availableManifests()`.
- **AI privacy:** the assistant sends only instructions, the compact `aiSchema` of enabled modules, the date and the question – never user data (`privacy.test.ts`). The `accounts` module must never get an `aiSchema`, `searchable`, widget or calendar item (`exclusion.test.ts`).
- **Setup assistant:** progress lives device-local in `_meta` `setup.state` (step ids only – never values or secrets, never synced); each step saves on its own "Weiter", cancelling drops only the draft; it never appears by itself on an installation with data. Steps come from `setupSteps` (recipe in `docs/HOW-TO.md`).
- **Secrets:** no secrets in the repo; API keys via `getPlatform().secrets`. The bundle identifier `io.github.sgnemo.taschenmesser` must never change. The Android keystore and updater private key must never be lost or committed.
- **UI:** the app is called **Nemo** (identifiers keep the old names, see `docs/DECISIONS.md`); German only (`web/src/strings.ts`), CSS Modules + tokens, `data-autofocus` instead of `autoFocus` in dialogs, touch targets ≥ 44 px, page width via `manifest.layout` (`PageContainer`), never a module-level `max-width`.
- **Commits:** Conventional Commits (`feat(scope):`, `fix:`, `feat!:`); release notes are generated from them.
- **Releases/CI:** tag `vX.Y.Z[-beta.N]` triggers `release.yml`, or a manual run on `main` with input `version` (creates the tag; use one way, never tag push AND dispatch) (signed portable Windows exe + APK, gitleaks, artifact audit). Key handling, secrets and the audit steps are security-critical – do not weaken them. Release procedure and key creation: `docs/architecture.md` → "Releases & CI".

## Design-Richtlinien (for every new module, tool and component) – look "Klar" (flat, calm)
- **Tokens, never hard-coded values.** Colours, radii, shadows, spacing, type sizes, weights, z-index, durations come from `web/src/ui/tokens.css` (`var(--…)`). No hex/rgb in module CSS, no own `border-radius`/`box-shadow`/`z-index`/`font-weight` numbers (use `--weight-medium/semibold/bold`, `--z-*`, `--text-3xl` for hero numbers). Modules inherit the look through `@/ui`: Button, Card, Fields (`TextField` with `labelHidden` for inline add rows), Dialog, Patterns (`Segmented`, `ItemRow`, `Progress`, `Chip`, layout utilities `patternStyles.hstack/plainList/gapBottom/inlineForm`), Misc (`Badge`, `EmptyState` incl. `compact`, `Skeleton`), `WidgetList` for dashboard widgets. Never re-implement a segmented control, progress bar or input in a module; no inline `style={{}}` for layout or colour.
- **Surfaces:** solid `--bg` page, `--surface` cards with a `--border` (no shadows, no glass), `--surface-2` for quiet areas and control tracks. Shadows (`--shadow-1/2`) only on floating layers (menus, dialogs, FAB). Form controls use `--border-strong`.
- **One accent, one job:** filled `--accent` only for the page's primary action and the FAB; everything else (tabs, chips, nav, links, active states) uses `--accent` as text/icon colour or `--accent-soft`. Status colours `--danger/--success/--warning` (+ `-soft`), charts `--viz-1/--viz-2`. Amounts and dates: `font-variant-numeric: var(--font-num)`. The ocean gradient (`--ocean-from/to`) is brand only (splash, empty states, images), never a page background.
- **Contrast:** WCAG AA (4.5:1 text, 3:1 UI). `ui/tokens.test.ts` checks the palette incl. `--border-strong` on `--surface-2`; a new colour token needs a light and a dark value and an entry in that test. Touch targets ≥ 44 px (`--touch`), inline checkboxes 24 px.
- **Motion:** CSS only, `transform`/`opacity` only (progress bars scale, nothing animates width, colour or shadow), 120–250 ms (`--dur-fast/--dur/--dur-slow`, `--ease-out`), no endless animation except the `Skeleton` shimmer. Everything must be fine with `prefers-reduced-motion`. Loading: `Skeleton`, not spinners or "…".
- **Empty states:** `EmptyState` (page) or `EmptyState compact` / `WidgetList empty` (widgets); the faded Nemo fish, no illustrations per module.
- **Brand:** the fish is defined once in `design/icon/final.params.mjs`; `npm run export` (in `design/icon/`) writes `web/brand/*.svg` and the generated blocks in `Logo.tsx` and the splash, `brand-sync.test.ts` enforces they agree. Icons: `docs/HOW-TO.md` → Icons. Special styles (QR black/white) need a comment and an entry in `docs/DECISIONS.md`.
- **Checking a design change:** `SCREENS_SCHEME=dark SCREENS_VIEWPORTS=1280x720,412x915 SCREENS_PAGES='^(dashboard|finance-overview)$' npm run screenshots` renders invented data; `SCREENS_CSS=<file>` injects token overrides for experiments; `npx playwright test e2e/a11y.spec.ts` runs axe in both themes.

## Create a new module / tool / connector / provider
Step-by-step recipes: `docs/HOW-TO.md`. Short form for a module: `npm run gen:module -- <id> "<Name>"`, then edit `src/modules/<id>/`, `contributions.onboarding` is required, strings in `strings.ts`, `db:bump` on collection changes, `npm run lint && npm run typecheck && npm test`.

## Status
Stable release `v0.2.0` is out (phases 1–13 plus the AI import round: JSON import, local import API, `mcp/`); since then: setup assistant, backup/sync hardening, quick capture, the Nemo rebrand (flat design, clownfish icon C12, MIT licence, review in `docs/REVIEW-2026-09-30.md`). Details, open items and next steps: `docs/STATUS.md`; ideas: `docs/ROADMAP.md`. Device behaviour of the native shells is only verified by hand – see the German checklists there.

## Gotchas
- `pkill -f "<pattern>"` inside a shell command also matches that shell's own command line (exit 144, shell dies). Start servers with `&` + `echo $! > file` and `kill $(cat file)`; for `vite preview` the `[v]ite preview` trick works only when the pattern is not repeated elsewhere in the same command.
- Multi-device E2E lives in `e2e/sync/` (own config, `workers: 1`, shared server) and is ignored by `playwright.config.ts`. Helpers wait on IndexedDB (`_outbox` count) instead of UI state; use client-side navigation while a context is offline (a `goto` would fail).
- Tests that need "another device" create a second `TaschenmesserDB` (unit) or a second browser context (E2E); `MemoryServer` (`core/sync/testing.ts`, tests only) mirrors the server rule.
- Do not leave your own `vite preview` running on :4173 – Playwright reuses that port (`reuseExistingServer`) and would test a stale build. Stop it (`pkill -f "[v]ite preview"`) before `npm run e2e`.
- Async bus handlers (finance booking) finish *after* the UI action; E2E waits for their effect (e.g. poll IndexedDB) before navigating.
- E2E: a write is finished when the dialog that saved it has closed – wait for that (and for the UI to reflect it) before `goto`/`reload`. Fix the date with `page.clock.setFixedTime(...)`; `page.clock.install` + `fastForward` drives the notification scheduler. dnd-kit keyboard steps: wait for the live region (`[id^="DndLiveRegion"]`) between key presses.
- Vitest inlines `dexie` + `dexie-react-hooks` (`vitest.config.ts`); otherwise two Dexie copies break `useLiveQuery`.
- TypeScript is pinned to 6.0.x (typescript-eslint supports `<6.1`); `baseUrl` is not used (paths are relative).
- Controlled checkboxes update after an async DB write: in E2E use `click()` + `expect(...).toBeChecked()` instead of `check()` (Playwright's `check()` fails with "did not change its state").
- `web-push` always speaks HTTPS (even for tests); test the request with `generateRequestDetails` instead of a local HTTP server.
- E2E for the assistant: the Anthropic API is mocked with `page.route('https://api.anthropic.com/v1/messages')` (answer the CORS preflight `OPTIONS` yourself and add `access-control-allow-*` headers); test data is written straight into IndexedDB with envelope fields, so the app must have opened the DB once (`page.goto('/')`) first.
- The SDK's own retries slow error tests down: `createClaudeProvider({ maxRetries: 0 })` in unit tests.
- No secrets in the repo. API keys go through `getPlatform().secrets` (encrypted, local only); other tokens to the local `_secrets` table at runtime only.

## Ignore rules
`.ignore` (repo root) keeps lockfiles, generated files, build output, icons and screenshots out of ripgrep/fd scans; `.gitignore` files cover build folders and secrets. Read excluded files explicitly when you need them.
