# Verbindungsprotokoll and "Netzwerk sperren" (draft, phase 1)

Findings B21/V21 (`docs/qa/CONSOLIDATED.md`, Tom's report). Goal: the privacy text ("nothing without your click") is checkable in the app, without Wireshark. Draft only; nothing built until "Plan freigegeben".

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

## Design
- **Hook:** wrap `fetch` once inside `createWebPlatform` and `createTauriPlatform`; weather and SyncSection switch to `getPlatform().fetch`. Rust-side calls (download, updater) report via one small Tauri event or are listed as "native, not logged" in the screen (honest > complete).
- **Entry:** `{ at, host, reason, bytes, status }`. Host only (no path, query, token); `reason` is a fixed enum set by the caller via an optional `{ reason }` argument (`update`, `sync`, `weather`, `currency`, `calendar`, `ai`, `probe`, …), default `other`. Bytes = request + response size, never content.
- **Storage:** in-memory ring buffer (last 200) for the session, optional persisted ring in device-local `_meta` (`net.log`, never synced, not in backups, excluded from diagnostics). Cleared by "Gerät zurücksetzen" and a "Verlauf löschen" button.
- **Screen:** Settings → Verbindungen → "Was ging wohin?" grouped by host/reason, calm wording (FOCUS-GUIDELINES), plain language, a one-line summary at top ("Seit dem Start: 3 Verbindungen, keine mit deinen Daten").
- **Netzwerk sperren:** device-local switch (`_meta` `net.block`). The wrapper rejects with a typed `blocked` error (fast, no request); sync/connectors/update show "gesperrt" instead of "nicht erreichbar". Exceptions: none, localhost included, but the switch itself and the log stay usable offline. Web build: Service Worker keeps the app working offline as today.
- **Tests:** `netlog.test.ts` (host only, no query/token/body in entries), e2e "nothing without click" (fresh app + setup wizard + settings open, assert external **and** localhost requests are only the listed ones), negative-list test of diagnostics extended to prove the log is not exported.
- **Rules touched:** none weakened. Diagnostics negative list gains `net.log`. No change in `core/sync/**` logic; only the platform fetch is wrapped (the sync adapter keeps using `getPlatform().fetch`).
- **Probe fix:** Ollama detection only after a click ("Nach lokaler KI suchen") and mentioned in the legal text.

## Open
See questions in the phase-1 report (persisted vs session-only, probe, block scope).
