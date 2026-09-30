# Decisions – Nemo

Each entry: decision → why → source. Only what is documented in `CLAUDE.md`, `docs/architecture.md`, code, commit messages or PRs. Details: [`architecture.md`](architecture.md).

## Product & data
- **Local-first, IndexedDB as source of truth; sync is a separate optional layer.** Data stays on the device; a self-hosted server only relays field operations. Source: CLAUDE.md intro; architecture.md "Sync & backup".
- **One Dexie table per collection, every synced record has an envelope (`id, createdAt, updatedAt, deviceId, deletedAt, _f`); writes only via `createRepo`.** Validation, HLC stamping, tombstones and outbox in one place. Source: architecture.md "Data".
- **Money = integer cents; dates `YYYY-MM-DD`, times `HH:mm` (local wall clock).** Calendar/reminders stay put across time zones and recurrence works on plain dates. Source: architecture.md "Data".
- **`now()` / `today()` instead of `Date.now()`.** Injectable clock makes date logic testable. Source: architecture.md "Data".
- **German-only UI, all texts in `web/src/strings.ts`; code/comments/commits English.** Source: CLAUDE.md.
- **Modules are manifest-driven and isolated (event bus + manifest contributions; only read-only `public.ts` exceptions).** Modules can be switched on/off and stay independent; enforced by ESLint and `registry.test.ts`. Source: architecture.md "Isolation".
- **Subscriptions are forecasts, never auto-booked transactions.** Source: architecture.md "Money & finance".
- **Local-only collections (`CollectionDef.local`, `_blobs`)**: news articles, feed state, vault files never enter outbox/sync/backup. Source: architecture.md "News module", "Extra modules".

## Sync
- **Field-level last-write-wins by greatest HLC; rule implemented twice on purpose** (`core/sync/ops.ts`, `server/src/store.ts`), pinned by `contract/lww-cases.json`. The server never merges values, only assigns a monotonic `seq`. Change both or neither. Source: architecture.md "Sync & backup".
- **`SyncAdapter` abstraction** (`selfHosted` built; `googleDrive.stub.ts` documents the unbuilt second backend). Source: architecture.md "Layers".
- **Optional E2E encryption of each op value (PBKDF2 → AES-GCM, AAD = `collection/id/field`)**; ids/fields/HLC stay readable because the server needs them. Source: architecture.md "Encryption".
- **Server is single-tenant, no tombstone GC** – accepted known limits. Source: architecture.md "Not built / known limits".

## AI
- **Never send user data to the model.** Only instructions, compact `aiSchema` of enabled modules, the date and the question; results are computed locally, no second call. Guarded by `privacy.test.ts` for every adapter. Source: architecture.md "AI assistant"; CLAUDE.md rules.
- **Three tiers, cheapest first:** local German parser (0 tokens) → full text → intent cache → model. Goal: as few tokens as possible. Cache key excludes provider/model so fallbacks share hits. Source: architecture.md "AI assistant".
- **Model output is never evaluated; it is a Zod-validated `Intent` executed against a field whitelist.** Creating entries needs an explicit confirmation card. Source: architecture.md.
- **Multi-provider router with fallback, cooldowns and local limits;** presets are only editable defaults (names/prices unverified). API keys live in `PlatformService.secrets`, never in the config list. Source: architecture.md "Multi-provider AI".
- **`accounts` (password vault) is invisible to AI, search, dataapi and local API** (no `aiSchema`, `dataApi: false`, id block; `exclusion.test.ts`). Source: architecture.md "Password vault"; CLAUDE.md.
- **Connectors must not import `core/ai`; news has no `aiSchema`.** Mail/feed text can never reach a model except via the explicit news-brief button (headlines only). Source: architecture.md "Connectors", "News".

