# Sync in the home network – packages (prompts)

Decisions: [CONCEPT.md](CONCEPT.md) §10 (vorläufig) and [`docs/decisions/core.md`](../../decisions/core.md) "Sync". One package = one chat, one branch, one PR against `develop`; order 1 → 2 → 3 → 4. **Package 1 starts only after Sven has answered CONCEPT §11** – if he picks a variant other than (b), these prompts are rewritten first (one docs PR), not adapted on the fly.

| # | Package | Branch | Scope | Hotspots to announce | Skills |
|---|---|---|---|---|---|
| 1 | Contracts and rules: protocol contract, Rust store with LWW, rule lines | `feat/lan-sync-contract` | `contract/protocol-cases.json` (new), `server/test/protocol.test.ts`, new crate `web/src-tauri/crates/lan-sync` (store only), its contract tests, root `CLAUDE.md` + `docs/RULES.md` (two lines) | root `CLAUDE.md`, `contract/`, `web/src-tauri/Cargo.toml`/`Cargo.lock` | `council` |
| 2 | Hub: Noise transport, mDNS, pairing window, trust list, desktop commands | `feat/lan-sync-hub` | `crates/lan-sync/{noise,discovery,hub,pairing}`, `src/lan_sync.rs`, `build.rs` `COMMANDS`, `capabilities/desktop.json`, `tests/commands.rs` | `Cargo.toml`/`Cargo.lock`, `capabilities/*` | `council` |
| 3 | Client: `SyncAdapter` `lan`, platform seam, in-process PC adapter, first sync | `feat/lan-sync-client` | `core/sync/adapters/lan.ts`, `core/sync/service.ts` (adapter choice only), `core/platform/{types,web}.ts` + `tauri/lanSync.ts`, `crates/lan-sync/client`, e2e with two app instances against one hub | `core/platform/types.ts`, `core/platform/tauri/index.ts`, `core/sync/service.ts` | `council` |
| 4 | UI, QR, Android: settings page, pairing flow, Wi-Fi trigger, docs | `feat/lan-sync-ui` | `pages/settings/Sync*.tsx`, strings `sync` (+4 locales), `tauri-plugin-barcode-scanner`, own plugin `plugins/lan-watch` (Kotlin: Wi-Fi callback, multicast lock / `NsdManager`), `docs/user/sync(.de).md`, MANUAL-TESTS rows | `strings.ts`, `pages/Settings.tsx`, `Cargo.toml`, `web/package.json` | `review loop` |

Each package: own branch from fresh `develop`, row in CHATS.md, `.changes/` note (DE/EN, user view) where user-visible (1–3: label `no-changelog` unless something becomes visible), STATUS one line, decision bullets in `docs/decisions/core.md` "Sync". Not planned: real Android background sync (WorkManager) – only if Sven chooses it in CONCEPT §11 question 3, then as package 5 with its own concept step.

### Prompt – package 1: contracts and rules (`feat/lan-sync-contract`)

```
# Aufgabe: Sync im Heimnetz – Protokoll-Vertrag, Rust-Store mit LWW, Regelzeilen (Paket 1 von 4)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-contract` von frischem `develop`. **Erst starten, wenn Sven die Fragen in docs/design/sync-lan/CONCEPT.md §11 beantwortet hat und Variante (b) gilt** – sonst STOPP und melden. Vorher Zeilen in docs/CHATS.md „Hotspots“: root `CLAUDE.md`, `contract/`, `web/src-tauri/Cargo.toml`.

## Ausgangslage
Konzept: docs/design/sync-lan/CONCEPT.md (§3 Variante b, §5 Regel-Vorschläge, §10), Belege docs/design/sync-lan/NOTES.md. Lies `contract/lww-cases.json`, `web/src/core/sync/contract.test.ts`, `server/test/contract.test.ts`, `server/src/store.ts` (Tabellen :112-154, LWW :172-178), `server/src/app.ts` (Routen push/pull/info/status/devices), `web/src/core/sync/adapters/selfHosted.ts`, web/src-tauri/CLAUDE.md.

