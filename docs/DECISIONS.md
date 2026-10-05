# Decisions – Nemo

One line per decision: **what** – why. Full text with sources, alternatives and details: `docs/decisions/<area>.md` (linked per section; nothing was dropped). Long design notes: [architecture.md](architecture.md). Add new decisions here as one line and put the detail in the area file. Since = first release (≤0.2 = phases 1–13 before 0.3.0) or date.

## Core: data, sync, AI → [decisions/core.md](decisions/core.md)
- ≤0.2 **Local-first, IndexedDB is the source of truth; sync is a separate optional layer** – data stays on the device, the server only relays field ops.
- ≤0.2 **One Dexie table per collection, record envelope (`id, createdAt, updatedAt, deviceId, deletedAt, _f`), writes only via `createRepo`** – validation, HLC, tombstones, outbox in one place.
- ≤0.2 **Money = integer cents; dates `YYYY-MM-DD`, times `HH:mm` local; `now()`/`today()` instead of `Date.now()`** – events stay put across time zones; injectable clock for tests.
- ≤0.2 **German-only UI in `strings.ts`; code, comments, commits English.**
- ≤0.2 **Modules are manifest-driven and isolated (event bus + contributions; read-only `public.ts` exceptions)** – on/off switchable, independent; ESLint + `registry.test.ts`.
- ≤0.2 **Subscriptions are forecasts, never auto-booked transactions.**
- ≤0.2 **Local-only collections (`CollectionDef.local`, `_blobs`)**: news, feed state, vault files never reach outbox/sync/backup.
- ≤0.2 **Field-level LWW by greatest HLC, implemented twice on purpose** (`core/sync/ops.ts`, `server/src/store.ts`), pinned by `contract/lww-cases.json`; server never merges values. Change both or neither.
- ≤0.2 **`SyncAdapter` abstraction** (`selfHosted` built, Google Drive stub only).
- ≤0.2 **Optional E2E encryption per op value (PBKDF2 → AES-GCM, AAD `collection/id/field`)** – ids/fields/HLC stay readable for the server.
- ≤0.2 **Server single-tenant, no tombstone GC** – accepted limits.
- ≤0.2 **Never send user data to a model** (instructions, compact `aiSchema`, date, question only; `privacy.test.ts` per adapter); results computed locally.
- ≤0.2 **Three tiers, cheapest first:** local German parser → full text → intent cache → model; cache key excludes provider/model.
- ≤0.2 **Model output is never evaluated:** Zod-validated `Intent` against a field whitelist; creating entries needs a confirmation card.
- ≤0.2 **Multi-provider router with fallback, cooldowns, local limits;** presets are editable defaults (unverified); keys in `PlatformService.secrets`.
- ≤0.2 **`accounts` (vault) invisible to AI, search, dataapi, local API** (no `aiSchema`, `dataApi: false`, id block; `exclusion.test.ts`).
- ≤0.2 **Connectors never import `core/ai`; news has no `aiSchema`** – feed/mail text reaches a model only via the explicit news-brief button (headlines).

