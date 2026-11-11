# Architecture map – Nemo

Fast "where is what" index (paths checked against the tree). Rationale and long design notes: [architecture.md](architecture.md) (topic files in `docs/architecture/`). Decisions: [DECISIONS.md](DECISIONS.md). Detail rows for home/setup/desktop/update channels live in the topic files.

> Not `ARCHITECTURE.md`: `architecture.md` exists and code references it (`web/src-tauri/crates/local-api/src/lib.rs`); names would collide on Windows/macOS.

## Top level
| Path | What |
|---|---|
| `web/` | PWA (Vite, React 19, TS strict); own `package.json`; all UI/logic |
| `web/src-tauri/` | Tauri 2 shell (Rust): portable Windows exe, Android APK; crates `local-api`, `disk-scan`, `system-info`, `lan-sync` (home-network hub: store, Noise, pairing, network; web side `core/sync/adapters/lanHub.ts`, `pages/settings/LanHubSection.tsx`), `remote-input` (remote control sink: volume, media session, lock as system calls on one worker thread; the only simulated input in two files, each on its own thread: the pointer – move, left/right, wheel – in `src/pointer.rs`, the keyboard – text as Unicode units and sixteen fixed keys – in `src/keyboard.rs`; wired by `src/remote.rs`, which holds the PC's controls behind a native confirmation; web side seam `remoteHost`, `core/remote/host.ts`, `pages/settings/RemoteHostSection.tsx`, `layout/RemoteChip.tsx`; phone side `src/remote_client.rs` (mobile only), seam `remote`, `core/remote/session.ts`, module `modules/remote` = "Fernbedienung", Android only) |
| `design/logo-v2/` | Logo workshop (no dependencies of its own, not part of the app; renders with Playwright from `web/`): parametric master (`mark.mjs`, `wordmark.mjs`), the chosen parameters `final.params.mjs`, `node export.mjs` → `web/brand/*.svg` + `Logo.tsx` + splash, preview sheets and screenshots per round in `rounds/` (`docs/HOW-TO.md` → Icons) |
| `server/` | Sync server (Fastify 5 + better-sqlite3), Dockerfile, compose |
| `mcp/` | MCP stdio wrapper around the local import API (own project) |
| `contract/` | `lww-cases.json` – merge-rule fixtures used by web and server tests |
| `docs/` | index [`README.md`](README.md); `user/` (user docs, English + `*.de.md`), `architecture.md` + `architecture/`, `howto/`, `decisions/`, `AI-IMPORT.md`, `STATUS.md`, `MANUAL-TESTS.md`, `ROADMAP.md`, `CHATS.md`, `PROMPT-TEMPLATES.md`, `meta/`, `security/`, `perf/`, `features/`, `archive/`, `design-proposals/`, `brand/` (rendered headers) |
| root files | `README.md` (short, German), `LICENSE` (MIT), `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md` |
| `site/` | Website (Astro, static, own `package.json`): download buttons from `src/release/latest.json` (refreshed by `scripts/fetch-release.mjs`), DE at `/`, EN at `/en`, legal placeholders, tokens pinned to the app (`scripts/tokens.test.mjs`); deployment via Cloudflare Pages ([site/README.md](../site/README.md)) |
| `.github/workflows/` | `ci.yml`, `release.yml`, `dev-preview.yml` (reusable, called from `ci.yml`), `site.yml` (only on `site/**` changes) |

## `web/` layout
- `src/core/` – framework code (no UI pages): db, sync, ai, crypto, modules, platform, …
- `src/modules/<id>/` – feature modules (manifest-driven). Present: accounts, bookmarks, budgets, calendar, **disk** (desktop only), example (dev only), **feeds** (subscription list), finance, **clock** (Uhr: places and their time, preview), **fitness** (training + rough kcal, preview), invoices, **lists**, **maps** (Karten & Orte), notes, pantry, **people**, subscriptions, todos, vault, browser, chat, downloads, habits, mail, music, planner, timetrack, weather; **disk** = Dieser PC.
- `src/tools/<id>/` – helpers (16: calc, currency, dates, dev, dice, diff, image, pdf, persona, qr, regex, screenshot, text, timer, timezones, units).
- `src/connectors/<id>/` – outside services: `google/`, `ics/`.
- `src/layout/` – app shell: `AppShell`, `Sidebar` (rail), `TopBar`, `BottomNav`, `AreaFrame`, `useNavItems`, `PageContainer`, `CommandPalette`, `QuickAdd`, `tools/` (toolbox panel), `assistant/`.
- `src/pages/` – `settings/` (layout, sections, `PageHead`), `ModuleLibrary.tsx`, `ToolLibrary.tsx`, `library/` (detail page, `WidgetMiniature`, shared on/off hook), `ShareTarget.tsx`, `dashboard/`, `NotFound.tsx`.
- `src/ui/` – design system: `tokens.css` (+ `tokens.test.ts`), `global.css`, Button, Card, Dialog (sheet on phones), Fields, Tabs, Patterns (`Segmented`, `ItemList`/`ItemRow`, `Progress`, `SplitView`), Misc (Badge, EmptyState, ErrorState, Skeleton, Toaster), `SelectionBar`, `useSelection`/`useSwipeRow`/`useDraft`, `WidgetList.tsx`, HelpHint, `Logo.tsx`, `icons.tsx`.
- `web/brand/` – logo/icon SVG sources + font licences (one fish, mask-based; `src/brand-sync.test.ts` keeps Logo/splash in step); `scripts/gen-icons.mjs` renders all raster assets (see HOW-TO → Icons).
- `src/router.tsx`, `src/App.tsx`, `src/main.tsx` (startup order), `src/sw.ts` (service worker), `src/stores/ui.ts` (zustand UI state), `src/strings.ts` (**German UI source** `de` + localized `t`; translations `src/i18n/locales/<lang>/`, runtime `src/core/i18n/` – language, catalogs, `format.ts` for dates/numbers/sorting).
- `templates/module/` – scaffold used by `scripts/gen-module.mjs`.
- `scripts/` – `db-bump`, `gen-module`, `gen-icons`, `version`, `changelog`, `keys`, `android-sign`, `audit-release`, `latest-json` (`UPDATER_PORTABLE_ASSET`), `release-assets` (asset list for the workflow), `check-links` (+ tested `scripts/lib/*.ts`).
- `e2e/` – Playwright specs (one per area, e.g. `settings`, `a11y`, `backup`), shared `helpers.ts` (`ready`, `enable`, `mainNav`); `e2e/sync/` multi-device; `e2e/screenshots/capture.spec.ts` (manual tool, not CI; `SCREENS_*` env filters). Config: `playwright.config.ts`, `playwright.sync.config.ts`, `playwright.screens.config.ts`, env `.env.e2e`.

## Where things live
One table per topic (columns: Area · Location · Key names):
- [core](architecture-map/core.md) – module registry and filters, manifest, contributions, tools, event bus, DB, settings, time, sync client/server, crypto, secrets, backup, share, diagnostics, recovery, language
- [ai-import](architecture-map/ai-import.md) – AI providers/writes/router, quick capture, assistant, mail, connectors, importers, data API, local import API, MCP, seeds
- [shell](architecture-map/shell.md) – home screen, module identity v3.1, cockpit, focus aids, day/week planning, trash, undo/keyboard, automations, navigation areas, layout, notes editor, setup assistant, notifications
- [desktop](architecture-map/desktop.md) – legal notices, supporter mode, platform layer, disk/system/browser/downloads modules, Tauri commands/shell/plugins, changelog, self-update and channels, browser extension, vault

## Data flow
1. **Write:** UI → module `repo.ts` (`createRepo`) → Zod validation → HLC-stamped fields → Dexie table + `_outbox` (unless `local: true`).
2. **Read:** `useLiveQuery` on `repo.active()` → components. Cross-module info only via event bus / manifest contributions.
3. **Sync:** `startSync` triggers → `runSync` (pull, then push) → `SyncAdapter` (`selfHosted`) → `server/src/app.ts` → `store.ts`. Optional per-value AES-GCM encryption in `core/sync/crypto.ts`. Remote ops merged by `mergeOps`, applied via `StorageAdapter.applyRemote`.
4. **Assistant:** palette → tier 1 local parser (0 tokens) → full text → intent cache → model via router (`createRouterProvider`) → validated `Intent` → executor on local Dexie. Model only sees schema text, date, question.
5. **Import:** wizard/JSON paste/local API → `buildPreview` (dedupe, validation) → user confirms → `commitImport` → `repo.createMany` → batch row in `_imports` (undo).
6. **Native calls:** anything OS-specific goes through `getPlatform()`; only `core/platform/tauri/**` imports `@tauri-apps/*`.

## Interfaces and tests
Key interfaces (`ModuleManifest`, `PlatformService`, `SyncAdapter`, server REST …) and the test/CI map: [architecture/interfaces-tests.md](architecture/interfaces-tests.md).