## Pflichtliste
- `contract/protocol-cases.json`: Folgen von Anfrage → erwarteter Antwort für die Sync-Nachrichten `info, push, pull (Seiten, cursor, more), devices (list, register, revoke), status` – transportneutral (JSON-Nachrichten, keine HTTP-Details); Fehlerfälle `hlc-drift`, Grenze 5 000 Ops, widerrufenes Gerät. Kein Web Push, kein Proxy, kein Reset im LAN-Vertrag.
- `server/test/protocol.test.ts`: der Node-Server besteht den Vertrag über einen dünnen Übersetzer Nachricht → Route (Server-Code unverändert).
- Neue Crate `web/src-tauri/crates/lan-sync` (nur `store`): SQLite (`rusqlite` gebündelt, eigene Commit für die Abhängigkeit), Tabellen wie `server/src/store.ts`, LWW als dieselbe SQL-Bedingung; `cargo test` liest `../../../contract/lww-cases.json` (alle 10 Fälle) und `protocol-cases.json` (Store-Teil). In die `-p`-Liste in web/src-tauri/CLAUDE.md und CI aufnehmen.
- Regeln (Svens Ja vorausgesetzt): neue Zeile „LAN sync (desktop hub)“ wörtlich wie CONCEPT §5 in root `CLAUDE.md` + Volltext in `docs/RULES.md`; Sync-Regel auf „drei Kopien … alle gepinnt“; Local-API-Regel bleibt Wort für Wort.
- Bundle-Messung: Größe des Release-Builds vorher/nachher (`cargo build --release`, Linux; Windows-exe im PR als offen markieren, falls nicht messbar).

## Nicht in diesem Paket
Netzwerk, Noise, mDNS, Tauri-Befehle, TS-Adapter, UI. Kein Eingriff in `core/sync/ops.ts` oder `server/src/store.ts`.

## Abnahme
- `cargo fmt --check`, `clippy -D warnings`, `cargo test -p taschenmesser-lan-sync` grün; `cd server && npm test`; `cd web && npm run check && npm test` (contract-Test unverändert grün); `npm run check:docs`.
- Docs: `docs/decisions/core.md` „Sync“ – die vorläufigen Bullets aus dem Konzept werden endgültig (Variante, dritte Kopie, Protokoll-Vertrag); STATUS eine Zeile; ARCHITECTURE-MAP eine Zeile (`crates/lan-sync`).

## Skills
`council` über den Diff (Guardian: Regeltexte, nichts an Local API/Secrets geschwächt, Vertrag deckt Widerruf und Grenzen; Architect: LWW-Kopie identisch zu SQL im Server, Vertrag transportneutral, keine doppelte Wahrheit; Advocate: Lesbarkeit der Regelzeile für spätere Chats). Full stop.
```

### Prompt – package 2: hub (`feat/lan-sync-hub`)

```
# Aufgabe: Sync im Heimnetz – Hub im PC: Noise, mDNS, Kopplungsfenster, Vertrauensliste (Paket 2 von 4)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-hub` von frischem `develop`, erst nach Merge von Paket 1. Hotspot-Zeilen in docs/CHATS.md: `web/src-tauri/Cargo.toml`, `capabilities/*`.

## Ausgangslage
CONCEPT §4 (Entdeckung, QR, Schlüsseltausch, nur private Adressen), §5 (Bedrohungen, Noise), Prototyp docs/design/sync-lan/proto/ (Ablauf und Prüfungen `reusedQrRefused`, `strangerRefused`, `wrongHubRefused` sind die Vorlage für Rust-Tests). Neue Hard Rule „LAN sync (desktop hub)“ aus Paket 1 gilt.

## Pflichtliste
- `crates/lan-sync/noise`: `snow` (eigener Commit), `XXpsk3` für Kopplung, `XX` danach; statischer X25519-Schlüssel pro Gerät; Fingerprint = SHA-256 des statischen Schlüssels.
- `crates/lan-sync/discovery`: `mdns-sd`; Dienst `_nemo-sync._tcp.local`, zufälliger Instanzname, TXT `v=1`, `fp=<8 Byte hex>`; Ankündigung nur auf privaten Schnittstellen.
- `crates/lan-sync/hub`: bindet nur RFC-1918-/Link-local-Adressen der Schnittstellen (nie `0.0.0.0`, nie Loopback, keine Adress-Einstellung), verwirft andere Peers vor dem Handshake, Handshake-Rate-Limit pro Adresse, Nachrichten nach `contract/protocol-cases.json`, kein Logging von Nutzdaten, Schlüsseln, Kopplungsgeheimnissen.
- Kopplungsfenster: Einmalgeheimnis 16 Byte, 2 min, beim ersten Handshake verbraucht; QR-Nutzlast `NEMO1:` (Format CONCEPT §4, Test auf Länge und Inhalt: kein Langzeit-Geheimnis); Bestätigung „<Gerätename> koppeln?“ als Ereignis an die Oberfläche, ohne Bestätigung keine Aufnahme in die Vertrauensliste; Datenschlüssel nur im Kanal, nur nach Bestätigung.
- Tauri-Befehle (desktop): `lan_hub_start/stop/status`, `lan_pair_open/confirm/cancel`, `lan_devices/revoke`, In-Prozess `lan_hub_push/pull` für die eigene WebView – je Handler in `src/lib.rs` + `build.rs` `COMMANDS` + `capabilities/desktop.json`; `tests/commands.rs` grün.
- Hub aus, bis zur ersten Kopplung; startet mit der App, wenn mindestens ein Gerät gekoppelt ist.

