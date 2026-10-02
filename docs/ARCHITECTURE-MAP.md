# Architecture map – Nemo

Fast "where is what" index (paths checked against the tree). Rationale and long design notes: [architecture.md](architecture.md) (topic files in `docs/architecture/`). Decisions: [DECISIONS.md](DECISIONS.md). Detail rows for home/setup/desktop/update channels live in the topic files.

> Not `ARCHITECTURE.md`: `architecture.md` exists and code references it (`web/src-tauri/crates/local-api/src/lib.rs`); names would collide on Windows/macOS.

## Top level
| Path | What |
|---|---|
| `web/` | PWA (Vite, React 19, TS strict); own `package.json`; all UI/logic |
| `web/src-tauri/` | Tauri 2 shell (Rust): portable Windows exe, Android APK; crates `local-api`, `disk-scan`, `system-info` |
| `design/icon/` | Icon/logo workshop (own `package.json`, not part of the app): parametric fish generator, master parameters `final.params.mjs`, `npm run export` → `web/brand/*.svg` + `Logo.tsx` + splash, round previews in `rounds/` (`docs/HOW-TO.md` → Icons) |
| `server/` | Sync server (Fastify 5 + better-sqlite3), Dockerfile, compose |
| `mcp/` | MCP stdio wrapper around the local import API (own project) |
| `contract/` | `lww-cases.json` – merge-rule fixtures used by web and server tests |
| `docs/` | index [`README.md`](README.md); `user/` (German user docs), `architecture.md` + `architecture/`, `howto/`, `decisions/`, `AI-IMPORT.md`, `STATUS.md`, `MANUAL-TESTS.md`, `ROADMAP.md`, `CHATS.md`, `PROMPT-TEMPLATES.md`, `meta/`, `security/`, `perf/`, `features/`, `archive/`, `design-proposals/`, `brand/` (rendered headers), `screenshots/` |
| root files | `README.md` (short, German), `LICENSE` (MIT), `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`, `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md` |
| `.github/workflows/` | `ci.yml`, `release.yml`, `dev-preview.yml` (reusable, called from `ci.yml`) |

## `web/` layout
- `src/core/` – framework code (no UI pages): db, sync, ai, crypto, modules, platform, …
- `src/modules/<id>/` – feature modules (manifest-driven). Present: accounts, bookmarks, budgets, calendar, **disk** (desktop only), example (dev only), finance, invoices, **lists**, notes, pantry, **people**, reminders, subscriptions, todos, vault; retired: birthdays, contracts, gifts, habits, launcher, news, packing, shopping, timetrack; **disk** = Dieser PC.
- `src/tools/<id>/` – small stateless helpers (12: calc, currency, dates, dev, dice, image, pdf, qr, text, timer, timezones, units).
- `src/connectors/<id>/` – outside services: `google/`, `ics/`.
- `src/layout/` – app shell: `AppShell`, `Sidebar` (rail), `TopBar`, `BottomNav`, `AreaFrame`, `useNavItems`, `PageContainer`, `CommandPalette`, `QuickAdd`, `ToolsSheet`, `assistant/`.
- `src/pages/` – `Settings.tsx` + `settings/*Section.tsx`, `ModuleLibrary.tsx`, `ToolLibrary.tsx`, `ShareTarget.tsx`, `dashboard/`, `NotFound.tsx`.
- `src/ui/` – design system: `tokens.css` (+ `tokens.test.ts`), `global.css`, Button, Card, Dialog (sheet on phones), Fields, Tabs, Patterns (`Segmented`, `ItemList`/`ItemRow`, `Progress`, `SplitView`), Misc (Badge, EmptyState, ErrorState, Skeleton, Toaster), `SelectionBar`, `useSelection`/`useSwipeRow`/`useDraft`, `WidgetList.tsx`, HelpHint, `Logo.tsx`, `icons.tsx`.
- `web/brand/` – logo/icon SVG sources + font licences (one fish, mask-based; `src/brand-sync.test.ts` keeps Logo/splash in step); `scripts/gen-icons.mjs` renders all raster assets (see HOW-TO → Icons).
- `src/router.tsx`, `src/App.tsx`, `src/main.tsx` (startup order), `src/sw.ts` (service worker), `src/stores/ui.ts` (zustand UI state), `src/strings.ts` (**all German UI text**).
- `templates/module/` – scaffold used by `scripts/gen-module.mjs`.
- `scripts/` – `db-bump`, `gen-module`, `gen-icons`, `version`, `changelog`, `keys`, `android-sign`, `audit-release`, `latest-json` (`UPDATER_PORTABLE_ASSET`), `release-assets` (asset list for the workflow), `check-links` (+ tested `scripts/lib/*.ts`).
- `e2e/` – Playwright specs (`a11y, accounts, assistant, backup, connectors, core, extras, layout, links, localapi, modules, money, notifications, onboarding, quick-capture, setup, tools`), shared `helpers.ts` (`ready`, `enable`, `mainNav`); `e2e/sync/` multi-device; `e2e/screenshots/capture.spec.ts` (manual tool, not CI; `SCREENS_*` env filters). Config: `playwright.config.ts`, `playwright.sync.config.ts`, `playwright.screens.config.ts`, env `.env.e2e`.