## Native & distribution
- **Tauri 2 shell around the unchanged web app; thin by design.** PWA build stays the fallback; native builds drop the service worker (`TAURI_ENV_PLATFORM`). Source: commit fb1400b; architecture.md "Native distribution".
- **`PlatformService` is the only browser/native seam** (`@tauri-apps/*` only in `core/platform/tauri/**`, enforced by ESLint). Source: commit fb1400b.
- **Portable Windows exe instead of NSIS/MSI installers** (`tauri build --no-bundle`), with own signed self-update: `tauri-plugin-updater` can only launch installers, so it just checks/downloads; `portable.rs` re-verifies the minisign signature and swaps the running exe with rollback. `latest.json` has only `windows-x86_64-portable`. Breaking change: old installed 0.2.0-beta.1 cannot self-update. Source: commit 6a0f1aa.
- **Android APK signed by `scripts/android-sign.mjs`, not by Gradle** (no dependence on patches to the generated project); `gen/` is git-ignored and generated in CI. Source: architecture.md "Android".
- **Android `versionCode` derived from SemVer incl. pre-release rank** (monotonic; Tauri's default ignores pre-releases). Source: architecture.md "Versioning".
- **Bundle identifier `io.github.sgnemo.taschenmesser` never changes**; Android keystore and updater key must never be lost. Source: CLAUDE.md.
- **Closed-app reminders on Android via OS scheduling** (WebView has no Web Push); in-app scheduler stays quiet then. Source: architecture.md.
- **Secrets in OS keystore (Credential Manager / Android Keystore); Windows Hello is a consent gate, not cryptographic binding** – documented limit, master password stays the real protection. Source: architecture.md step 11b.

## Releases & security
- **Conventional Commits; release notes generated from them** (`scripts/changelog.mjs`). Source: architecture.md; CLAUDE.md.
- **Integration branch `develop`, PRs go there; `main` only for releases.** Source: PRs #2–#4 (base `develop`, PR #2 text: `main` would bury changes in the release diff); tag/merge history (`Merge develop into main (release 0.2.0)`).
- **Tag `vX.Y.Z[-beta.N]` triggers a signed release; tag must equal `web/package.json`; run fails without signing secrets.** Pushes to `develop` touching native/scripts are dry runs. Source: architecture.md "Releases & CI".
- **Public-repo safety by construction:** gitleaks over history, `scripts/audit-release.mjs` on artifacts (secret values, key markers, forbidden file names, `.sig` key id), keystore file with `umask 077` + cleanup. Do not weaken. Source: architecture.md "Public downloads are safe by construction".
- **Windows binaries carry no Authenticode certificate** (SmartScreen warning documented); updater payload is verified with the updater key. Source: architecture.md.

## Imports & AI import API
- **Preview-before-write for every import:** wizard shows per-row checkboxes, duplicates pre-deselected, invalid rows; nothing is written before confirmation; each import is one undoable batch (`_imports`, ids `imp-<batch>-<n>`). Source: architecture.md "Start data"; commit 14205c5.
- **One import format per collection derived from its Zod schema** (no second hand-kept schema); `scope.ts` is the single filter. Source: commit 4d8b3f1; architecture.md "Data contract".
- **Local AI import API: desktop only, off by default, loopback-only, transport in Rust, meaning in TypeScript.** No bind-address setting, no CORS, Host/Origin checks, hashed tokens with per-module rights, nothing logged. API imports wait as pending batches for user confirmation; changes to existing entries are never pre-ticked or auto-committed; no delete endpoint. Source: commits 4a0b230, 0944e68; architecture.md.
- **MCP wrapper is a thin separate project with no data access, not shipped in release downloads.** Token only sent to 127.0.0.1/localhost, no redirects. Source: commit c4e9b30.

## Connectors & network
- **User brings their own Google OAuth client (Desktop app type); nothing shipped in repo/binary.** OAuth via PKCE + loopback listener; Google login not on Android yet. Source: architecture.md "Connectors"; CLAUDE.md.
- **Gmail scan reads only metadata + snippet, never the body; user confirms each suggestion.** Source: architecture.md.
- **Sync-server proxy `/v1/proxy` is deliberately narrow (SSRF hardening)** – needed by the PWA for ICS/RSS; native app fetches directly. Source: commit 7e93948; architecture.md.
- **Spotify connector not built** (docs unreachable, API constraints); launcher preset opens the web player. Source: architecture.md step 6.

## UI
- **`PageContainer` layout system replaces a global `max-width`;** modules choose `manifest.layout`, never their own max-width; inner layouts use container queries. Source: PR #3.
- **CSS Modules + tokens, touch targets ≥ 44 px, `data-autofocus` (React `autoFocus` runs before `showModal()`).** Source: architecture.md "UI".
- **Docs split:** `CLAUDE.md` is the short working guide; long design notes live in `docs/architecture.md`. Source: PR #2.

## Setup assistant
- **Manual start, never forced.** Fresh empty app: a discreet welcome card ("Später" = `dismissed` for good). Existing installations: the start migration sets `dismissed` + hidden checklist, the assistant stays available in the settings. Why: no surprise for users with data. Source: task brief; `core/setup/detect.ts`.
- **Progress is device-local (`_meta` `setup.state`), holds step ids only.** Not synced, not in backups, no values/secrets (strict Zod schema, tested). Why: setup differs per device (notifications, keystore), and secrets must never leak through it.
- **Each step saves on its own "Weiter"; cancelling drops only the current draft.** No end-of-run commit, so an abort never applies half a setup. Vault is created only with a confirmed password on "Weiter".
- **Steps are contributed via `setupSteps` on module/tool/connector manifests** (`core/setup/types.ts`); ids carry the owner's id as prefix. Why: new modules extend the assistant without special cases. The vault step lives in `modules/accounts` and carries no data (exclusion test).
- **Reuse instead of rebuild:** sync/backup/connector steps embed the settings sections/cards; start data opens the existing wizard; AI keys go through `setProviderKey` (secret store), test result shows only the mapped reason.
- **Profiles set the target state, including switching modules off, but only after a visible diff and an explicit confirmation; always `keep` data.** `ModuleManifest.requires` (invoices, budgets → finance) only informs/auto-adds, never blocks.
- **`connectOAuth` takes an `AbortSignal`:** an abandoned login stores no token and writes no status (the loopback listener times out by itself). The connector card aborts on unmount.
- **First weekday is a synced setting (scope `core`, `useWeekStart`).** Currency/format/language/time zone are shown as info only (fixed: EUR, de-DE, local wall clock). AI week ranges still use Monday.

## Nemo rebrand & design system
- **The app is called Nemo; every internal identifier keeps its old value.** Tauri `identifier` `io.github.sgnemo.taschenmesser`, Android packages/namespaces, keystore alias, updater endpoint/pubkey, repo name, IndexedDB `taschenmesser`, storage keys (`tm-theme`), backup format ids (`taschenmesser-backup`, `-vault-backup`, `-encrypted`), crypto AAD/check strings, Cargo/npm package names, MCP server name and `TASCHENMESSER_TOKEN/URL`. Why: a changed ID makes Android treat an update as a new app, detaches the app from its data and breaks decryption. Only what users see changed. `web/src/brand-ids.test.ts` pins them. New exports are named `nemo-backup-…`, old `taschenmesser-backup` files still import (fixture test).
- **Release asset names: transition with both names.** Releases carry `Nemo-Portable.exe(.sig)` / `Nemo.apk(.sha256)` (README buttons) and the legacy `Taschenmesser-*` copies of the same signed bytes. `latest.json` still points at the legacy exe because installed apps only accept that file name (`update.rs`); new clients accept both (`PORTABLE_ASSETS`, `APK_ASSET_PAIRS`). Follow-up once everybody is on ≥ this version: point `latest.json` at the Nemo names, drop the legacy copies.
- **Logo "Welle" (2026-09-30, chosen by the maintainer from three own drawings, see `docs/DESIGN-CONCEPT-2026-09-30.md`).** One orange fill; the two curved stripes and the eye are cut out with a mask, so the mark works on any background and the monochrome variant is the same shape. Source `web/brand/logo-mark.svg`; `Logo.tsx` and the splash repeat the paths (`brand-sync.test.ts`). Rendered by `npm run gen:icons` (Playwright Chromium, Inter embedded as data URL); ICO (16–256) and `favicon.ico` are assembled by the script; `tauri icon` produces the remaining native icons and the script removes the unused iOS/appx sets. Wordmark: Nunito ExtraBold outlined (OFL); app font Inter Variable (OFL, local). Why a new mark: the first one used five fills and a separate fin, read poorly at 16 px and could not be inverted.
- **Design "Klar" (2026-09-30, variant A of three, chosen by the maintainer).** Solid page background, cards with borders instead of shadows and glass, radii 10/14/18, one flat accent for the primary action and the FAB, quiet `Segmented` (surface-2 track, white pill + accent text), tokens for weights/z-index/icon sizes/focus ring/hairline gaps, `--border-strong` ≥ 3:1 on `--surface-2`. The ocean gradient stays brand-only (`--ocean-from/to`: splash, empty states, images). Why: "ruhig und simpel"; the accent had lost its meaning, three segmented controls existed, glass and gradients cost rendering on phones. Variants B ("Tiefe") and C ("Riff") are token overrides in `docs/design-proposals/` and can be switched to later.
- **Accent variants (teal, coral, lagoon) use `light-dark()` under `data-accent`,** stored in `localStorage` (`tm-accent`, device-local like the theme). PWA manifest colours and the splash use the light theme values; `applyTheme` rewrites the `theme-color` metas when the user forces a theme.
- **Motion is CSS-only, transform/opacity, 120–250 ms, off under `prefers-reduced-motion`.** Progress bars fill via `scaleX`, no colour transitions. No animation library. Loading = `Skeleton`, not spinners.
- **Licence MIT (2026-09-30, maintainer's choice).** Maximum reuse, compatible with every dependency (MIT/Apache/ISC, fonts OFL). Logo and name are asked to stay with this project (README note), not enforced by the licence.
- **Release assets are verified before publishing:** `cmp` of the Nemo/legacy exe, sig and apk pairs, `sha256sum -c` of both checksum files, `latest.json` must reference the legacy exe (`UPDATER_PORTABLE_ASSET`). The asset list lives once in `web/scripts/lib/releaseAssets.ts` (`release-assets.mjs` feeds the workflow).
- **Android icons are copied into the generated project after `tauri android init`** (`release.yml`): the CLI template ships its own launcher icons and copies nothing from `src-tauri/icons/android`. Notifications name the `ic_notification` drawable on Android (monochrome status-bar icon); web push uses `pwa-badge-96.png`.