## Nicht in diesem Paket
TS-Adapter, Einstellungsseite, Android, Client-Seite des Handshakes außer in Tests. Keine Änderung an `crates/local-api`.

## Abnahme
- Rust-Checks aus web/src-tauri/CLAUDE.md inkl. neuer Crate; Tests: falsches PSK, wiederverwendeter QR, fremder Schlüssel, falscher Hub-Fingerprint, öffentliche Peer-Adresse, widerrufenes Gerät – alle abgewiesen; 1 000 Ops push/pull über echten Socket auf 127.0.0.2 o. ä. nur im Test (Testschalter, nicht im Produkt erreichbar).
- `cargo check --target x86_64-pc-windows-msvc -p taschenmesser-lan-sync`; Bundle-Größe vorher/nachher.
- Docs: decisions core.md „Sync“ (Fenster, Bestätigung, Bindung), `docs/architecture/desktop.md` Abschnitt, STATUS eine Zeile.

## Skills
`council` (Guardian: Angriffsfläche, Bindung, QR-Inhalt, Logging, Rate-Limit, Hard-Rule-Text gegen Code; Architect: Crate-Grenzen, Vertrag erfüllt, keine zweite Meinung zur LWW; Advocate: Bestätigungsfrage verständlich, Ruhe bei Fehlversuchen). Full stop.
```

### Prompt – package 3: client (`feat/lan-sync-client`)

```
# Aufgabe: Sync im Heimnetz – Client: SyncAdapter `lan`, Plattformnaht, erster Abgleich (Paket 3 von 4)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-client` von frischem `develop`, erst nach Merge von Paket 2. Hotspot-Zeilen: Plattformnaht (`core/platform/types.ts`, `core/platform/tauri/index.ts`, `core/platform/web.ts`; ein Chat), `core/sync/service.ts`.

## Ausgangslage
CONCEPT §3 (Form von b), §6, §7; `web/src/core/sync/{types,engine,service}.ts`, `adapters/selfHosted.ts` (Abbildung der Routen), `vaultKey.ts`/`crypto.ts` (Werte bleiben `enc:v1:`).

## Pflichtliste
- `getPlatform().lanSync` (optional, nur Tauri): `pair(qr)`, `request(msg)`, `status()`; Web/PWA: `undefined` (PWA bleibt beim Server-Weg).
- `core/sync/adapters/lan.ts`: `SyncAdapter` über `lanSync.request`, gleiche Seitengrößen und Fehlercodes wie `selfHosted` (`network` = „PC nicht erreichbar“, kein neuer Fehlerzustand mit Rot); am Hub-PC In-Prozess-Variante über `lan_hub_push/pull`.
- `SyncConfig` bekommt `kind: 'lan'` (Hub-Fingerprint, Gerätename, Schlüssel als nicht-extrahierbarer `CryptoKey` wie heute); Datenschlüssel am Hub in `getPlatform().secrets`; nie synchronisiert, nie im Backup (Test).
- Ein Weg pro Gerät: Wechsel Server ↔ LAN nur über Trennen; erster LAN-Abgleich `markAllDirty`.
- `crates/lan-sync/client` für Android und zweiten PC (Noise-Initiator, Pinning, mDNS-Suche mit Adress-Hinweis als Rückfall).
- E2E: zwei App-Instanzen (Playwright, Tauri-Mock oder Test-Hub-Binary) koppeln, Änderung auf A erscheint auf B, Konflikt nach Feld-LWW, PC aus → Status ruhig, Outbox wächst.

## Nicht in diesem Paket
Einstellungs-UI über eine Test-Schaltfläche hinaus, Android-Plugin, Hintergrund-Abgleich, Tailscale.