## Where things live
| Area | Location | Key names |
|---|---|---|
| **Module registry** | `web/src/core/modules/registry.ts` (`import.meta.glob('../../modules/*/manifest.ts')`) | `allManifests`, `visibleManifests`, `availableManifestsFor(kind)`, `validateManifest` |
| **Platform filter (`platforms`)** | `manifest.platforms?: PlatformKind[]` (missing = everywhere); runtime code uses `availableManifests()` in `core/modules/available.ts` (asks `getPlatform()`; separate file to avoid an import cycle through the DB). Router, nav, dashboard, library, services, settings all use it. E2E builds can pose as another platform via `localStorage.__tmPlatformKind` (`core/platform/web.ts`). | `availableManifests`, `isAvailableOn` |
| Manifest types | `web/src/core/modules/types.ts` | `ModuleManifest`, `ModuleContributions`, `CollectionDef`, `PageLayout`, `CalendarItem`, `ExternalCalendarSink` |
| Contributions (calendar, notifications) | `web/src/core/modules/contributions.ts` | `collectCalendarItems`, `collectNotifications`, `useCalendarItems` |
| Module services / activation / migrations | `core/modules/services.ts`, `activation.ts`, `migrate.ts`, `lazy.ts` | `startModuleServices`, `enableModule`, `disableModule` |
| **Tool registry** | `web/src/core/tools/{registry,types,state,layout}.ts` (glob `tools/*/manifest.ts`) | `ToolManifest`, `allTools`; UI `layout/ToolsSheet.tsx`, `/tools/:id` |
| Event bus | `web/src/core/events/{bus,events,index}.ts` | typed `EventMap` |
| **DB / data** | `web/src/core/db/` | `repo.ts` (`createRepo`, `createMany`, `purge`), `hlc.ts`, `schema*.json`, `appMigrations.ts` (+`Steps`), `db.ts` (modules: no import) |
| Settings | `web/src/core/settings/settings.ts` | `useSettings`, scopes in synced `_settings` |
| Time | `web/src/core/time/{now,dates,due}.ts` | `now()`, `today()` |
| **Sync client** | `web/src/core/sync/`: `engine.ts` (`runSync`), `ops.ts` (`mergeOps` – the LWW rule), `service.ts` (`syncNow`, `startSync`, `connect`), `types.ts` (`SyncAdapter`, `FieldOp`), `crypto.ts` (sync E2E), `adapters/selfHosted.ts`, `adapters/googleDrive.stub.ts` (unbuilt), `testing.ts` (`MemoryServer`) | |
| Storage adapter | `web/src/core/storage/{types,dexie}.ts` | `StorageAdapter`, outbox |
| **Sync server** | `server/src/`: `app.ts` (routes), `store.ts` (SQL upsert = LWW rule), `auth.ts` (bearer tokens), `push.ts` (Web Push), `proxy.ts` (SSRF-hardened fetch), `index.ts` (env/bootstrap) | env names in `server/.env.example`; compose service `sync`, port `${PORT:-8787}` |
| **Crypto service** | `web/src/core/crypto/`: `aead.ts` (AES-GCM), `kdf.ts` (Argon2id), `keychain.ts` (KEK/DEK), `passwordBlob.ts`, `random.ts` | used by vault (`modules/accounts`) |
| Secrets store | `web/src/core/secrets/{types,deviceKey,migrating}.ts` | `SecretStore`; keystore primary, WebCrypto device key legacy |
| Backup | `web/src/core/backup/backup.ts` | JSON `taschenmesser-backup`, merge/replace |
| **AI providers** | `web/src/core/ai/providers/{types,claude,openai,ollama,presets}.ts` | `AiProvider` |
| **AI router / config** | `web/src/core/ai/router.ts` (`createRouter`), `config.ts` (`ProviderEntry`, `createRouterProvider`), `usage.ts`, `testConnection.ts`; UI `pages/settings/AiSection.tsx` | |
| Assistant pipeline | `web/src/core/ai/assistant.ts` (`ask`), `intent/parser.ts` (tier 1), `search/fulltext.ts`, `cache.ts` (tier 2), `prompt.ts`, `scope.ts` (`aiModules` filter), `query/{schema,executor,validate,create}.ts` | |
| **Connectors** | framework `web/src/core/connectors/{types,registry,context,oauth,redact,service,state}.ts` (glob `connectors/*/index.ts`); impls `web/src/connectors/google/*`, `web/src/connectors/ics/*`; UI `pages/settings/ConnectorsSection.tsx`; isolation `connectors/isolation.test.ts` | `ConnectorDef` |
| **Home screen (not a module)** | `web/src/home/` (`Home.tsx`, `layout.ts` scope `home`, `AutoWidget.tsx`); widget contract `ModuleManifest.widgets` (`WidgetDef`) checked by `validateManifest`, `scripts/check-modules.mjs`, `core/modules/widgets.test.tsx`; route `/` in `router.tsx`. Details: [architecture/setup-home.md](architecture/setup-home.md) | |
| **Undo / keyboard** | `core/undo`, `core/db/recorder.ts`, `core/keyboard`, `layout/useShortcuts.ts`; dev page `/dev/components` | `UndoEntry` |
| **Navigation areas** | `manifest.area`, `core/modules/areas.ts`, `core/settings/nav.ts`, [decisions/ui-shell.md](decisions/ui-shell.md) | `NavTree` |
| **Layout system** | `web/src/layout/PageContainer.tsx` + `.module.css`; `PageLayout`/`PAGE_LAYOUTS` in `core/modules/types.ts`; applied once in `router.tsx` via `manifest.layout` / `route.layout` | `narrow`/`content`/`wide`/`full` |
| **Onboarding / import framework** | `web/src/core/importer/` (`types.ts`, `plan.ts`, `batches.ts`, `host.tsx`, `OnboardingWizard.tsx`, `ImportPreview.tsx`, `StartDataButton.tsx`); parsers `web/src/core/io/*`; per-module `modules/<id>/onboarding.ts` + `importer.ts`; e2e `e2e/onboarding.spec.ts` | `ImporterMeta`, `ImportBatch`, table `_imports` |
| **Data API (JSON import)** | `web/src/core/dataapi/` (`format.ts`, `parse.ts`, `importer.ts`, `scope.ts`, `openapi.ts`, `pending.ts`, `text.ts`) | |
| **Local import API** | app side `web/src/core/localapi/{config,handler,service,log,prompt}.ts`; Rust transport `web/src-tauri/crates/local-api/src/{auth,http,limiter,server,lib}.rs` (+ `tests/server.rs`); Tauri wiring `web/src-tauri/src/local_api.rs`; JS bridge `core/platform/tauri/localApi.ts`; e2e fake `core/platform/fakeLocalApi.ts`; UI `pages/settings/LocalApiSection.tsx`, `layout/PendingImports.tsx`; guide `docs/AI-IMPORT.md` | |
| **MCP wrapper** | `mcp/src/{index,server,api,config}.ts`, tests `mcp/test/` | 8 tools, 1 API call each |
| **Seed framework (test data)** | `web/src/core/seed/` (`types.ts` contract, `dev.ts` runner behind `load.ts`, `guard.ts` + table `_seeds` read by sync/backup), `modules/<id>/seed.ts`, UI `pages/settings/DeveloperSection.tsx`, e2e `e2e/seed/`. Recipe: [howto/seed-data.md](howto/seed-data.md) | |
| **Setup assistant** | logic `web/src/core/setup/`, UI `web/src/layout/setup/`, module step `modules/accounts/setup.ts`, e2e `e2e/setup.spec.ts`. Details: [architecture/setup-home.md](architecture/setup-home.md) | |
| Platform layer | `web/src/core/platform/{index,types,web}.ts`, `tauri/{index,localApi,disk,system,secureStore,updater}.ts` | `getPlatform()`, `PlatformService` |
| **Disk module (desktop)** | UI `web/src/modules/disk/`, seam `core/platform/disk.ts`, Rust `web/src-tauri/crates/disk-scan/`, wrapper `src-tauri/src/disk.rs`; no collections, no `aiSchema`. Details: [architecture/desktop.md](architecture/desktop.md) | |
| **System tab (desktop)** | `web/src/modules/disk/components/SystemTab.tsx`, `core/platform/system.ts`, Rust `crates/system-info` + `src/system.rs`. Details: [architecture/desktop.md](architecture/desktop.md) | |
| **Tauri command permissions** | `web/src-tauri/build.rs` `COMMANDS` + `capabilities/{default,desktop,capture}.json`; guard test `web/src-tauri/tests/commands.rs`. New desktop command = handler in `lib.rs` + `build.rs` + `desktop.json`. Details: [architecture/desktop.md](architecture/desktop.md) | |
| **Tauri shell** | `web/src-tauri/`: `src/{lib,main,local_api,oauth,portable,update,webview2}.rs`, `tauri.conf.json`, `tauri.windows.conf.json`, `capabilities/default.json`, `Cargo.toml` | identifier `io.github.sgnemo.taschenmesser` |
| Tauri plugins (local) | `web/src-tauri/plugins/apk-installer/` (Android APK update), `plugins/secure-store/` (OS keystore, biometrics, screen protection; Kotlin in `android/`) | |
| Self-update (TS) | `web/src/core/update/{controller,github,notes,prefs,semver,backup,types}.ts`; UI `layout/UpdateBanner.tsx`, `pages/settings/UpdateSection.tsx` | |
| **Update channels & manifests** | stable/beta/dev channels, `core/update/buildInfo.ts` `effectiveChannel`, `update.rs`, `web/scripts/dev-preview.mjs`. Details: [architecture/native.md](architecture/native.md) | |
| Notifications | `web/src/core/notifications/{scheduler,service,push,pushPayload,nativeSchedule,triggers}.ts` | |
| Browser extension, vault bridge | see [architecture/browser-extension.md](architecture/browser-extension.md) | |
| Vault (passwords) | `web/src/modules/accounts/` (never AI-visible) | |

