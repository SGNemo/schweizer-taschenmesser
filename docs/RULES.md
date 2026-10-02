# Hard rules – full text

Short list in root [CLAUDE.md](../CLAUDE.md); this file is the unabridged version (moved unchanged from CLAUDE.md, 2026-10-01). Rationale: [DECISIONS](DECISIONS.md); design notes: [architecture.md](architecture.md).

## Rules that must hold
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

## Home screen & widgets (every new module)
- The home screen ("Übersicht", `web/src/home/`) is **not a module**: route `/`, not deactivatable, config in the synced `_settings` scope `home` (`home/layout.ts`; the old `dashboard` scope is migrated on first edit). Logo click, Alt+Home and the palette lead there.
- **Every module must ship a widget:** `manifest.widgets` needs ≥ 1 entry `{ id, title, sizes, defaultSize, component: () => import('./widgets/X') }`. `validateManifest`, `npm run check:modules` (runs in CI first) and `core/modules/widgets.test.tsx` fail otherwise; a module that declares none still gets a generated fallback (`home/AutoWidget.tsx`) but must not rely on it.
- Widget rules: lazy default export, live data (`useLiveQuery`), `WidgetList` with `empty` + `emptyAction` (a next step, not just "Keine …"), `Skeleton` while loading, no full views, tokens only. `npm run gen:module` / `new:module` creates widget, `useSummary` hook and widget test.
- Hiding a widget affects only the home screen, never the module. Vault (`accounts`) and desktop modules show status only (no entries, no file names): see their `exclusion.test.ts`.
- Home layout = one record `{ order, hidden, sizes }` keyed `<moduleId>:<widgetId>` for all devices (responsive grid via `PageContainer`); disabled modules keep their saved position.

## Dev-Preview
A signed preview (portable exe `Nemo-Portable-dev.exe` + `Nemo-dev.apk`, own app `…taschenmesser.dev`, own data) is built automatically after every green push to `develop` (`dev-preview.yml`, called from `ci.yml`) and published as the rolling **pre-release** `dev-preview`; releases still happen only through the release procedure. Dev builds follow the dev channel (`core/update/buildInfo.ts`); stable builds can never select it. Details: `docs/HOW-TO.md` → "Dev-Preview".

## Browser extension & vault bridge
- The extension has no vault and persists nothing (no `chrome.storage`, no web storage; ESLint + E2E). The desktop app is the only source; every write goes through `saveEntry`.
- Fill, copy and save only after a user click; never on page load or focus. An entry is offered, revealed or changed only for a page origin that matches its stored URL (`packages/vault-core/src/origin.ts`); the origin comes from the browser, never from a message.
- Bridge messages are strict Zod schemas (`packages/vault-core/src/protocol.ts`), replies and errors carry codes only; nothing about messages is logged. No "list everything" operation; no bind address, port or CORS for the bridge. Only the allowlisted extension id (`EXTENSION_ID`) is served, after pairing; locking ends every session.
- The extension never runs on Nemo's own pages (`data-nemo-ignore` on `<body>`). Details: [security/VAULT-EXTENSION.md](security/VAULT-EXTENSION.md).