## Abnahme
- `npm run check`, `test`, `e2e` (inkl. `e2e:sync` unverändert grün), Rust-Checks; `exclusion.test.ts`/`privacy.test.ts` unverändert; Test „Schlüssel und Kopplungsdaten nie in Backup/Diagnose“.
- Docs: decisions core.md „Sync“, ARCHITECTURE-MAP Zeile, STATUS eine Zeile.

## Skills
`council` (Guardian: Schlüsselablage, Backup/Diagnose-Ausschluss, Plattformregel; Architect: Adapter-Grenze, eine Engine, Epoch/Cursor, keine LWW außerhalb `mergeOps`; Advocate: Verhalten bei Nichterreichbarkeit, keine Fehlerflut). Full stop.
```

### Prompt – package 4: UI, QR, Android (`feat/lan-sync-ui`)

```
# Aufgabe: Sync im Heimnetz – Einstellungsseite, Koppeln per QR, Android-WLAN-Auslöser, Doku (Paket 4 von 4)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-ui` von frischem `develop`, erst nach Merge von Paket 3. Hotspot-Zeilen: `strings.ts` (nur Block `sync`), `web/package.json`, `web/src-tauri/Cargo.toml`.

## Ausgangslage
CONCEPT §2 (Nutzungsbild, drei Schritte ohne Tippen), §6 (Android), §8 (UI-Skizze, Fokus-Regeln); `pages/settings/{SyncSection,SyncDevices,ConnectParts}.tsx`; docs/design/FOCUS-GUIDELINES.md, FOCUS-WORDING.md.

## Pflichtliste
- Sync-Seite nach CONCEPT §8: Banner (Abgeglichen / PC nicht erreichbar / Wartet aufs Heimnetz – grau, nie Rot ohne echten Fehler), Fakten, „Jetzt abgleichen“, Geräteliste mit „Kopplung lösen“ und einmaligem Hinweis nach 90 Tagen, „Gerät koppeln“ (QR groß, Restzeit, „Kopplungsdatei speichern“, Bestätigungsfrage), Schalter „Nemo im Tray weiterlaufen lassen“ vorausgewählt beim Koppeln; „Eigener Server (erweitert)“ eingeklappt.
- Handy: „Mit PC koppeln“ → `tauri-plugin-barcode-scanner` (eigener Commit); Rechte nur Kamera.
- Eigenes Plugin `plugins/lan-watch` (Kotlin): `NetworkCallback` für WLAN → Ereignis → `syncNow()`; Multicast-Lock bzw. `NsdManager` für die Suche; keine Standort-Berechtigung, keine SSID.
- Texte de/en (Vorschläge): „Mit PC koppeln / Pair with PC“, „Gerät koppeln / Pair a device“, „Gilt noch {m}:{ss} / Valid for {m}:{ss}“, „{name} koppeln? / Pair {name}?“, „Abgeglichen · {when} / Synced · {when}“, „PC nicht erreichbar · zuletzt {when} / PC not reachable · last {when}“, „Wartet aufs Heimnetz · {n} Änderungen / Waiting for home network · {n} changes“, „Kopplung lösen / Unpair“, „Nemo im Tray weiterlaufen lassen, damit dein Handy abgleichen kann / Keep Nemo running in the tray so your phone can sync“; alle fünf Sprachen über `check:i18n`.
- Umstieg Server → LAN: Dialog mit Pflicht-Backup zuerst, dann Trennen, dann Koppeln (CONCEPT §7).
- Doku: `docs/user/sync.md` + `.de.md` neuer erster Abschnitt „Im Heimnetz mit dem PC“; Server-Abschnitt bleibt; MANUAL-TESTS: Koppeln, Handy kommt heim, PC aus, Gäste-WLAN, Kopplung lösen; Messung Entdeckung/erster Abgleich auf echtem Handy in die Tabelle CONCEPT §9 nachtragen.

## Nicht in diesem Paket
Hintergrund-Abgleich (WorkManager), Tailscale, Änderungen an Protokoll oder Crate außer Fehlerbehebungen.

## Abnahme
- `npm run check`, `test`, `e2e`, `check:i18n`, `check:readme`; a11y für die Sync-Seite; 412 px ohne Überlauf; Fokus-Checkliste (FOCUS-GUIDELINES 1–9) im PR-Text; Klickzahl Koppeln ≤ 3 ohne Tippen.
- `.changes/`-Notiz (DE/EN): „Handy und PC gleichen sich im Heimnetz ab – koppeln per QR-Code, kein eigener Server nötig.“

## Skills
`review loop` über den Diff. Full stop.
```