## Data flow
1. **Write:** UI → module `repo.ts` (`createRepo`) → Zod validation → HLC-stamped fields → Dexie table + `_outbox` (unless `local: true`).
2. **Read:** `useLiveQuery` on `repo.active()` → components. Cross-module info only via event bus / manifest contributions.
3. **Sync:** `startSync` triggers → `runSync` (pull, then push) → `SyncAdapter` (`selfHosted`) → `server/src/app.ts` → `store.ts`. Optional per-value AES-GCM encryption in `core/sync/crypto.ts`. Remote ops merged by `mergeOps`, applied via `StorageAdapter.applyRemote`.
4. **Assistant:** palette → tier 1 local parser (0 tokens) → full text → intent cache → model via router (`createRouterProvider`) → validated `Intent` → executor on local Dexie. Model only sees schema text, date, question.
5. **Import:** wizard/JSON paste/local API → `buildPreview` (dedupe, validation) → user confirms → `commitImport` → `repo.createMany` → batch row in `_imports` (undo).
6. **Native calls:** anything OS-specific goes through `getPlatform()`; only `core/platform/tauri/**` imports `@tauri-apps/*`.

## Interfaces and tests
Key interfaces (`ModuleManifest`, `PlatformService`, `SyncAdapter`, server REST …) and the test/CI map: [architecture/interfaces-tests.md](architecture/interfaces-tests.md).
