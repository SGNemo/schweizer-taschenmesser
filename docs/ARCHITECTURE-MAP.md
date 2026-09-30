# Architecture map – Taschenmesser

Fast "where is what" index. Paths are repo-relative and were checked against the tree. Rationale and long design notes: [`architecture.md`](architecture.md) (section names in brackets below). Decisions: [`DECISIONS.md`](DECISIONS.md).

> Filename note: this map is `ARCHITECTURE-MAP.md`, not `ARCHITECTURE.md`, because `architecture.md` already exists and is referenced from code (`web/src-tauri/crates/local-api/src/lib.rs`); the two names would collide on Windows/macOS checkouts.

## Top level
| Path | What |
|---|---|
| `web/` | PWA (Vite, React 19, TS strict); own `package.json`; all UI/logic |
| `web/src-tauri/` | Tauri 2 shell (Rust): portable Windows exe, Android APK |
| `server/` | Sync server (Fastify 5 + better-sqlite3), Dockerfile, compose |
| `mcp/` | MCP stdio wrapper around the local import API (own project) |
| `contract/` | `lww-cases.json` – merge-rule fixtures used by web and server tests |
| `docs/` | `architecture.md` (details), `AI-IMPORT.md` (German user guide of the local API), this map, `DECISIONS.md`, `HOW-TO.md`, `STATUS.md` |
| `.github/workflows/` | `ci.yml`, `release.yml` |

## `web/` layout
- `src/core/` – framework code (no UI pages): db, sync, ai, crypto, modules, platform, …
- `src/modules/<id>/` – feature modules (manifest-driven). Present: accounts, birthdays, bookmarks, budgets, calendar, contracts, example (dev only), finance, habits, invoices, launcher, news, notes, packing, reminders, shopping, subscriptions, todos, vault.
- `src/tools/<id>/` – small stateless helpers (base64, calc, currency, dates, dice, hash, json, percent, qr, scratch, split, timer, units, uuid).
- `src/connectors/<id>/` – outside services: `google/`, `ics/`.
- `src/layout/` – app shell: `AppShell.tsx`, `PageContainer.tsx`, `CommandPalette.tsx`, `QuickAdd.tsx`, `ToolsSheet.tsx`, `MoreSheet.tsx`, `PendingImports.tsx`, `UpdateBanner.tsx`, `SyncBadge.tsx`, `useNavItems.ts`, `assistant/` (palette answer UI).
- `src/pages/` – `Settings.tsx` + `settings/*Section.tsx`, `ModuleLibrary.tsx`, `ToolLibrary.tsx`, `ShareTarget.tsx`, `dashboard/`, `NotFound.tsx`.
- `src/ui/` – design system (Button, Dialog, Fields, Patterns, HelpHint, tokens.css, icons.tsx).
- `src/router.tsx`, `src/App.tsx`, `src/main.tsx` (startup order), `src/sw.ts` (service worker), `src/stores/ui.ts` (zustand UI state), `src/strings.ts` (**all German UI text**).
- `templates/module/` – scaffold used by `scripts/gen-module.mjs`.
- `scripts/` – `db-bump`, `gen-module`, `gen-icons`, `version`, `changelog`, `keys`, `android-sign`, `audit-release`, `latest-json`, `check-links` (+ tested `scripts/lib/*.ts`).
- `e2e/` – Playwright specs (`a11y, accounts, assistant, backup, connectors, core, extras, layout, links, localapi, modules, money, news, notifications, onboarding, tools`); `e2e/sync/` multi-device; `e2e/screenshots/capture.spec.ts` (manual tool, not CI). Config: `playwright.config.ts`, `playwright.sync.config.ts`, `playwright.screens.config.ts`, env `.env.e2e`.

