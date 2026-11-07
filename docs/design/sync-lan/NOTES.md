# LAN sync – reading notes (facts with sources)

Base for [CONCEPT.md](CONCEPT.md). Paths relative to the repo root, read on `develop` 2026-11-06. "unsicher:" = not verified.

## 1. Rules (CLAUDE.md, docs/RULES.md)

- Sync rule: field LWW by greatest HLC, implemented twice (`core/sync/ops.ts`, `server/src/store.ts`), pinned by `contract/lww-cases.json`, change both or neither – `docs/RULES.md:12`, root `CLAUDE.md` "Sync".
- Local API: loopback only, off by default, never a bind-address setting, CORS or logging of tokens/bodies; tokens only as SHA-256 – `docs/RULES.md:8`; `web/src-tauri/CLAUDE.md` "Local API".
- Platform: only `core/platform/**` knows Tauri – `docs/RULES.md:14`.
- Secrets: none in the repo; API keys via `getPlatform().secrets`; bundle id never changes – `docs/RULES.md:17`.
- New Tauri command: handler in `src/lib.rs` + `build.rs` `COMMANDS` + grant in `capabilities/desktop.json` or `default.json`; `tests/commands.rs` guards all three – `web/src-tauri/CLAUDE.md` "New command".
- `docs/design/` is exempt from the docs token budget – `web/scripts/check-docs.mjs:40`.

## 2. Decisions

- LWW twice + contract; server never merges, only assigns `seq` – `docs/decisions/core.md:16`.
- `SyncAdapter` abstraction (`selfHosted` built, Google Drive stub) – `docs/decisions/core.md:17`.
- E2E bullet says "PBKDF2 → AES-GCM" – `docs/decisions/core.md:18`; **stale**: the code uses Argon2id (see §3.4). Not fixed here (out of scope, noted for the PR).
- Failed-login limit only slows wrong tokens, LAN clients behind one address must not lock each other out – `docs/decisions/core.md:48`.
- Android cleartext left allowed for plain-HTTP LAN sync – `docs/decisions/core.md:54`.
- `syncSettled()` + Web Locks – `docs/decisions/core.md:60`.
- Local API: desktop only, off by default, loopback only, transport in Rust, meaning in TS, no bind-address setting – `docs/decisions/features.md:8`.
- Extension uses native messaging instead of loopback (local API refuses `Origin`) – `docs/decisions/features.md:42`.
- Extension pairing: app shows a 6-digit code, popup shows the same code, id stored device-locally in `_meta` – `docs/decisions/features.md:47`.

## 3. Client sync (`web/src/core/sync`)

1. **Op:** `FieldOp = {collection, id, field, hlc, value}` (`value: null` = field removed) – `web/src/core/sync/types.ts:2-10`. `PullPage = {epoch, ops, cursor, more}`; `SyncAdapter.push/pull` – `types.ts:12-30`.
2. **HLC:** `"<wallMs 13>-<counter 4>-<deviceId>"`, compared as plain strings, deviceId breaks ties – `web/src/core/db/hlc.ts:1-5,30-32,40-42`; drift bound 1 h – `hlc.ts:22-28`; validation regex – `web/src/core/sync/ops.ts:12`.
3. **LWW (client):** `mergeOps()` – `ops.ts:39-77`, decision `if (current !== undefined && op.hlc <= current) continue;` – `ops.ts:55`. Contract test – `web/src/core/sync/contract.test.ts:15`.
4. **Engine:** pull first, then push; 3 retries on epoch change – `engine.ts:73-85`; pull pages of 1 000 with a server `seq` cursor, `adoptEpoch` resets cursor and marks all dirty – `engine.ts:87-132`; push reads the outbox 250 at a time, ≤ 2 000 ops / 3 MB per request – `engine.ts:34-36,134-153`.
5. **Adapter:** routes `/v1/health, push, pull, vault, info, devices(+rotate, delete), status, reset` – `web/src/core/sync/adapters/selfHosted.ts:159-245`; Bearer token, 30 s timeout, via `getPlatform().fetch` – `selfHosted.ts:21,118,130-137`; only http/https URLs – `selfHosted.ts:249-253`.
6. **Service:** in-tab promise chain + Web Lock `taschenmesser-sync`, no leader election – `service.ts:105-117`; phases `off | idle | syncing | error` – `web/src/core/sync/status.ts:4`; backoff 5 s doubling to 5 min ±20 % – `service.ts:143-149`; triggers: start, every 60 s, `online`, visible, 1.5 s after outbox changes – `service.ts:238-239,255-314`; started from `web/src/main.tsx:73`; `connect()` = health → vault → info → device registration (own revocable token) → save → sync – `service.ts:387-458`.
7. **Encryption:** AES-256-GCM per value, `enc:v1:<iv>:<ct>` – `crypto.ts:12,67-75`; AAD `collection/id/field` – `crypto.ts:63-65`; only `value` is encrypted, collection/id/field/hlc stay readable – `crypto.ts:1-6,105-109`; Argon2id m = 64 MiB, t = 3, salt 16 B – `web/src/core/crypto/kdf.ts:27,54-56,82`; vault record `{salt, check, v:2, kdf}` on the server – `vaultKey.ts:16-21`.
8. **Config storage:** `SyncConfig {kind:'selfHosted', url, token, key?, deviceId?, deviceName?}` in Dexie `_secrets` (device-local, never synced); key is a non-extractable `CryptoKey` – `service.ts:27-36`. Sync does **not** use `getPlatform().secrets` (`web/src/core/platform/types.ts:271-272`); on Tauri that store is the OS keystore with a WebCrypto fallback – `web/src/core/platform/tauri/secureStore.ts:3-4`.

