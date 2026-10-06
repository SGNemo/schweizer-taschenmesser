# Launch security review (2026-10-06)

Scope: read-only review of `develop` at `d48a4fe` before the public launch. Areas: vault, sync, backup, local import API, browser extension and native messaging, supporter codes and webhook, updater, disk deletion, connectors, AI data flows, Tauri capabilities, Android, release pipeline, privacy statement. No code was changed in this phase. Ratings: **critical / high / medium / low / info**. Every finding was checked against the code; the top items were re-read line by line.

Earlier reports: [AUDIT-2026-09-30.md](AUDIT-2026-09-30.md) (status of S1–S19 is folded into the tables below), [VAULT-EXTENSION.md](VAULT-EXTENSION.md) (threat model; claims verified, two not implemented as described: X2, X6).

Threat model per area: attacker with the device (locked/unlocked), with the sync server, on the network, a malicious website (extension, import API), a malicious file (backup, import, feed), a malicious supporter code, a compromised release.

## Summary

No critical finding. Production dependency audits are clean (`npm audit --omit=dev`: 0 in `web`, `server`, `mcp`, `extension`, `services/supporter-webhook`, `site`; `cargo audit`: 0 vulnerabilities, 5 warnings – 3 unmaintained `unic-*` crates, the known `glib` unsoundness, one yanked `yoke-derive`). Dev-only alerts: `source-map-js` (web/server/mcp), `wrangler`/`miniflare`/`sharp` (webhook dev), Lighthouse CI chain (site).

| # | Sev | Area | Finding | Fix size |
|---|---|---|---|---|
| X1 | high | extension/bridge | Native-messaging host opens the named pipe without an impersonation limit | S |
| X3 | high | extension | Password verification oracle: a page `submit` triggers `compare` without a click and without a rate limit | S |
| P2 | medium | pipeline | Dev-Preview binaries are signed with the production updater key and keystore | M (new key: maintainer) |
| P3 | medium | pipeline | `workflow_dispatch` target `dev-preview-test` publishes a signed pre-release from any branch; dry runs sign when secrets exist | S |
| P1 | medium | pipeline | No GitHub Action pinned to a commit SHA; `dtolnay/rust-toolchain@stable` moving | S |
| N1 | medium | sync | End-to-end encryption still off by default on connect (S1) | S |
| N2 | medium | sync | No HLC drift bound: a far-future stamp from any device or the server poisons every clock and makes fields unwritable | S/M |
| N3 | medium | sync | Vault `check` is an offline guessing oracle; passphrase minimum 8 (S6) | S |
| N4 | medium | sync | Server responses are not validated on the client (malicious server → stuck or corrupted sync) | S |
| V1 | medium | vault | "Alle Daten löschen" leaves the biometric seal of the vault DEK in the OS store | S |
| V2 | medium | vault | Windows Hello is a consent gate only: the DEK is stored readable in Credential Manager (documented design limit) | L |
| V5 | medium | backup | Backup import writes record values unvalidated, no file size cap | M |
| T1 | medium | tauri | CSP lacks `base-uri`, `object-src`, `form-action`, `frame-src`; `connect-src` any host (S12) | S |
| T2 | medium | android | `allowBackup` / cleartext of the generated manifest never asserted (S15) | S (CI) |
| X2 | medium | bridge | "First instance flag → Nemo refuses to listen" not implemented on Windows: creation failure is retried as a non-first instance | M |
| X4 | medium | extension | Overlay host is an ordinary `<div>`: same-origin page script can hide or move it (UI redress) | M |
| A1 | medium | ai | Router fallback can resend a chat with attached data to another provider (incl. "may train" tiers) | S/M |
| A2 | medium | connectors | Native ICS fetch: no size cap, no content type check, reaches LAN hosts | S |
| V6 | low | crypto | KDF ceiling 1 GiB / t=32 / p=16 accepted from synced or imported headers | S |
| V7 | low | crypto | Malformed salt throws a non-`CryptoError` (unhandled rejection in two callers) | S |
| V3 | low | vault | Clipboard not cleared on lock (S19) | S |
| V4 | low | vault | Android clipboard without the sensitive flag | S/M |
| V8 | low | vault | Android unseal with stale pref but missing keystore alias → unhandled error, seal never removed | S |
| N5 | low | sync | Push subscription endpoint not run through the SSRF guard | S |
| N6 | low | sync | Feed proxy timeout is idle-based, no total deadline | S |
| N7 | low | docs | User docs still say PBKDF2 for the sync vault | S |
| N8 | low | sync | Any device token can revoke any other device and create the vault (by design, undocumented) | S (docs) |
| N9 | low | server | Compose publishes on all interfaces, CORS `*`, base image not digest-pinned (S10) | S |
| L1 | low | local api | Global auth-failure bucket lets a tokenless local process lock out all clients (S16) | S |
| L2 | low | local api | 8 connection slots × 15 s deadline, body read before auth: local slot exhaustion | S |
| X5 | low | extension | Opaque-origin (sandboxed) frames are treated as their URL's origin | S |
| X6 | low | extension | "No storage" lint misses `indexedDB`, `caches` and member access; e2e checks popup only | S |
| X7 | low | extension | OTP field detector ignores `data-nemo-ignore` | S |
| X8 | low | bridge | 30 secrets/min is per session, 5 sessions per extension | S |
| T3 | low | android | apk-installer trusts the TS layer for host and digest; `sha256` optional in Kotlin (S13/S18) | S |
| T4 | low | updater | Rust `validate_endpoint` accepts the dev manifest path for every build flavour; asset URL unchecked off Windows | S |
| T5 | low | oauth | Loopback listener single-threaded, 5 s read timeout | S |
| A3 | low | ai | Custom provider base URL accepts plain `http://` to remote hosts (key in clear) | S |
| A4 | low | connectors | Aborted OAuth login after code exchange neither stores nor revokes the refresh token | S |
| A5 | low | local model | Model file integrity not re-checked at load (download path is strong) | M |
| A6 | low | connectors | Google `include_granted_scopes=true` | S |
| W1 | low | webhook | Duplicate webhook resends the stored code to the address of the *new* payload | S |
| W2 | low | webhook | Rate limiter silently optional when the binding is missing | S |
| W3 | low | webhook | `SIGNING_KEY_ID` not range-validated; invalid value escapes as an unhandled exception | S |
| P4 | low | pipeline | Unpinned toolchain inputs (`choco install vulkan-sdk`, no `rust-toolchain.toml`, `tauri build` without `--locked`) | S |
| P5 | low | pipeline | No build provenance; signed dry-run artifacts downloadable | M |
| P6 | low | pipeline | Cached gitleaks binary restored without checksum | S |
| D1–D5 | – | privacy | Five doc/code mismatches (see table) | docs |