## Where things live
| Area | Location | Key names |
|---|---|---|
| **Module registry** | `web/src/core/modules/registry.ts` (`import.meta.glob('../../modules/*/manifest.ts')`) | `allManifests`, `visibleManifests`, `validateManifest` |
| Manifest types | `web/src/core/modules/types.ts` | `ModuleManifest`, `ModuleContributions`, `CollectionDef`, `PageLayout`, `CalendarItem`, `ExternalCalendarSink` |
| Contributions (calendar, notifications) | `web/src/core/modules/contributions.ts` | `collectCalendarItems`, `collectNotifications`, `useCalendarItems` |
| Module services / activation / migrations | `core/modules/services.ts`, `activation.ts`, `migrate.ts`, `lazy.ts` | `startModuleServices`, `enableModule`, `disableModule` |
| **Tool registry** | `web/src/core/tools/{registry,types,state,layout}.ts` (glob `tools/*/manifest.ts`) | `ToolManifest`, `allTools`; UI `layout/ToolsSheet.tsx`, `pages/ToolLibrary.tsx` |
| Event bus | `web/src/core/events/{bus,events,index}.ts` | typed `EventMap` |
| **DB / data** | `web/src/core/db/` | `repo.ts` (`createRepo`, `createMany`, `purge`), `hlc.ts`, `schema.ts`, `schema.snapshot.json`, `schema-history.json`, `db.ts` (modules must not import) |
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
| Assistant pipeline | `web/src/core/ai/assistant.ts` (`ask`), `intent/parser.ts` (tier 1), `search/fulltext.ts`, `cache.ts` (tier 2), `prompt.ts`, `scope.ts` (`aiModules` filter), `query/{schema,executor,validate,create}.ts`, `newsBrief.ts` | |
| **Connectors** | framework `web/src/core/connectors/{types,registry,context,oauth,redact,service,state}.ts` (glob `connectors/*/index.ts`); impls `web/src/connectors/google/*`, `web/src/connectors/ics/*`; UI `pages/settings/ConnectorsSection.tsx`; isolation `connectors/isolation.test.ts` | `ConnectorDef` |
| **Layout system** | `web/src/layout/PageContainer.tsx` + `.module.css`; `PageLayout`/`PAGE_LAYOUTS` in `core/modules/types.ts`; applied once in `router.tsx` via `manifest.layout` / `route.layout` | `narrow`/`content`/`wide`/`full` |
| **Onboarding / import framework** | `web/src/core/importer/` (`types.ts`, `plan.ts`, `batches.ts`, `host.tsx`, `OnboardingWizard.tsx`, `ImportPreview.tsx`, `StartDataButton.tsx`); parsers `web/src/core/io/*`; per-module `modules/<id>/onboarding.ts` + `importer.ts`; e2e `e2e/onboarding.spec.ts` | `ImporterMeta`, `ImportBatch`, table `_imports` |
| **Data API (JSON import)** | `web/src/core/dataapi/` (`format.ts`, `parse.ts`, `importer.ts`, `scope.ts`, `openapi.ts`, `pending.ts`, `text.ts`) | |
| **Local import API** | app side `web/src/core/localapi/{config,handler,service,log,prompt}.ts`; Rust transport `web/src-tauri/crates/local-api/src/{auth,http,limiter,server,lib}.rs` (+ `tests/server.rs`); Tauri wiring `web/src-tauri/src/local_api.rs`; JS bridge `core/platform/tauri/localApi.ts`; e2e fake `core/platform/fakeLocalApi.ts`; UI `pages/settings/LocalApiSection.tsx`, `layout/PendingImports.tsx`; guide `docs/AI-IMPORT.md` | |
| **MCP wrapper** | `mcp/src/{index,server,api,config}.ts`, tests `mcp/test/` | 8 tools, 1 API call each |
| **Setup assistant** ("Einrichtungsassistent") | logic `web/src/core/setup/`: `types.ts` (`SetupStepDef`, `SetupStepProps`, `SETUP_VERSION`), `state.ts` (local progress in `_meta` `setup.state`), `detect.ts` (`appHasData`, `ensureSetupState` = start migration), `registry.ts` (`allSetupSteps`, `applicableSteps`, `detectDone`), `profiles.ts` (presets, `requires`), `checklist.ts`, `hooks.ts` (`useBackClose`), `host.ts`, `steps/index.ts` (`CORE_STEPS`); UI `web/src/layout/setup/` (`SetupWizard`, `SetupHost`, `WelcomeCard`, `ChecklistCard`, `SetupLink`, `steps/*Step.tsx`); module step `modules/accounts/setup.ts`; settings `pages/settings/SetupSection.tsx`; app-wide prefs `core/settings/core.ts` (scope `core`); e2e `e2e/setup.spec.ts` | `SetupStepDef`, `useSetupHost` |
| Platform layer | `web/src/core/platform/{index,types,web}.ts`, `tauri/{index,localApi,secureStore,updater}.ts` | `getPlatform()`, `PlatformService` |
| **Tauri shell** | `web/src-tauri/`: `src/{lib,main,local_api,oauth,portable,update,webview2}.rs`, `tauri.conf.json`, `tauri.windows.conf.json`, `capabilities/default.json`, `Cargo.toml` | identifier `io.github.sgnemo.taschenmesser` |
| Tauri plugins (local) | `web/src-tauri/plugins/apk-installer/` (Android APK update), `plugins/secure-store/` (OS keystore, biometrics, screen protection; Kotlin in `android/`) | |
| Self-update (TS) | `web/src/core/update/{controller,github,notes,prefs,semver,backup,types}.ts`; UI `layout/UpdateBanner.tsx`, `pages/settings/UpdateSection.tsx` | |
| Notifications | `web/src/core/notifications/{scheduler,service,push,pushPayload,nativeSchedule,triggers}.ts` | |
| Vault (passwords) | `web/src/modules/accounts/` (never AI-visible) | |

