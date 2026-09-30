# Decisions – Taschenmesser

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