## Native, distribution, releases, security → [decisions/distribution.md](decisions/distribution.md)
- ≤0.2 **Tauri 2 shell around the unchanged web app, thin; PWA stays the fallback** (native builds drop the service worker).
- ≤0.2 **`PlatformService` is the only browser/native seam** (`@tauri-apps/*` only in `core/platform/tauri/**`, ESLint).
- 0.2 **Portable Windows exe instead of installers, own signed self-update** (`portable.rs` re-verifies minisign, swaps exe with rollback) – `tauri-plugin-updater` only launches installers. `latest.json` has only `windows-x86_64-portable`.
- ≤0.2 **Android APK signed by `scripts/android-sign.mjs`, not Gradle; `gen/` generated in CI; `versionCode` from SemVer incl. pre-release rank.**
- ≤0.2 **Bundle id `io.github.sgnemo.taschenmesser` never changes; Android keystore and updater key must never be lost.**
- ≤0.2 **Closed-app reminders on Android via OS scheduling** (no Web Push in the WebView).
- ≤0.2 **Secrets in OS keystore; Windows Hello is a consent gate, not cryptographic binding** – master password remains the real protection.
- ≤0.2 **Conventional Commits drive generated release notes; integration branch `develop`, `main` only for releases.**
- ≤0.2 **Tag `vX.Y.Z[-beta.N]` triggers a signed release (tag = `web/package.json`); alt. `workflow_dispatch` on `main` with `version`; never both.** `develop` pushes touching native/scripts and dispatch without `version` are dry runs.
- ≤0.2 **Public-repo safety by construction:** gitleaks over history, `audit-release.mjs` on artifacts, keystore `umask 077` + cleanup. Do not weaken.
- ≤0.2 **No Authenticode certificate** (SmartScreen warning documented); updater payload verified with the updater key.
- 2026-10-01 **Dev-Preview: rolling pre-release `dev-preview` after every green `develop` push** (job in `ci.yml` calling reusable `dev-preview.yml`: `workflow_run`/dispatch only fire from the default branch); same signing/audit; tag not SemVer so stable updater/`releases/latest` ignore it.
- 2026-10-01 **Dev-Preview is a separate app (the one sanctioned identifier exception):** id `….taschenmesser.dev`, name "Nemo Dev", dev flavor only – parallel install, own data, independent `versionCode`.
- 2026-10-02 **Test data: deterministic seeds per module, Dev-Preview only, never synced.** `seed` in every manifest + `seed.ts` (fixed random seed 42, reference date, small/medium/large); the runner and its UI are removed from stable builds at build time; seed rows are registered in `_seeds` and skipped by sync and backup unless the dev switch "Seed-Sync erlauben" is on; the demo vault (`nemo-demo-tresor`) is only created when none exists. Detail: [decisions/core.md](decisions/core.md).
- 2026-10-01 **Dev channel exists only in dev builds** (`VITE_RELEASE_CHANNEL=dev`); Rust accepts `dev-latest.json` only at the fixed `dev-preview` URL. Version `<next stable>-dev.<commit count>`, build-time only; `dev-latest.json` uploaded last.

## Imports, local API, connectors → [decisions/features.md](decisions/features.md)
- ≤0.2 **Preview-before-write for every import,** duplicates pre-deselected, one undoable batch (`_imports`).
- ≤0.2 **One import format per collection derived from its Zod schema; `scope.ts` is the single filter.**
- ≤0.2 **Local AI import API: desktop only, off by default, loopback only, transport in Rust, meaning in TS;** hashed tokens with per-module rights, nothing logged, pending batches need user confirmation, no delete endpoint, no CORS/bind setting.
- ≤0.2 **MCP wrapper is a thin separate project without data access,** not in release downloads; token only to loopback.
- ≤0.2 **Own Google OAuth client (user brings it), PKCE + loopback;** Gmail scan reads metadata + snippet only, user confirms each suggestion.
- ≤0.2 **`/v1/proxy` is deliberately narrow (SSRF hardening)** for ICS/RSS in the PWA; native fetches directly. Spotify connector not built.

## Disk module, platform-only modules, setup assistant → [decisions/features.md](decisions/features.md)
- 0.3 **`manifest.platforms` + lazy `availableManifests()`** – module state syncs, so desktop-only modules must vanish everywhere else; cycle through the DB avoided via `core/modules/available.ts`.
- 0.3 **Disk scan: own `read_dir` + rayon walk; size = space on volume; tree stays in Rust, webview gets views by node id** – small IPC, a compromised webview cannot name paths.
- 0.3 **Delete: node ids → plan → block list twice (plan and run, resolved paths) → typed confirmation in Rust;** recycle bin via `IFileOperation` abort sink (never silent permanent delete).
- 0.3 **Per-command Tauri permissions, desktop only.** Scan results never persisted/synced/backed up/AI-visible. `pdf-lib` 1.17.1 pinned, lazy. Pantry → shopping via event `shopping.requested`.
- 0.3 **Setup assistant: manual start, never forced;** progress device-local (`_meta` `setup.state`, ids only, no secrets); each step saves on its own "Weiter"; steps contributed via `setupSteps`; profiles only after a visible diff; `connectOAuth` takes an `AbortSignal`; week start synced (`core`).