## 4. Server (`server/src`)

- Fastify; routes in `server/src/app.ts`: health :177, vault :179/:181, push :218, pull :245 (limit ≤ 5 000), reset :265 (admin :279), info :285, status :292, devices :303/:309/:343/:356, Web Push :387-458, **`/v1/proxy` :491** (feed/calendar proxy), static PWA when `WEB_DIR` :540-546.
- Limits 5 000 ops/push, 1 MB/value – `app.ts:69-72`; body 8 MB – `app.ts:119`; CORS default `*` – `app.ts:137-138`; rate limit 600/min – `app.ts:144`; drift → 400 `hlc-drift` – `app.ts:236-237`.
- Auth: `onRequest` hook for `/v1/*` – `app.ts:146-175`; shared tokens from env, SHA-256 + `timingSafeEqual` – `server/src/auth.ts:3-24`; device tokens 32 B, stored as SHA-256 – `auth.ts:34-57`.
- **LWW (server):** `ON CONFLICT … DO UPDATE … WHERE excluded.hlc > field_state.hlc` – `server/src/store.ts:172-178`; contract test – `server/test/contract.test.ts:13`.
- Tables `meta, field_state (PK collection+id+field, index seq), device, push_*` – `store.ts:112-154`; WAL – `store.ts:160`. Server sees collection/id/field/hlc always, value only as ciphertext with E2E – `store.ts:10`.
- Runs as `node dist/index.js`, `HOST` default `0.0.0.0`, port 8787 – `server/src/index.ts:23,69`; Docker on `node:26-bookworm-slim` – `server/Dockerfile:6`; Node ≥ 26 – `server/package.json:7-9`; runtime deps fastify, cors, rate-limit, static, better-sqlite3, web-push – `server/package.json:21-28`.
- **Measured** (2026-11-06): `npm ci` of `server/` = 52 MB `node_modules`, `better-sqlite3` 27 MB (prebuilds for 8 platforms), `win32-x64.node` 2.0 MB; Linux `node` v22 binary 124.9 MB. Latest release v0.3.1: `Nemo-Portable.exe` 10.3 MB, `Nemo.apk` 20.6 MB (GitHub releases API).
- 1 669 lines in `server/src/*.ts` (`wc -l`).

## 5. Contract

- `contract/lww-cases.json`: `{cases:[{name, batches: FieldOp[][], expected}]}`, 10 cases – `contract/lww-cases.json:1-33`; read by `web/src/core/sync/contract.test.ts:15` and `server/test/contract.test.ts:13`. No Rust reader.

## 6. Desktop shell (`web/src-tauri`)