Info items (no action or docs only): local API L3–L7, vault V9–V11, supporter W4–W8, extension X9–X11, tauri T6–T8, pipeline P7–P13, AI A7–A8. They are listed in the area sections.

## Findings by area

### Browser extension and vault bridge
Verified against `docs/security/VAULT-EXTENSION.md`: origin matching (PSL incl. private suffixes, scheme+port), origin from `sender` only, closed shadow root, fill/copy/save after click, iframe origin, `allowed_origins` = one id, pipe DACL + remote rejection, replay (uuid/seq/session), strict Zod, 64 KB cap, no list-all, lock ends sessions, clipboard, codes-only errors, CSPRNG – all hold.

- **X1 (high)** `web/src-tauri/crates/vault-bridge/src/ipc.rs:192` opens the pipe with `OpenOptions` and no `security_qos_flags`. Rust's std does not set `SECURITY_SQOS_PRESENT`, so a server that owns the (predictable, machine-global) pipe name can impersonate the connecting host at impersonation level. Combined with the accepted "hostile second local user squats the name" scenario this is cross-user impact on shared Windows machines. Fix: `OpenOptionsExt::security_qos_flags(SECURITY_SQOS_PRESENT | SECURITY_IDENTIFICATION)`; optionally verify the server process owner. Windows-only, hand test X-series.
- **X2 (medium)** `ipc.rs:205-247`, `server.rs:109-115`: the first instance is created inside `accept()`; a failure (name squatted) is swallowed, the loop sleeps and retries, and because `first` was already cleared the retry creates a non-first instance that succeeds if the squatter's DACL allows. `channel-taken` is reachable on Unix only. Fix: create the first instance in `bind()`, surface `AddrInUse`, stop the loop instead of retrying.
- **X3 (high)** `extension/src/content/main.ts:198-219` sends username and password of every submitted form to the service worker (page script can dispatch `submit` / `requestSubmit()`); `lib/background.ts:136-168` calls `compare`; `modules/accounts/bridge/handler.ts:207-211` answers without a rate limit (only `secret` is limited). Result is observable (save card mounted or not). A page on a matching origin (XSS, or a sibling subdomain in the default "domain" mode) can test password guesses and probe usernames without user interaction. Fix: put `compare`, `create`, `update` into the per-session rate bucket; ignore `!event.isTrusted` submits; ideally run `compare` only after the user clicks the card. Tests: handler vitest + `background.test.ts`.
- **X4 (medium/low)** `content/ui.ts:21-32`: the shadow host can be removed, hidden or covered by the page. Same-site escalation only. Fix: visibility/connected checks before honouring clicks, re-append when removed.
- **X5 (low)** `lib/background.ts:69-73` falls back to `sender.url` when `sender.origin === 'null'` (sandboxed frames get the site's entries). Fix: return `undefined` for content scripts, keep the fallback for the popup path.
- **X6 (low)** `extension/eslint.config.js:16-29` restricts bare `localStorage`/`sessionStorage`/`chrome.storage` only; `indexedDB`, `caches`, member access not covered; e2e (`e2e/extension.spec.ts:210-223`) checks the popup context only. The threat model claims IndexedDB is covered.
- **X7 (low)** `lib/forms.ts:539-557` `findOtpField` does not apply `ignored()`.
- **X8 (low)** `handler.ts:34,124-136,181-184`: limit per session, up to 5 sessions per extension.
- X9 (info) extension identity is the public `key`; an unpacked extension with the same key is served after pairing (inherent to native messaging; add to "not covered"). X10 (info) argv origin spoofing by a same-user process and the display-only pairing code are as documented. X11 (info) `origin.ts:34` strips a trailing dot; a 64 KB request grows when the origin is stamped and surfaces as `app-not-running`.

### Sync client and server
Status of the earlier items: S3, S4, S7, S8, S17 fixed as described; S1 mitigated (warning) but default unchanged (N1); S5 open (token in `_secrets.syncConfig`, read by `service.ts:83-88` and `sw.ts:47-70`); S6 Argon2id done, minimum and oracle remain (N3); S9 documented; S10 open (N9). No regressions.

- **N1 (medium)** `pages/settings/SyncSection.tsx:27` `useState(false)`, `core/sync/service.ts:364`. A user who skips the toggle stores every value in plaintext on the server and in server backups. Fix: default `true` on a first connect; keep opt-out.
- **N2 (medium)** `core/db/hlc.ts:62-68` adopts any greater wall; `storage/dexie.ts:99-105` feeds pulled HLCs in; `ops.ts:216` accepts any greater stamp; `server/src/app.ts:70` checks the pattern only. A far-future stamp from any device (also one just before revocation) or the server is adopted by every device for good, and such a field cannot be overwritten by a device that has not adopted it. Fix: reject ops with `wall > now + 1 h` in `applyRemote`/`mergeOps` and `clock.receive`, and on the server at push; count as `rejected`. Additive to the LWW rule, so `contract/lww-cases.json` is untouched.
- **N3 (medium)** `GET /v1/vault` readable by any token (`app.ts:153`); `check` + salt in every SQLite backup; `MIN_PASSPHRASE_LENGTH = 8` (`service.ts:75`). Fix: minimum 12 plus a strength hint.
- **N4 (medium)** `adapters/selfHosted.ts:83` `res.json() as PullPage` and the other responses are used unchecked (`engine.ts:97-114`, `dexie.ts:91`). A non-string `id` throws before `setCursor` (permanent retry), a non-number cursor yields `since=NaN` forever. Fix: Zod `PullPageSchema` in the adapter → `SyncError('server')`.
- **N5 (low)** `app.ts:338` accepts any `https://` push endpoint; `push.ts:65` connects to it. Fix: `isBlockedAddress` on the resolved host (reuse `proxy.ts:118`).
- **N6 (low)** `proxy.ts:160` is an inactivity timeout. Fix: total deadline via `AbortController`.
- **N7 (low)** `docs/user/sync-server.md:80-81`, `core/sync/crypto.ts:1-4` still say PBKDF2.
- **N8 (low)** `app.ts:155-190, 326-330`: device tokens may create the vault and revoke other devices (intended; document in `docs/user/sicherheit.md`).
- **N9 (low)** `docker-compose.yml` publishes `${PORT:-8787}:8787` on all interfaces, CORS default `*`, base image by tag. Good: `USER node`, HEALTHCHECK, `/data` owned by node. Fix: document `127.0.0.1:` bind behind `tailscale serve`, Dependabot docker digests.
- N10 (info) server backup file written with default mode (directory 0700) → `chmod 0600`. N11 (info) no `setErrorHandler`; Fastify's default returns `error.message` on unexpected exceptions. N12 (info) ops for unknown collections skipped with the cursor advancing (data gap after upgrades, not security).

Done well: all SQL parameterised; schemas `additionalProperties:false` with HLC/collection/device patterns and size limits; device tokens 256-bit, SHA-256 stored, constant-time, revocation immediate; SSRF proxy exemplary (per-hop DNS, pinned socket, v4-mapped/NAT64/6to4, ≤3 re-checked redirects, feed content types, CSP sandbox); E2E AES-GCM with AAD per field; KDF floor and ceiling against a hostile server; `hardening.test.ts:503` asserts no secrets leave the device.

### Vault, crypto, secrets, backup
Note: `modules/vault/` is the documents module ("Unterlagen"); the password manager is `modules/accounts`.

- **V1 (medium)** `core/reset/device.ts:17-29, 46-66`: `deviceSecretNames` lists AI keys, backup passphrase and connector secrets, never the biometric seal. On Windows the seal is the raw DEK in Credential Manager (`plugins/secure-store/src/desktop.rs:97-105`), on Android a keystore-wrapped blob. After "Alle Daten löschen" any copy of the old ciphertext (backup, sync server) stays openable on that Windows account without the master password. Fix: read the header before deleting the DB and call `biometrics.remove(sealName(vaultId))`; same in `modules/accounts/seed.ts`. Unit test with a fake `BiometricService`.
- **V2 (medium, documented)** `desktop.rs:93-129`, `desktop/hello.rs:4-6`, decision `docs/decisions/distribution.md:13`: Windows Hello gates consent, the DEK itself is readable by any process in the session. Android is bound correctly (`CryptoObject`, `setUserAuthenticationParameters(0, BIOMETRIC_STRONG)`, invalidation on enrolment). Option: wrap the DEK with a Hello-backed `KeyCredentialManager` signature. Effort L; keep the UI hint meanwhile.
- **V3 (low)** `modules/accounts/copy.ts:8-11` → `core/platform/web.ts:44-66`: timer only; the lock subscription (`service.ts:24-26`) ends bridge sessions but leaves the clipboard. Fix: `clipboard.clearSensitive()` on lock.
- **V4 (low)** `core/platform/tauri/index.ts:136-143` uses the plugin `writeText`; no `EXTRA_IS_SENSITIVE` on Android 13+. Fix: small Kotlin command in `secure-store`.
- **V5 (medium)** `core/backup/backup.ts:15-19` validates `id`, `deletedAt`, `_f` only; `apply.ts:94-107` writes every `_f` key via `bulkPut`; `BackupSection.tsx:96` reads the whole file without a limit. Prototype pollution is blocked (`ops.ts:12,45-53`), only known synced tables are restored, `_secrets`/`_meta`/`_outbox`/`_blobs` excluded. Residual: records of arbitrary shape in any module table incl. `_settings`/`_modules`. Fix: validate the data part against the collection schema (skip and count invalid rows in the preview), refuse files > 64 MB before parse.
- **V6 (low)** `core/crypto/kdf.ts:32` allows m = 1 GiB, t = 32, p = 16 from a synced header (`accounts_vault.header` is one synced field) or an import file: minutes of work or WASM OOM on a phone. Fix: lower the ceiling (256 MiB, t ≤ 10, p ≤ 4); existing headers use 64 MiB/t=3.
- **V7 (low)** `core/sync/crypto.ts:23-28` `atob` throws `DOMException`; `modules/accounts/backup.ts:40` and `ToolsDialog.tsx:172-176` catch `CryptoError` only. Fix: wrap → `CryptoError('malformed')`.
- **V8 (low)** `SecureStorePlugin.kt:246-270`: pref present, alias gone → new key, `AEADBadTagException` → reject → `LockScreen.tsx:15-20` has no catch. Fix: answer `invalidated`, catch in `LockScreen`, remove the stale seal.
- V9 (info) compromised server vs vault: header and entries are single-field ciphertext with AAD per entry; tampering yields wrong-password/corrupt (DoS); no rollback protection (server can replay an older valid ciphertext) – inherent in LWW, option `rev` counter inside the plaintext. V10 (info) CSV export without formula neutralisation (Bitwarden-compatible by design, behind warning). V11 (info) `kdf.ts:35` disables the floor for `MODE === 'test'`; also require `DEV`.

Done well: Argon2id 64 MiB/t=3 with stored params, floor/ceiling/salt checks, NFKC; AES-256-GCM fresh nonce per call, AAD everywhere; DEK wrapped by KEK, `check` prevents a foreign biometric key from unlocking; non-extractable keys, raw bytes wiped; auto-lock idle + background; FLAG_SECURE on the vault route; unlock throttling; restore atomic with mandatory safety copy, dry run, checksum before passphrase, known-table allowlist, secrets excluded with tests.

### Local import API and MCP
- **L1 (low, S16 confirmed)** `crates/local-api/src/server.rs:18, 315-322`: one `FAILURES_KEY`, checked before authentication for every request; after 20 bad tokens per minute valid tokens get 429 too. "Per peer" is meaningless on loopback; fix: check the budget only after a failed auth. Adjust `tests/server.rs:246-258`.
- **L2 (low)** `server.rs:41-43, 201-204, 233-246`: 8 slots, 15 s deadline, body read before auth. Fix: short head deadline (2 s) before the first CRLFCRLF.
- L3 (info) scopes, module exclusion and write confirmation are TS-only by design (Rust = transport, `lib.rs:1-9`; tests `localapi.test.ts:91-155`, `dataapi.test.ts:42-63`). L4 (info) a `write` token can undo its own committed batch (`handler.ts:246-256`); mention in `docs/AI-IMPORT.md`. L5 (info) distinct status codes before auth (documented troubleshooting). L6 (info) `dataapi/parse.ts:244` echoes an input key name into the error; truncate. L7 (info) MCP token in plaintext env (documented).

Done well: loopback bind with post-bind assertion, exact `Host`, any `Origin`/non-`none` `Sec-Fetch-Site` → 403, no CORS, `httparse` limits, `Transfer-Encoding` → 411, tokens 32 random bytes stored as SHA-256 in device-local `_meta`, constant-time compare over all entries, hot revocation, no logging, pending batches with in-app confirmation, identical 404 for blocked/unknown/system names, MCP URL restricted to loopback with `redirect: 'error'`, prompt parity test.

### Supporter codes and webhook
- **W1 (low)** `services/supporter-webhook/src/issue.ts:35-44`: on a duplicate `kofi_transaction_id` the stored code is queued to the e-mail of the current payload; `existing.emailMac` is never compared. Requires the Ko-fi verification token. Fix: compare `emailMac`, log `address-mismatch`, answer ok without sending.
- **W2 (low)** `src/index.ts:54-58`: missing `RATE_LIMITER` binding = unlimited, no log. Fix: log once / require unless `DEV`.
- **W3 (low)** `index.ts:50` validates the private key only; `SIGNING_KEY_ID` > 255 throws `RangeError` in `encodeCode` → Worker exception; `255` would sign codes only E2E builds accept. Fix: `/^\d+$/` and 0..254 in `misconfigured()`.
- W4 (info) Ko-fi auth is a static token in the body (Ko-fi's protocol; constant-time compared; replay idempotent). W5 (info) non-canonical base32 (`base32.ts:39`) and Ed25519 encoding malleability yield a second valid string for the same payload; app stores the canonical form and dedupes by id – no impact; optional `bits < 5`. W6 (info) no revocation list (decided). W7 (info) `stats:issued` non-atomic. W8 (info) `/resend` without CSRF token (1 mail/h to the donor's own address).

Done well: domain-separated Ed25519 message, fixed layout with length checks, uniform `{ok:false}`, 400-char cap; production key id 1 present, E2E key id 255 only via `VITE_INCLUDE_EXAMPLE` and asserted absent from stable/dev bundles (`core/seed/devFlag.test.ts`); offline verification pinned by source scan and runtime spies; webhook: token before parsing, Zod with limits, 16 KB/2 KB caps, strict CSP/no-store, KV holds peppered HMACs and the code only, allow-listed structured logs, secrets only via `wrangler secret put` with a repo hygiene test; CLI refuses to write the key inside a checkout, mode 600, never echoes key material. No private-key material tracked in the repo.

### Updater, disk deletion, Tauri shell, Android
- **T1 (medium, S12)** `web/src-tauri/tauri.conf.json:24`: no `base-uri`, `object-src`, `form-action`, `frame-src`; `connect-src … https: http:`. Fix: append `base-uri 'self'; object-src 'none'; form-action 'none'; frame-src 'none'` (no iframes in the tree) plus a Vitest reading the config. Dropping `http:` would break plain-HTTP sync/feeds – decision.
- **T2 (medium, S15)** `release.yml:306-310`, `dev-preview.yml:295-297`: `tauri android init --ci` then icons only; `allowBackup`/`usesCleartextTraffic` never asserted. Fix: grep-assert or sed-patch after init (CI change).
- **T3 (low, S13/S18)** `ApkInstallerPlugin.kt:69-72, 119-120, 136-168`: `https://` only, digest optional, any file under the cache dir. The TS caller restricts (`core/update/github.ts:220-234`, `updater.ts:124-126`). Fix: in `plugins/apk-installer/src/mobile.rs:207` require 64-hex `sha256` and host `github.com` + release path prefix (Rust unit test).
- **T4 (low)** `web/src-tauri/src/update.rs:37`: `DEV_MANIFEST_PATH` accepted without `is_dev_identifier`; asset URL check `#[cfg(windows)]` only (`:131-139`). Signature verification still blocks foreign binaries. Fix: pass `dev` in, reject the dev path for stable, check assets on all desktop OSes.
- **T5 (low)** `oauth.rs:114, 154-170`: one connection at a time, 5 s read timeout → a stray local client delays the real redirect. Fix: thread per stream or 1 s timeout.
- T6 (info) `crates/disk-scan/src/system.rs:21-25` protects the exe's parent as a tree; a portable exe at a drive root blocks the whole drive (deny direction). T7 (info) pre-update copy plaintext without a backup passphrase (`core/update/backup.ts:40-46`, S2). T8 (info) `fs:allow-remove` with `$APPDATA/**` (S18); `clipboard-manager:allow-read-text` is used for clear-if-unchanged – keep.

Done well: minisign pubkey pinned, endpoint restricted to this repo with scheme/host/port/userinfo/query/`..` tests; second signature check before the swap, `MZ` check, `.new`/`.old` sibling swap with rollback on every failure path (fault-injected tests), temp file next to the exe; SemVer 2.0 incl. pre-release precedence; channel separation (`effectiveChannel`, zod enum `['stable','beta']`, `pickUpdate` drops drafts, non-SemVer tags, pre-releases); mandatory pre-update backup; release notes rendered as text; `tests/commands.rs` keeps `build.rs`, handlers and capabilities in sync. Android: HTTPS, 300 MiB cap, streaming SHA-256, private cache, FileProvider not exported, apksigner passwords via env, dev versionCode strictly increasing. Disk: webview never passes a delete path, guard normalises `\\?\`/UNC/`..`/case on `canonicalize` output, known folders via `SHGetKnownFolderPath`, re-check before deletion, no link following, typed confirmation in Rust, plan TTL 5 min, recycle bin via `IFileOperation` with abort if the item would be deleted permanently. Tauri: no `withGlobalTauri`, no remote IPC access, no asset protocol, no devtools, capture window limited to two commands. OAuth: `127.0.0.1:0`, state checked in Rust, PKCE S256. Share target: `text/plain` only, 20 k chars, extras consumed.

### Connectors and AI data flows
- **A1 (medium)** `core/ai/router.ts:102-143` walks all usable providers on error/cooldown/limit; `modules/chat/engine.ts:94-101` passes the history incl. attached context through it; preview text promises one provider (`strings.ts:4119-4121`); free presets are `mayTrainOnInputs`. Fix: for requests with history/context restrict fallback to providers with `mayTrainOnInputs === false` or disable fallback; show the answering provider (`response.providerId`).
- **A2 (medium)** `connectors/ics/sync.ts:137-153` → `core/net/fetchPublic.ts:128` direct fetch on native, `res.text()` unbounded, no content type, `http:` and any host allowed; `parseIcs` has no event cap, title/location uncapped (only `note` sliced). The PWA path through the server proxy is narrow. Fix: 2 MB limit and content-type check in the native branch, cap events (5000) and field lengths.
- **A3 (low)** `core/ai/config.ts:36` `baseUrl: z.string()`; key sent as Bearer (`providers/openai.ts:152`). Fix: require `https:` unless loopback/RFC1918.
- **A4 (low)** `core/connectors/service.ts:143-151`: abort after `exchangeCode` returns without storing or revoking the refresh token. Fix: `revokeToken` in that branch.
- **A5 (low)** `src-tauri/src/local_llm.rs:290-294`: `llm_load` checks only that the `.sha256` sidecar exists. Download is strong (https, host allow-list `huggingface.co`/`hf.co`, hash and size from the bundled catalogue, mismatch deletes). Option: re-hash on demand.
- **A6 (low)** `connectors/google/index.ts:26` `include_granted_scopes=true`; drop.
- A7 (info) test gaps: chat engine body contains attached context only after "Mit Daten senden"; oversized ICS rejected. A8 (info) local storage: usage rows carry provider/model/tokens/cost/error code, no prompt text; intent cache keyed by hash(question|date|schema), value may hold user-typed values, local only, cleared by "KI aus"; connector status redacted; ICS URLs stored as connector secrets.

Verified OK: PKCE S256, 24-byte state, one-shot loopback listener, constant response page; refresh token in secrets, access token memory-only, revoke on disconnect; Gmail metadata + snippet only, nothing stored; descriptions via `DOMParser` to text; no `dangerouslySetInnerHTML` in `web/src`; assistant prompt = manifests + date + question (`prompt.ts:437-458`), tool calls Zod-validated (≤ 8 ops), `prepareOp` re-validates with the real collection schema, deletes only as previewed ops, `WritePreview.tsx:317` is the only caller of `commitOps`, chat has `tools: []`; chat markdown links http/https/mailto only, no images/HTML; Ollama probe one GET to `localhost:11434`; `privacy.test.ts` uses real adapters with a recording fetch and seeded recognisable data; `exclusion.test.ts` pins the schema-less modules.

**Data that leaves the device** (evidence for the privacy statement):

| Path | Destination | Opt-in | Preview |
|---|---|---|---|
| Assistant: question, date, compact schema and action text, tool defs | configured provider(s) | provider configured; "KI aus" | n/a (no user data) |
| Chat: typed messages + prior turns | provider via router (fallback: A1) | per thread | typed text |
| Chat: attached module data (≤ 2000 chars) | same | per-thread allow-list **and** per message | mandatory modal |
| "Verbindung testen": `ping` | one provider | click | n/a |
| OAuth exchange/refresh; Google API calls (calendar list/events, Gmail metadata) | `googleapis.com` | login / per feature | – |
| ICS/feed fetch | feed host (native) or own sync server `/v1/proxy` (PWA) | user-added URL | – |
| Model download (URL from bundled catalogue) | `huggingface.co` (+ CDN redirect) | button, pinned sha256 | – |
| Update check (daily, default on, off switch) | `api.github.com` / `github.com` | default on | – |
| Currency tool on open | `api.frankfurter.dev` | automatic when the tool opens | – |
| Public IP tool | `api.ipify.org` | click | – |
| Ollama probe | `localhost:11434` | automatic on the settings page | – |

### Release pipeline and supply chain
- **P1 (medium)** every `uses:` by tag (`actions/*@v4`, `codeql-action@v4`, `Swatinem/rust-cache@v2`, `dtolnay/rust-toolchain@stable`); the release jobs hold the updater key and keystore. Fix: pin to full SHAs with version comments (Dependabot `github-actions` is configured) plus a tiny check that `uses:` matches 40 hex.
- **P2 (medium)** `dev-preview.yml:224-227, 300-316`: the dev exe is verified against the stable pubkey and the APK signed with the production keystore; `tauri.dev.conf.json` overrides only name and identifier. Every push to `develop` yields a binary carrying a valid stable-updater signature. The stable updater never *offers* it (`latest.json` endpoint, `pickUpdate`), but the "foreign signed files are refused" promise in `docs/user/installation.md:14-15` does not distinguish channels. Fix: second minisign key for dev (`plugins.updater.pubkey` in the dev config, `TAURI_DEV_SIGNING_PRIVATE_KEY`); the key must be created by the maintainer. APK: different package id, shared keystore less critical – document.
- **P3 (medium)** `dev-preview.yml:102-110`: target `dev-preview-test` sets `PUBLISH=true` without a branch check; `release.yml:212-219` signs on dry runs whenever secrets exist. Fix: branch check for `dev-preview-test`, sign only when `publish == 'true'`, or a GitHub Environment with required reviewers for jobs using signing secrets.
- **P4 (low)** `release.yml:202` `choco install vulkan-sdk -y` unpinned; no `rust-toolchain.toml`; `npx tauri build` without `--locked`; `ci.yml:480` pip without hashes.
- **P5 (low)** no `attest-build-provenance`; signed dry-run artifacts downloadable by any GitHub user.
- **P6 (low)** `ci.yml:73-84`: cached gitleaks binary restored without checksum (a poisoned `develop` cache could blind the scan). Fix: rebuild per run or verify the hash.
- P7 (info) `run:` interpolations (`release.yml:149-150, 167, 218, 340, 349, 404-405, 439-448, 473`; `dev-preview.yml:313, 384-386, 408, 444-447`; `ci.yml:182`) use only outputs derived from `package.json`, tags, `find` or constants; `inputs.*` and `github.event.*` go through `env`; no `pull_request_target`, no `head_ref`. P8 (info) permissions minimal (`contents: write` only on release/publish jobs, no `id-token`). P9 (info) caches branch-scoped; `develop` caches readable by tag builds. P10 (info) secrets via `env` only, keystore decoded to `$RUNNER_TEMP` with `umask 077` and removed by trap; artifact audit searches every artifact (incl. inside APK/ZIP) for secret values, forbidden file names, private-key markers and checks `.sig` key ids; it does not assert the APK cert fingerprint (dev-preview prints it). P11 (info) gitleaks default rules, 16 per-commit fingerprints, full history in ci/release/dev-preview. P12 (info) Dependabot covers npm/cargo/gradle/docker/actions; no `npm audit`/`cargo audit` job in CI. P13 (info) `release.yml:452-454` `if: env.CF_PAGES_DEPLOY_HOOK != ''` references a step-level env in the step's own `if`, which is not visible there – the site rebuild hook probably never fires; verify in a run log.

## Privacy statement vs. code

| Claim | Stated in | Code | Match | Change |
|---|---|---|---|---|
| Data stays on the device, no account, no Nemo cloud | README, site, `datenschutz.astro`, `docs/user/sicherheit.md` | IndexedDB only; webhook opened as a link | yes | – |
| Sync optional, self-hosted, optionally E2E | README, `sicherheit.md`, `sync-server.md` | `core/sync`, `server/` | yes (KDF text stale: N7) | fix N7 |
| "AI never sees your data" | README:66, `sicherheit.md:7`, `ki-assistent.md` | true for the assistant (`privacy.test.ts`); chat attach (preview) and local API/MCP (granted scopes) are user-enabled exceptions | partial | **D1** name the two exceptions |
| Vault invisible to AI/search/import | README, `sicherheit.md` | `exclusion.test.ts`, `dataapi/scope.ts` | yes | – |
| No telemetry, no ads | `sicherheit.md:10` | no analytics/crash reporting anywhere (grep clean) | yes | – |
| Updates signed, loaded from GitHub | README, site, `installation.md` | daily automatic check (`controller.ts:21-22`, `prefs.ts:12`), off switch exists | partial | **D2** say "daily, automatic, GitHub sees your IP, switch off under App-Updates" |
| Website: no cookies, analytics, third-party content | `datenschutz.astro`, `privacy.astro` | self-hosted fonts, CSP `default-src 'none'`, CI forbids external origins | yes | – |
| Ko-fi link only; Worker stores hashes 400 days | `datenschutz.astro`, README | link only; KV hashes | yes | **D4** name Resend as mail processor (required by `SUPPORTER-NOTES.md`); controller still `[PLATZHALTER]` |
| Third-party calls without user data | not stated | frankfurter.dev automatic, ipify on click, huggingface.co after consent, feed hosts/proxy, Google with a connection | missing | **D3** add an "Externe Dienste ohne Nutzerdaten" list to `sicherheit.md` |
| "Releases are built in CI from tags" | `SECURITY.md:15` | also manual dispatch on `main` | partial | **D5** "from tags or a manual run on main" |
| Dev-Preview "own app with own data" | README, site | own identifier and data | yes (same keys: P2) | – |

## Plan for phase 2 (needs approval)

**A. Small fixes with a test each (proposed, one commit per area):**
extension/bridge X1, X3, X5, X6, X7, X8 · sync N1, N3, N4, N5, N6 (+ N7 docs) · N2 drift bound (client + server, additive) · vault/crypto V1, V3, V6, V7, V8 · tauri T1 (+ config test), T3, T4 · AI/connectors A2, A3, A4, A6 (A1 if the router test stays small) · webhook W1, W2, W3 · local API L1, L2 · pipeline P3, P4, P6 · docs D1–D5, N8, L4, X9.

**B. Needs a maintainer decision or key material (proposal only):** P2 second dev signing key · P1 SHA pinning (CI change) · T2 Android manifest assertion (CI change) · X2 pipe first-instance restructure (M) · V5 backup row validation (M) · V2 Hello-backed DEK wrapping (L) · S13 APK signature over the digest · P5 attestations · S5 sync token into `SecretStore`.

**Manual checks before launch (maintainer, real hardware):** X1/X2 pairing and lock on Windows with a second local user present; Windows Hello unlock then "Alle Daten löschen" and confirm the Credential Manager entry is gone (after V1); APK update on a phone (digest mismatch path); Android 13 clipboard overlay after copying a password; dev-preview exe must not be offered to a stable install; `release.yml` run log for the site deploy hook (P13).
