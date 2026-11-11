# Architecture map – core: modules, data, sync

Part of the [architecture map](../ARCHITECTURE-MAP.md) ("Where things live").

| Area | Location | Key names |
|---|---|---|
| **Module registry** | `web/src/core/modules/registry.ts` (`import.meta.glob('../../modules/*/manifest.ts')`) | `allManifests`, `visibleManifests`, `availableManifestsFor(kind)`, `validateManifest` |
| **Maturity filter (`maturity`)** | `core/modules/available.ts` `isVisible`/`catalogManifests`/`useCatalogManifests`, `core/tools/state.ts` `isVisible`/`visibleTools`, `core/settings/registry/registry.ts` `isMaturityVisible`, `home/maturity.ts`; switch `stores/ui.ts` `showPreview` (`tm-show-preview`) | catalogues only (library, toolbox, palette, home sheet, settings); `check:modules` requires the field |
| **Platform filter (`platforms`)** | `manifest.platforms?: PlatformKind[]` (missing = everywhere); runtime code uses `availableManifests()` in `core/modules/available.ts` (asks `getPlatform()`; separate file to avoid an import cycle through the DB). Router, nav, dashboard, library, services, settings all use it. E2E builds can pose as another platform via `localStorage.__tmPlatformKind` (`core/platform/web.ts`). | `availableManifests`, `isAvailableOn` |
| Manifest types | `web/src/core/modules/types.ts` | `ModuleManifest`, `ModuleContributions`, `CollectionDef`, `PageLayout`, `CalendarItem`, `ExternalCalendarSink` |
| Contributions (calendar, notifications) | `web/src/core/modules/contributions.ts` (hooks share one live query per input through `sharedQuery.ts` `useSharedLiveQuery`) | `collectCalendarItems`, `collectNotifications`, `useCalendarItems` |
| Module services / activation / migrations | `core/modules/services.ts`, `activation.ts`, `defaults.ts` (default set of a fresh installation, device-local), `migrate.ts`, `lazy.ts` | `startModuleServices`, `enableModule`, `disableModule`, `offerEnableModule` (toast with "Aktivieren") |
| **Tool registry** | `web/src/core/tools/{registry,types,state,layout,keywords}.ts` (glob `tools/*/manifest.ts`) | `ToolManifest` (+ `identity`, `category`, `keywords`), `allTools`; UI `layout/tools/{ToolsPanel,ToolStage,ToolSolo,panelLogic}`, `/tools/:id` opens the panel, `/tool/:id` = detached window; `check:tools` |
| Event bus | `web/src/core/events/{bus,events,index}.ts` | typed `EventMap` |
| **DB / data** | `web/src/core/db/` | `repo.ts` (`createRepo`, `createMany`, `purge`), `hlc.ts`, `schema*.json`, `appMigrations.ts` (+`Steps`), `db.ts` (modules: no import) |
| Settings | `core/settings/settings.ts` (`useSettings`), `core/settings/registry/`, `pages/settings/sections.tsx`; comfort: `core/settings/{quick,frequent,reset}.ts`, `core/deeplink.ts`; [howto/new-setting.md](../howto/new-setting.md) | `SettingsSectionDef` |
| Time | `web/src/core/time/{now,dates,due}.ts`; zones: `zones.ts`, `placeSearch.ts` + `cities.ts` (offline), `useMinuteNow.ts` | `now()`, `today()`; `showIn()`, `searchPlaces()`, one tick per minute |
| **Sync client** | `web/src/core/sync/`: `engine.ts` (`runSync`), `ops.ts` (`mergeOps` – the LWW rule), `service.ts` (`syncNow`, `startSync`, `connect`), `types.ts` (`SyncAdapter`, `FieldOp`), `crypto.ts` (sync E2E), `adapters/selfHosted.ts`, `adapters/googleDrive.stub.ts` (unbuilt), `testing.ts` (`MemoryServer`) | |
| Storage adapter | `web/src/core/storage/{types,dexie}.ts` | `StorageAdapter`, outbox |
| **Sync server** | `server/src/`: `app.ts` (routes), `store.ts` (SQL upsert = LWW rule), `auth.ts` (bearer tokens), `push.ts` (Web Push), `proxy.ts` (SSRF-hardened fetch), `index.ts` (env/bootstrap) | env names in `server/.env.example`; compose service `sync`, port `${PORT:-8787}` |
| **Crypto service** | `web/src/core/crypto/`: `aead.ts` (AES-GCM), `kdf.ts` (Argon2id), `keychain.ts` (KEK/DEK), `passwordBlob.ts`, `random.ts` | used by vault (`modules/accounts`) |
| Secrets store | `web/src/core/secrets/{types,deviceKey,migrating}.ts` | `SecretStore`; keystore primary, WebCrypto device key legacy |
| Backup | `web/src/core/backup/backup.ts` | JSON `taschenmesser-backup`, merge/replace; per-release fixtures `web/tests/fixtures/backups/` |
| Share file | `web/src/core/share/share.ts` | `taschenmesser-share` v1, encrypted modules, merge only, six-word code ([features/partner-share.md](../features/partner-share.md)) |
| **Diagnostics / bug report** | `web/src/core/diagnostics/{errorLog,logError,export,report,config}.ts` (ring buffers, scrub, text report, issue/mailto links; `logError(tag)` = `.catch` handler that records instead of swallowing); UI `pages/settings/AboutSections.tsx`, `layout/ModuleErrorBoundary.tsx` | `buildDiagnostics`, `renderDiagnostics`, `reportBug` |
| **Recovery / safe mode** | `core/db/{health,recovery}.ts`, `core/safemode/safeMode.ts`, UI `layout/{RecoveryScreen,FatalErrorScreen,SafeModeBanner}.tsx`, boot in `main.tsx`; desktop flag `capture::desktop_safe_mode` | `checkDb`, `dumpDb`, `isSafeMode` |
| **Language (DE/EN for new texts)** | `web/src/core/i18n/{lang,bundle}.ts`, bundles `strings.i18n.ts`, `strings.diagnostics.ts` | `defineBundle`, `useLang` |