- Local API binds `Ipv4Addr::LOCALHOST`, "deliberately no setting" – `crates/local-api/src/server.rs:95-97`; Host check – `server.rs:330-334`; SHA-256 token check – `crates/local-api/src/auth.rs:17,42-54`; refuses `Origin`/`Sec-Fetch-Site` – `crates/local-api/src/lib.rs:1-9`; default port 47631 – `src/local_api.rs:5`; meaning in TS – `web/src/core/localapi/handler.ts:115-121`.
- `capabilities/desktop.json` covers Windows/Linux/macOS only (`:6`); local-api grants `:51-54`.
- Tray (`tray-icon` feature) – `Cargo.toml:29`, `src/capture.rs:17`; autostart plugin – `Cargo.toml:56`, `src/lib.rs:122-123`; started by autostart the main window stays hidden in the tray – `src/capture.rs:103-108`; "In den Tray minimieren statt beenden" defaults off – `web/src/quickCapture/device.ts:25`, `web/src/strings.ts:1080`; "Mit Windows starten" (`autostart`) defaults off too – `device.ts:26`.
- Already in `Cargo.lock`: `tokio` 1.53, `hyper` 1.11, `axum` 0.8, `rustls` 0.23, `ring` 0.17, `sha2` 0.10 (`grep '^name' Cargo.lock`). No mDNS/zeroconf crate anywhere.
- QR: generator `qrcode-generator` – `web/package.json:107`, `web/src/tools/qr/logic.ts:1`; scanning via the browser `BarcodeDetector` + `getUserMedia` – `web/src/tools/qr/View.tsx:13-19`, `web/src/pages/settings/ShareQr.tsx:85-88`. unsicher: `BarcodeDetector` in the Android WebView / WebView2.

## 7. Android

- `gen/` is git-ignored – `web/src-tauri/.gitignore:2`; minSdk 24 – `tauri.conf.json:39`.
- Plugins: official notification, http, dialog, fs, clipboard, opener – `Cargo.toml:30-35`; own apk-installer, secure-store, share-intent, custom-tabs, screen-mode – `Cargo.toml:36-43`. No barcode-scanner plugin.
- Only Android service: quick-settings tile `CaptureTileService`; no background/foreground sync service – `plugins/share-intent/android/src/main/AndroidManifest.xml:29-38`.

## 8. Settings page and user docs

- `SyncSection` – `web/src/pages/settings/SyncSection.tsx:29`: status banner by phase (`:99-106`), last sync/pending/server size (`:112-134`), errors (`:151-156`), "Jetzt synchronisieren" (`:163-165`), form url/token/device name/encrypt/passphrase (`:185-230`), reset (`:248-269`); `ENCRYPT_BY_DEFAULT = true` (`:27`).
- `SyncDevices` (device list, lock = revoke, rotate) – `SyncDevices.tsx:16-55`; `SyncConflicts` – `SyncConflicts.tsx:32`; shared parts – `ConnectParts.tsx`.
- Strings `sync:` – `web/src/strings.ts:3218` (intro names "eigenen Sync-Server"), states `:3258`; locales `web/src/i18n/locales/*/sync.ts`.
- User doc: server via Docker or Node, `SYNC_TOKEN`, Tailscale for HTTPS; "In the LAN without HTTPS, sync works if the app itself was opened via http://" – `docs/user/sync.md:9-61`; credentials never synced or in backups – `sync.md:88-89`.
- `design/settings-identity` is neither on `develop` nor a remote branch (2026-11-06) → the UI sketch builds on today's `ConnectParts`.

## 9. Measured with the prototype

See CONCEPT.md §9 (`node docs/design/sync-lan/proto/run.mjs`).

## 10. External sources (checked 2026-11-06)

- crates.io API: `mdns-sd` 0.21.7 (Apache-2.0 OR MIT), `snow` 0.10.0 (Apache-2.0 OR MIT), `libmdns` 0.10.1 (MIT), `rustls` 0.23.46, `rcgen` 0.14.10, `tauri-plugin-barcode-scanner` 2.5.3 (Apache-2.0 OR MIT), `if-watch` 3.2.2.
- Noise spec rev. 34 (noiseprotocol.org): handshake patterns §7, PSK §9. RFC 6762 §6 (mDNS response delay), RFC 6598 (`100.64.0.0/10`).
- Android: `NsdManager`, `WifiManager.MulticastLock`, `ConnectivityManager.NetworkCallback`, WorkManager (developer.android.com, links in CONCEPT). Not tried on a device.