## Data flow
1. **Write:** UI → module `repo.ts` (`createRepo`) → Zod validation → HLC-stamped fields → Dexie table + `_outbox` (unless `local: true`).
2. **Read:** `useLiveQuery` on `repo.active()` → components. Cross-module info only via event bus / manifest contributions.
3. **Sync:** `startSync` triggers → `runSync` (pull, then push) → `SyncAdapter` (`selfHosted`) → `server/src/app.ts` → `store.ts`. Optional per-value AES-GCM encryption in `core/sync/crypto.ts`. Remote ops merged by `mergeOps`, applied via `StorageAdapter.applyRemote`.
4. **Assistant:** palette → tier 1 local parser (0 tokens) → full text → intent cache → model via router (`createRouterProvider`) → validated `Intent` → executor on local Dexie. Model only sees schema text, date, question.
5. **Import:** wizard/JSON paste/local API → `buildPreview` (dedupe, validation) → user confirms → `commitImport` → `repo.createMany` → batch row in `_imports` (undo).
6. **Native calls:** anything OS-specific goes through `getPlatform()`; only `core/platform/tauri/**` imports `@tauri-apps/*`.

## Important interfaces
- `ModuleManifest` (`core/modules/types.ts`): id, routes, `setupSteps?`, `requires?`, `collections`, `widgets`, `aiSchema?`, `contributions` (`quickAdd`, `calendarItems`, `notifications`, `services`, `onboarding` (required), `aiComputed`, `aiCreateDefaults`, `externalCalendar`), `layout`, `migrations`, `defaultEnabled`, `order`, `devOnly`. `ToolManifest` / `ConnectorDef` also take `setupSteps?`.
- `ToolManifest` (`core/tools/types.ts`).
- `ConnectorDef` / `ConnectorContext` (`core/connectors/types.ts`).
- `AiProvider { id, model, complete(req) }` (`core/ai/providers/types.ts`).
- `SyncAdapter` (`core/sync/types.ts`), `StorageAdapter` (`core/storage/types.ts`), `FieldOp`.
- `PlatformService` (`core/platform/types.ts`): `fetch`, `notifications`, `saveFile`, `clipboard`, `secrets`, `biometrics`, `screen`, `oauth`, `updater`, `localApi`, `lifecycle`, `app`.
- `ImporterMeta` / `ImporterRuntime` / `ImportBatch` (`core/importer/types.ts`).
- Server REST (`server/src/app.ts`): `GET /v1/health`, `GET|PUT /v1/vault`, `POST /v1/push`, `GET /v1/pull`, `POST /v1/reset`, push routes `/v1/push/*`, `GET /v1/proxy?url=`. Local API routes: see `architecture.md` → "Local AI import API".

## Tests
- Unit/component: co-located `*.test.ts(x)` (some in `__tests__/`); `web/vitest.config.ts`, `web/vitest.setup.ts`.
- Isolation/privacy guards: `core/modules/registry.test.ts`, `tools/isolation.test.ts`, `connectors/isolation.test.ts`, `core/ai/privacy.test.ts`, `modules/accounts/__tests__/exclusion.test.ts`, `core/sync/contract.test.ts`, `server/test/contract.test.ts`.
- Server: `server/test/*.test.ts` (Vitest + `fastify.inject`). MCP: `mcp/test/mcp.test.ts`. Rust: `web/src-tauri/crates/local-api/tests/server.rs`.
- CI jobs (`.github/workflows/ci.yml`, on push to `develop`/`main` and PRs): secret scan (gitleaks), web (lint, types, unit, E2E), server, mcp, multi-device sync E2E, rust (fmt, clippy, tests).
- Release (`.github/workflows/release.yml`): tag `v*.*.*`, plus dry runs on `develop` pushes touching `web/src-tauri/**`, `web/scripts/**`, the workflow, and manual dispatch; jobs `secret-scan`, `prepare`, `windows`, `android`, `release`, `summary`.

## Setup assistant (data flow)
1. **Start:** `initCore` → `ensureSetupState()` (first thing). Missing row: app has data → `dismissed` + `checklistHidden`; empty app → `notStarted`. Never runs the wizard by itself.
2. **Open:** `useSetupHost.openWizard(stepId?)` from Settings, palette command "Einrichtung", dashboard cards, empty dashboard, module library. `SetupHost` (in `AppShell`) mounts `SetupWizard`.
3. **Steps:** `allSetupSteps` = `CORE_STEPS` + `setupSteps` of manifests (sorted by `order`; core: basics 10, sync 20, profiles 30, tools 40, vault 50 (module), ai 60, connectors 70, startdata 80, aiimport 90, notifications 100, backupupdates 110, dashboard 120). `when` filters, `isDone` auto-detects.
4. **Save:** a step keeps a local draft, registers `registerCommit(fn)`; "Weiter" runs it, then `markStepDone` (or `markStepSkipped` if `fn` returns `'skipped'`). Cancel drops the draft. Actions that are explicit in the reused settings UI (sync connect, backup restore, OAuth login, import wizard) write on their own button.
5. **Leave:** X / Esc / back gesture (`useBackClose`) → confirm view: later (`inProgress`), end (`dismissed`), keep going.
6. **Checklist:** `useChecklist` → `ChecklistCard` on the dashboard while status is `inProgress|dismissed` (or steps newer than `state.version`), not hidden, and something is open.