## UI, home screen, brand → [decisions/ui-brand.md](decisions/ui-brand.md)
- 2026-10-01 **Home screen is not a module** (`web/src/home/`, route `/`); **every module ships a widget** (`validateManifest`, `check:modules`, `widgets.test.tsx`); hiding a widget ≠ deactivating the module; vault/desktop modules get status-only widgets; one synced layout (`_settings` scope `home`).
- 0.3 **`PageContainer` layouts replace a global `max-width`; CSS Modules + tokens, touch ≥ 44 px, `data-autofocus`; docs split (CLAUDE.md short, details in docs/).**
- 2026-09-30 **Design "Klar":** solid bg, bordered cards, no shadows/glass, one flat accent; ocean gradient brand-only; accents via `light-dark()`; CSS-only motion (transform/opacity, reduced motion); disk palette is the one hex-colour special case.
- 2026-10-01 **Design "Klar 2" tokens (Phase 1):** cool palette, dark first, shadows level 1/2, radii 8/12/16/20, 2 px focus outline; `--*-soft` names kept as `color-mix`; text size/density device-local. [Detail](decisions/ui-brand.md).
- 2026-10-01 **Navigation areas (Klar 2, Phase 2):** `manifest.area` is navigation only (module paths unchanged, area routes redirect to the last used module); favourites ≤ 5 in `_settings` scope `nav`; sidebar 248 px / rail 76 px; one "+ Neu", FAB phone-only. Settings: registry. [Detail](decisions/ui-shell.md).
- 2026-10-02 **Widget types, red only for overdue.** [Detail](decisions/ui-brand.md)
- 2026-10-02 **0.4–0.7:** merged and retired modules, LWW-faithful **app migrations** → [modules](decisions/modules.md)
- 2026-10-02 **Shared components (Klar 2, Phase 3):** compatible APIs, new look everywhere; flat `ItemRow`, sheets on phones, undo journal in core (`undoable`, modules opt in), keyboard shortcuts. [Detail](decisions/ui-components.md).
- 2026-09-30 **Licence MIT.**
- 2026-09-30 **App is called Nemo; every internal identifier keeps its old value** (bundle id, packages, keystore alias, updater key, IndexedDB `taschenmesser`, `tm-*` keys, backup format ids, crypto AAD, package names, MCP name/env) – a changed id detaches Android updates/data and breaks decryption; `brand-ids.test.ts` pins them; new exports are `nemo-backup-…`, old files still import.
- 2026-10-01 **Release assets are `Nemo-*` only** (until v0.3.1 also legacy `Taschenmesser-*` copies); `latest.json` points at `Nemo-Portable.exe`; installations ≤ 0.2.x can no longer self-update (maintainer decision); clients ≥ 0.3.0 still accept both names; verified before publishing.
- 2026-10-01 **Logo = clownfish C12 (replaces "Welle"), wordmark Q2, README banner with NEMO backronym** – single source `design/icon/final.params.mjs`; `npm run export` writes brand SVGs, `Logo.tsx`, splash; rasters via `tauri icon` + `gen:icons`. Logo orange `#E0550F`.
- 2026-09-30 **Android icons copied into the generated project after `tauri android init`;** notifications use monochrome `ic_notification`.
- 2026-10 **Focus aids: one switch per aid, calm wording, no pressure** – [design/FOCUS-GUIDELINES.md](design/FOCUS-GUIDELINES.md); also doc budgets raised: [decisions/focus.md](decisions/focus.md).
- 2026-10-03 **Reminders are pulled from a notification centre, the in-app card is opt-in (default off)** – an unprompted banner interrupts; "open" is derived (fired in the last 24 h minus answered), so no reminder schema change. Detail: [decisions/focus.md](decisions/focus.md).
- 2026-10-03 **Fluid root size 16 → 20 px on large monitors; grid heights, truncation and page-head sub-views are fixed in the base components** – spec § 7a. Detail: [decisions/ui-components.md](decisions/ui-components.md).

## Browser extension & vault bridge → [decisions/features.md](decisions/features.md)
- 2026-10 **The desktop app is the only source of vault data; the Brave extension has no vault and persists nothing** – one place to lock, back up and sync; the extension only asks live.
- 2026-10 **Native messaging (host = a mode of the Nemo exe) instead of the loopback API** – the local API refuses every request with an `Origin` header by design (no CORS); a second endpoint there would weaken it.
- 2026-10 **Brave first (Chromium MV3); Chrome/Edge/Chromium registered too, Firefox only a proposal** – Brave reads only its own registry key, so all four are written.
- 2026-10 **Trust = fixed extension id (manifest `key`) + one-time confirmation with a code shown on both sides; no pairing key in the extension.**
- 2026-10 **Origin rule is a global vault setting (same registrable domain / exact host), vault format unchanged.**
- 2026-10 **Extension zip is a CI artifact only; release integration is a written proposal** – `release.yml` stays untouched.
- 2026-10 **Readability: optional reading aid (off by default), colour only with meaning, grouped lists** – own engine, six category hues also for navigation areas, "Ruhig" mode; details in [decisions/readability.md](decisions/readability.md).
