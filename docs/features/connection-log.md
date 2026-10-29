# Verbindungsprotokoll and "Netzwerk sperren"

Findings B21/V21 (`docs/qa/CONSOLIDATED.md`, Tom's report). Goal: the privacy text ("nothing without your click") is checkable in the app, without Wireshark. Built in package 2 of QA P6 (`feat/qa-connection-log`); the sections below keep the inventory and the reasons.

## Network inventory (develop, all paths under `web/`)
Almost everything goes through `getPlatform().fetch` (`core/platform/web.ts:153`, `tauri/index.ts:142`).

| What | Destination | Trigger | Gate | Sends |
|---|---|---|---|---|
| Ollama probe (`core/ai/detectOllama.ts`, `AiStep.tsx:49`) | `localhost:11434` | setup AI step on mount, **no click** | none | nothing |
| AI provider (`core/ai/providers/*`) | user's provider | AI question / write | provider set up + consent | question, schema (no user data) |
| Update check (`core/update/controller.ts`) | api.github.com, github.com | native start, then daily | `prefs.auto`; web: none | nothing |
| Sync (`core/sync/service.ts`) | user's server | start, 60 s, online, after writes | sync configured | encrypted ops |
| Push (`core/notifications/push.ts`) | user's server, browser push service | start, schedule | sync + push on | reminder schedule |
| Connector loop (`core/connectors/service.ts`) | googleapis, spotify | 5 s after start, every 5 min | connector connected | auth only (calendar read-only) |
| ICS subscription (`connectors/ics/sync.ts`) | user's ICS URL (web: via `<server>/v1/proxy`) | add click, then connector loop | subscription added | secret ICS URL |
| Weather (`core/weather/api.ts`) | open-meteo.com | search typing; forecast on home mount | `enabled && place` | place name, lat/lon |
| Currency (`tools/currency/Tool.tsx`) | api.frankfurter.dev | opening the tool | none (named exception in legal text) | nothing |
| Public IP (`modules/disk/.../PublicIp.tsx`) | api.ipify.org | click | click | nothing |
| Settings → Sync (`pages/settings/SyncSection.tsx:51`) | own origin `/v1/health` | open section (web) | none | nothing |
| Local model download (`src-tauri/crates/local-llm`) | allow-listed HTTPS host | click | click | nothing |
| Updater plugin (Rust) | github.com `latest.json` | native, daily | `prefs.auto` | nothing |

No `<img>/<script>/<link>` to foreign hosts, no beacon/XHR/WebSocket/EventSource. CSP (native): `connect-src https: http:` and the HTTP plugin scope are wide open, so they do not enforce anything; `web/index.html` has no CSP.

## Gaps found
- Not "click first": Ollama probe (localhost, unannounced), weather forecast and update check (gated by setting, but start themselves), `/v1/health`.
- Bypass `platform.fetch`: `core/weather/api.ts` (bare `fetch`), `SyncSection.tsx:51`, `core/net/fetchPublic.ts:97`. Outside any JS hook: `pushManager.subscribe`, Rust download, Rust updater.
- No app-wide e2e "nothing without click"; existing listener tests exclude `localhost`, so the probe is invisible to them.
- ICS "Wird geprüft …" (B26): `requireNotice` can wait forever, `fetchPublic` has no timeout, `normalizeIcsUrl` accepts any http(s) host (localhost, LAN, metadata IP) while the error names only https/webcal.

## As built
- `web/src/core/net/netlog.ts`: `loggedFetch` wraps `fetch` inside `createWebPlatform` and `createTauriPlatform`; entry = time, host(+port), reason (derived from host/path in `describeRequest`, no caller change), request bytes, answer bytes when named, status. Never path, query, headers, body.
- Memory ring (200) per session; "Liste auf diesem Gerät behalten" keeps it in `localStorage` `tm-net-log` (device-local, not in Dexie, backups, sync or diagnostics; test in `diagnostics.test.ts`). `tm-net-block` is the switch.
- "Netzwerk sperren": `loggedFetch` throws `NetBlockedError` (a `TypeError`) before sending, localhost included. Rust-made requests (updater, Android APK download, model download) call `assertNetworkAllowed` first: blocked, or listed as "von der App selbst, Größe unbekannt". Not covered: `pushManager.subscribe` (browser), tauri-plugin-updater internals after the check.
- Moved onto `platform.fetch` so they appear: weather, calendar proxy call in `fetchPublic`, `/v1/health` in `SyncSection`.
- UI: Settings → Verbindungen → "Was ging wohin?" (`pages/settings/NetworkSection.tsx`, texts `strings.netlog.ts`).
- Tests: `netlog.test.ts`, `e2e/network.spec.ts` (tour with zero external requests incl. localhost; block + log flow).
- Ollama probe: already click-only since #276.

## Decided (Sven, phase 1)
- Log: session memory by default, optional "Protokoll auf dem Gerät behalten".
- Ollama probe: only after a click (done in #276).
- Netzwerk sperren: all outgoing requests incl. localhost, Rust parts blocked where possible, otherwise shown as "nicht erfasst".
- Partner share: file/QR + pairing code, packages P1–P4 (see partner-share.md).
