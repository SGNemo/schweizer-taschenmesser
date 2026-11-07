# Sync in the home network – packages (prompts)

Decisions: [CONCEPT.md](CONCEPT.md) §10 (vorläufig) and [`docs/decisions/core.md`](../../decisions/core.md) "Sync". One package = one chat, one branch, one PR against `develop`; order 1 → 2a → 2b → 3 → 4 (2a may start in parallel with 1; Fable F2). **Package 1 starts only after Sven has answered CONCEPT §11** (answered 2026-11-07: variant b and all other recommendations; the Fable check is done, [REVIEW-FABLE.md](REVIEW-FABLE.md); **Frage 5 (b vs b′) is still open**) – if he picks a variant other than (b), these prompts are rewritten first (one docs PR), not adapted on the fly.

| # | Package | Branch | Scope | Hotspots to announce | Skills |
|---|---|---|---|---|---|
| 1 | Contracts and Sync rule: paging contract, Rust store with LWW, Sync rule line | `feat/lan-sync-contract` | `contract/sync-paging-cases.json` (new), `server/test/paging.test.ts`, new crate `web/src-tauri/crates/lan-sync` (store only), its contract tests, Sync rule line in root `CLAUDE.md` + `docs/RULES.md` | root `CLAUDE.md`, `contract/`, `web/src-tauri/Cargo.toml`/`Cargo.lock` | `council` |
| 2a | Crypto and pairing, pure crate: Noise transport, pairing window, trust list (no Tauri, no network binding) | `feat/lan-sync-noise` | `crates/lan-sync/{noise,pairing,trust}`, loopback tests only (`#[cfg(test)]`), rule lines (root `CLAUDE.md` + `docs/RULES.md`); may run in parallel with package 1 (separate files) | root `CLAUDE.md`, `web/src-tauri/Cargo.toml`/`Cargo.lock` | `council` |
| 2b | Hub: discovery, home-network binding, keystore, rotation, desktop commands, firewall | `feat/lan-sync-hub` | `crates/lan-sync/{discovery,hub}`, `src/lan_sync.rs`, `build.rs` `COMMANDS`, `capabilities/desktop.json`, `tests/commands.rs` | `Cargo.toml`/`Cargo.lock`, `capabilities/*` | `council` |
| 3 | Client: `SyncAdapter` `lan`, platform seam, hub-local dispatch, first sync | `feat/lan-sync-client` | `core/sync/adapters/lan.ts`, `core/sync/service.ts` (adapter choice only), `core/platform/{types,web}.ts` + `tauri/lanSync.ts`, `crates/lan-sync/client`, client commands (`src/lib.rs`, `build.rs` `COMMANDS`, `capabilities/default.json`, `tests/commands.rs`), Rust integration test (two clients, one in-process hub) | `core/platform/types.ts`, `core/platform/tauri/index.ts`, `core/sync/service.ts`, `capabilities/*`, `web/src-tauri/Cargo.toml`/`Cargo.lock` | `council` |
| 4 | UI, QR, Android: settings page, pairing flow, Wi-Fi trigger, docs | `feat/lan-sync-ui` | `pages/settings/Sync*.tsx`, strings `sync` (+4 locales), `tauri-plugin-barcode-scanner`, own plugin `plugins/lan-watch` (Kotlin: Wi-Fi callback, multicast lock / `NsdManager`), `docs/user/sync(.de).md`, MANUAL-TESTS rows | `strings.ts`, `pages/Settings.tsx`, `Cargo.toml`, `web/package.json` | `review loop` |

Each package: own branch from fresh `develop`, row in CHATS.md, `.changes/` note (DE/EN, user view) where user-visible (1–3: label `no-changelog` unless something becomes visible), STATUS one line, decision bullets in `docs/decisions/core.md` "Sync". Not planned: real Android background sync (WorkManager, Rust queue; sketch in CONCEPT §6) – only if Sven chooses it in CONCEPT §11 question 3, then as package 5 with its own concept step.

### Prompt – package 1: contracts and rules (`feat/lan-sync-contract`)

```
# Aufgabe: Sync im Heimnetz – Seiten-Vertrag, Rust-Store mit LWW, Regelzeilen (Paket 1 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-contract` von frischem `develop`. **Erst starten, wenn Sven auch Frage 5 in docs/design/sync-lan/CONCEPT.md §11 beantwortet hat (F1).** Gilt (b′) statt (b), wird dieses Paket vorher in einem Docs-PR umgeschrieben (nur `seq`-Log-Store ohne LWW, Sync-Regel bleibt „zweimal“) – sonst STOPP und melden. Vorher Zeilen in docs/CHATS.md „Hotspots“: root `CLAUDE.md`, `contract/`, `web/src-tauri/Cargo.toml`.

## Ausgangslage
Konzept: docs/design/sync-lan/CONCEPT.md (§3 Variante b, §5 Sync-Regel, §10), Belege docs/design/sync-lan/NOTES.md. Lies `contract/lww-cases.json`, `web/src/core/sync/contract.test.ts`, `server/test/contract.test.ts`, `server/src/store.ts` (Tabellen :112-154, LWW :172-178), `server/src/app.ts` (Routen push/pull/info/status/devices), `web/src/core/sync/adapters/selfHosted.ts`, web/src-tauri/CLAUDE.md.

## Pflichtliste
- `contract/sync-paging-cases.json`: jeder Fall mit Ebene `store` oder `handler`; Paket 1 prüft in Rust nur die `store`-Fälle, Paket 2b die `handler`-Fälle im Hub-Test. Inhalt: nur was die Engine (`core/sync/engine.ts`) von einem Store annimmt – Push liefert `epoch`; Pull-Seiten mit `cursor`/`more`, Grenze je Seite, Reihenfolge nach `seq`; Epoch-Wechsel; Fehlercodes `hlc-drift` und Ops-Grenze. Keine Geräteverwaltung (die bleibt je Transport: Token am Server, Kopplung am Hub), kein Web Push, kein Proxy, kein Reset.
- `server/test/paging.test.ts`: der Node-Server besteht den Vertrag über `buildApp` + `inject` (Epoch, `hlc-drift` und Ops-Grenze liegen in `app.ts`, nicht in `store.ts`; Server-Code unverändert).
- Neue Crate `web/src-tauri/crates/lan-sync` (nur `store`): SQLite (`rusqlite` gebündelt, eigener Commit für die Abhängigkeit), Tabellen wie `server/src/store.ts`, LWW als dieselbe SQL-Bedingung (HLC-Vergleich nur als Byte-Vergleich fester ASCII-Breite, SQLite BINARY bzw. `Ord` auf `&str` – nie über einen geparsten Zeitstempel „optimieren“, `hlc.ts:1-5,40-42`, F13); wertneutral wie `store.ts` (die `enc:v1:`-Prüfung gehört in den Push-Handler, Paket 2b); `reset()` leert den Store und setzt eine neue Epoch wie `server/src/store.ts:219-222`; `cargo test` liest `concat!(env!("CARGO_MANIFEST_DIR"), "/../../../../contract/lww-cases.json")` (alle 10 Fälle; vier Ebenen bis zur Repo-Wurzel) und ebenso die `store`-Fälle aus `sync-paging-cases.json`. In die `-p`-Liste in web/src-tauri/CLAUDE.md und CI aufnehmen.
- Regel: nur die Sync-Regel in root `CLAUDE.md` + `docs/RULES.md` auf „drei Kopien … alle gepinnt“ (nur bei Variante (b), CONCEPT §5); die Zeile „LAN sync (desktop hub)“ kommt erst mit Paket 2a, wenn der Code existiert (F5); Local-API-Regel bleibt Wort für Wort.
- Bundle-Messung: Größe des Release-Builds vorher/nachher (`cargo build --release`, Linux; Windows-exe im PR als offen markieren, falls nicht messbar).

## Nicht in diesem Paket
Netzwerk, Noise, mDNS, Tauri-Befehle, TS-Adapter, UI. Kein Eingriff in `core/sync/ops.ts` oder `server/src/store.ts`.

## Abnahme
- `cargo fmt --check`, `clippy -D warnings`, `cargo test -p taschenmesser-lan-sync` grün; `cd server && npm test`; `cd web && npm run check && npm test` (contract-Test unverändert grün); `npm run check:docs`.
- Docs: `docs/decisions/core.md` „Sync“ – die vorläufige Bullet aus dem Konzept wird endgültig (Variante, dritte Kopie, Seiten-Vertrag); STATUS eine Zeile; ARCHITECTURE-MAP eine Zeile (`crates/lan-sync`).

## Skills
`council` über den Diff (Guardian: Regeltext, nichts an Local API/Secrets geschwächt, Vertrag deckt Widerruf und Grenzen; Architect: LWW-Kopie identisch zu SQL im Server, Seiten-Vertrag deckt genau die Annahmen der Engine, keine doppelte Wahrheit; Advocate: Lesbarkeit der Regelzeile für spätere Chats). Full stop.
```

### Prompt – package 2a: Noise, pairing, trust list (`feat/lan-sync-noise`)

```
# Aufgabe: Sync im Heimnetz – Crate-Kern: Noise, Kopplungsfenster, Vertrauensliste (Paket 2a von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-noise` von frischem `develop`. Darf parallel zu Paket 1 laufen, solange beide nicht dieselben Dateien anfassen (Paket 1: `store`; hier: `noise`, `pairing`, `trust`; `Cargo.toml` der Crate zuerst abstimmen). Hotspot-Zeilen in docs/CHATS.md: `web/src-tauri/Cargo.toml`.

## Ausgangslage
CONCEPT §4 (QR, Schlüsseltausch), §5 (Bedrohungen, Noise), Prototyp docs/design/sync-lan/proto/ (IK-Form; Prüfungen `windowSurvivedStranger`, `oldQrHolderCannotBurn`, `sasMatch`, `keyAfterConfirm`, `reusedQrRefused`, `strangerRefused`, `impostorRefused` sind die Vorlage für Rust-Tests; der Prototyp lässt das genaue Noise-Nachrichtenformat weg).

## Pflichtliste
- Regelzeile (Svens Ja vorausgesetzt, CONCEPT §5): Kurzform „LAN sync (desktop hub)“ in root `CLAUDE.md` (Hotspot, **eigener Commit**, nur diese Zeile) + Volltext in `docs/RULES.md`; Local-API-Regel bleibt Wort für Wort; die Zeile nennt nie den Port/Listener der Local API und nie Android.
- **Reine Crate:** kein Tauri, kein Netz-Binding, keine mDNS; Tests laufen über In-Memory-Kanäle bzw. Loopback unter `#[cfg(test)]`.
- `crates/lan-sync/noise`: `snow` (eigener Commit), `IKpsk1` für Kopplung, `IK` danach (der Hub sendet seinen statischen Schlüssel nie, CONCEPT §4); statischer X25519-Schlüssel pro Gerät (Speicherung = Paket 2b, hier ein Trait); Nachricht 1 auf Länge und Modus prüfen; Rahmen-Grenze anheben und `lastSeenAt` schreiben erst nach dem ersten entschlüsselten Transport-Rahmen (`hello`).
- `crates/lan-sync/pairing`: Einmalgeheimnis 16 Byte, 2 min, still erneuert solange der Dialog offen ist; verbraucht erst, wenn Nachricht 1 das **aktuelle** Geheimnis beweist; nicht beweisbare Versuche werden ohne Antwort verworfen; kommt nach 10 s kein `hello`, neuer QR; Gerätename im `hello` ≤ 64 Byte UTF-8, als reiner Text angezeigt (Tests: Fremder ohne Hub-Schlüssel und Halter des Hub-Schlüssels mit altem Geheimnis bzw. wiederholte Nachricht 1 eines früheren Fensters verbrauchen es nicht; zwei gleichzeitige Versuche, nur einer kommt durch); QR-Nutzlast `NEMO1:` mit statischem Hub-Schlüssel, keine Code-Form (Format CONCEPT §4, Test: kein Langzeit-Geheimnis); 6-stelliger Code aus dem Handshake; Bestätigung „<Gerätename> koppeln? Code …“ als Ereignis nach außen, gebunden an (Versuch, Code, Schlüssel); Kopplung mit einem widerrufenen statischen Schlüssel abweisen; `hello` mit Namen > 64 Byte oder ungültigem UTF-8 abweisen; ohne Bestätigung keine Aufnahme in die Vertrauensliste; „Neu koppeln“ am Gerät erzeugt immer einen neuen statischen Schlüssel (ein widerrufener wird nie wieder vertraut); Datenschlüssel nur im Kanal, nur nach Bestätigung.
- `crates/lan-sync/trust`: Vertrauensliste `device {id, name, staticKey, pairedAt, lastSeenAt, revokedAt}` hinter einem Trait (Speicherung in Paket 2b); `unknown-device` nur verschlüsselt (authentisiert) senden; authentisierte Anfrage `unpair` vom Gerät selbst → `revokedAt`; kein Logging von Nutzdaten, Schlüsseln, Kopplungsgeheimnissen, auch nicht des statischen Schlüssels eines abgewiesenen Versuchers.

## Nicht in diesem Paket
Netzwerk, mDNS, Heimnetz-Erkennung, Schlüsselspeicher, Rotation, Tauri-Befehle, TS-Adapter, UI. Keine Änderung an `crates/local-api`.

## Abnahme
- Rust-Checks aus web/src-tauri/CLAUDE.md inkl. neuer Crate; Tests: falsches PSK, wiederverwendeter QR, Fremder ohne Hub-Schlüssel (Fenster bleibt offen), Hub-Schlüssel mit altem PSK / wiederholte Nachricht 1 (Fenster bleibt offen), wiederholte Sitzungs-Nachricht 1 (keine größere Rahmen-Grenze, kein `lastSeenAt`), falscher Modus / falsche Länge, gleichzeitige Kopplung, unbekanntes Gerät (authentisierte Antwort), Fremd-Hub, widerrufenes Gerät, Kopplung mit widerrufenem Schlüssel, zu langer Name im `hello`, `unpair` vom Gerät – alle abgewiesen, mit Ablehnungsgrund geprüft; Datenschlüssel nie vor der Bestätigung. Zusätzlich: Fenster-Erneuerung zwischen QR und Nachricht 1 (ein unter Geheimnis k begonnener Handshake, nach Erneuerung auf k+1 gelesen) → verworfen, kein Burn (F6; das PSK wird atomar getauscht, `snow` `set_psk(1, …)` mit dem aktuellen Geheimnis vor dem Lesen); Widerruf bei offener Sitzung → Sitzung sofort geschlossen, nächster Rahmen abgewiesen (F18).
- `cargo check --target x86_64-pc-windows-msvc -p taschenmesser-lan-sync`.
- Docs: decisions core.md „Sync“ (Fenster, Bestätigung), STATUS eine Zeile.

## Skills
`council` (Guardian: Angriffsfläche, QR-Inhalt, Logging, Hard-Rule-Text gegen Code; Architect: Crate-Grenzen, Traits für Speicherung; Advocate: Bestätigungsfrage verständlich). Full stop.
```

### Prompt – package 2b: hub (`feat/lan-sync-hub`)

```
# Aufgabe: Sync im Heimnetz – Hub im PC: mDNS, Heimnetz-Bindung, Schlüsselspeicher, Rotation, Befehle (Paket 2b von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-hub` von frischem `develop`, erst nach Merge von Paket 1 und 2a. Hotspot-Zeilen in docs/CHATS.md: `web/src-tauri/Cargo.toml`, `capabilities/*`.

## Ausgangslage
CONCEPT §4 (Entdeckung, nur private Adressen), §5 (Bedrohungen, Rotation); Paket 2a liefert `noise`, `pairing`, `trust`. Die Hard Rule „LAN sync (desktop hub)“ aus Paket 2a gilt; ändert sich ihr Volltext durch Bindung/Erkennung, nur `docs/RULES.md` anpassen (die Kurzzeile in root `CLAUDE.md` nur, wenn sich eine Aussage ändert, eigener PR). Der Prototyp lässt Heimnetz-Prüfung und Rate-Limit weg (`oversizeDropped` ist die Vorlage für den Rahmen-Test).

## Pflichtliste
- `crates/lan-sync/discovery`: `mdns-sd`; Dienst `_nemo-sync._tcp.local`, Instanzname zufällig und neu je Start, TXT `v=1`, `h=<täglicher HMAC-Hinweis>`, Clients akzeptieren gestern/heute/morgen (CONCEPT §4); Ankündigung nur auf privaten Schnittstellen im gekoppelten Heimnetz.
- `crates/lan-sync/hub`: bindet nur RFC-1918-/Link-local-Adressen der Schnittstellen (nie `0.0.0.0`, nie Loopback, keine Adress-Einstellung), lauscht nur in einem sicher als gekoppeltes Heimnetz erkannten Netz, sonst gar nicht (fail-closed). Erkennung unter Windows über die Netz-ID der Windows-Netzwerkerkennung (NLA, `INetworkListManager`/`INetwork::GetNetworkId`, `windows`-Crate steckt schon im Lockfile) **und** Kategorie „Privat“ (`GetCategory`); Gateway-MAC nur als Rückfall auf Linux/macOS; gewählten Weg im PR belegen. Gebunden und angekündigt wird nur auf Schnittstellen mit Default-Route (keine virtuellen WSL2-/Docker-/Hyper-V-Adapter; der IPv4-Hinweis im QR kommt von dieser Schnittstelle) – Ausnahme: ein vom Nutzer geöffnetes Kopplungsfenster lauscht für seine Dauer im aktuellen privaten Netz; nur die erste Kopplung speichert das Heimnetz (ein Eintrag), Ändern nur über „Dieses Netz als Heimnetz verwenden“ mit Rückfrage; zeigt das Lauschen im Tray-Menü, verwirft andere Peers und Rahmen > 256 B vor dem Handshake, Handshake-Rate-Limit pro Adresse, Schlüsselversion in jeder Anfrage, Rotation = Version n+1 erzeugen, an den hub-lokalen Client geben, offene Sitzungen beenden, Store leeren, neue Epoch; jede Push/Pull-Anfrage (auch In-Prozess) trägt die Schlüsselversion (CONCEPT §5), Push-Handler weist Werte ohne `enc:v1:` ab, Push/Pull nach `contract/sync-paging-cases.json`, `unknown-device` nur verschlüsselt (authentisiert) senden, kein Logging von Nutzdaten, Schlüsseln, Kopplungsgeheimnissen.
- Firewall: was Windows beim ersten Lauschen tut, auf einer echten Windows-Maschine prüfen und im PR beschreiben; Zustand „Windows blockiert“ als Status an die Oberfläche, getrieben von der NLA-Kategorie (Öffentlich + Fenster/Gerät aktiv → blockiert), nicht von Raten.
- Schlüssel: statischer Noise-Schlüssel und Hub-Datenschlüssel roh nur auf der Rust-Seite im OS-Schlüsselspeicher (CONCEPT §3 „Key ownership“; gewählte API im PR belegen); an TS geht nur der Datenschlüssel.
- Abhängigkeit nur für Desktop: `crates/lan-sync` unter `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` wie `local-api` (`web/src-tauri/Cargo.toml:50-60`), `src/lan_sync.rs` nur Desktop; Paket 3 ergänzt den `client`-Eintrag für alle Ziele.
- Tauri-Befehle (desktop): `lan_hub_start/stop/status`, `lan_pair_open/confirm/cancel`, `lan_devices/revoke`, `lan_hub_rotate` („Schlüssel erneuern“), `lan_hub_request` für die eigene WebView (nur über `getPlatform().lanSync` erreichbar) – je Handler in `src/lib.rs` + `build.rs` `COMMANDS` + `capabilities/desktop.json`; `tests/commands.rs` grün.
- Hub lauscht nur, solange ein Kopplungsfenster offen ist oder mindestens ein Gerät gekoppelt ist; startet mit der App.

## Nicht in diesem Paket
TS-Adapter, Einstellungsseite, Android, Client-Seite des Handshakes außer in Tests. Keine Änderung an `crates/local-api`.

## Abnahme
- Rust-Checks aus web/src-tauri/CLAUDE.md inkl. neuer Crate; Tests: öffentliche Peer-Adresse, übergroßer Rahmen vor dem Handshake, alte Schlüsselversion, Push ohne `enc:v1:` – alle abgewiesen, mit Ablehnungsgrund geprüft; die Menge der gebundenen Adressen wird im Test aufgezählt und enthält nie `0.0.0.0` oder Loopback (F11a); ohne offenes Kopplungsfenster und ohne gekoppeltes Gerät lauscht der Hub nicht (F11b); Handshake-Rate-Limit pro Adresse greift (F11c); mDNS-TXT enthält nur `v` und `h`, nie den Namen (F11d); nach Rotation kein Wert der alten Version im Store, auch nicht durch einen unter n verschlüsselten Push, der nach dem Leeren ankommt; 1 000 Ops push/pull über einen Loopback-Socket nur unter `#[cfg(test)]` (kein Laufzeitschalter).
- `cargo check --target x86_64-pc-windows-msvc -p taschenmesser-lan-sync`; Bundle-Größe vorher/nachher.
- Docs: decisions core.md „Sync“ (Bindung), `docs/architecture/desktop.md` Abschnitt, STATUS eine Zeile.

## Skills
`council` (Guardian: Bindung, Heimnetz-Erkennung (NLA, fail-closed), Rate-Limit, Logging, Schlüsselablage; Architect: Crate-Grenzen, Vertrag erfüllt, keine zweite Meinung zur LWW; Advocate: Ruhe bei Fehlversuchen). Full stop.
```

### Prompt – package 3: client (`feat/lan-sync-client`)

```
# Aufgabe: Sync im Heimnetz – Client: SyncAdapter `lan`, Plattformnaht, erster Abgleich (Paket 3 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-client` von frischem `develop`, erst nach Merge von Paket 2b. Hotspot-Zeilen: Plattformnaht (`core/platform/types.ts`, `core/platform/tauri/index.ts`, `core/platform/web.ts`; ein Chat), `core/sync/service.ts`.

## Ausgangslage
CONCEPT §3 (Form von b), §6, §7; `web/src/core/sync/{types,engine,service}.ts`, `adapters/selfHosted.ts` (Abbildung der Routen), `vaultKey.ts`/`crypto.ts` (Werte bleiben `enc:v1:`).

## Pflichtliste
- `getPlatform().lanSync` (optional, nur Tauri): `pair(qr)`, `request(msg)`, `status()`; am Hub-PC verteilt `request` lokal an den Hub (In-Prozess), an Clients über Noise; `core/sync` nennt nie einen Tauri-Befehl (`docs/RULES.md:14`); Web/PWA: `undefined` (PWA bleibt beim Server-Weg).
- Client-Befehle: Handler in `src/lib.rs` + `build.rs` `COMMANDS` + Grant in `capabilities/default.json` (geteilt, Android + Desktop), `tests/commands.rs` grün.
- `core/sync/adapters/lan.ts`: `SyncAdapter` nur über `getPlatform().lanSync.request`, gleiche Seitengrößen und Fehlercodes wie `selfHosted` (`network` = neutraler Banner aus CONCEPT §8, nie Rot; auch Abbrüche); `revoked` nur nach authentisierter Hub-Antwort `unknown-device` nach `revokedAt` (Test: ein unauthentisierter Abbruch lässt den Zustand nie auf `revoked` kippen, F11f) und `decrypt` (bestehend) jeweils mit nächstem Schritt „Neu koppeln“.
- `SyncConfig` bekommt `kind: 'lan'` (statischer Hub-Schlüssel gepinnt, Gerätename, Datenschlüssel als nicht-extrahierbarer `CryptoKey` wie heute); rohe Schlüssel bleiben in Rust (Paket 2b); nie synchronisiert, nie im Backup (Test).
- Ein Weg pro Gerät: Wechsel Server ↔ LAN nur über Trennen; erster LAN-Abgleich `markAllDirty`.
- Schlüsselversion in jeder Anfrage; neue Version beim Sitzungsbeginn übernehmen (`CryptoKey` ersetzen, neue Epoch → `markAllDirty`); Test: Push unter n wird abgewiesen und unter n+1 wiederholt.
- `lanSync.unpair()`: ist der Hub erreichbar, `unpair` senden, dann Hub- und Datenschlüssel löschen; sonst sofort löschen (CONCEPT §8). Test: nach `unpair` hält der Client weder Hub- noch Datenschlüssel (F11e).
- Cargo-Features `hub`/`client` in `crates/lan-sync`: der Android-Build enthält nur `client` (kein Store, kein `rusqlite`); Bundle-Größe der APK vorher/nachher.
- `crates/lan-sync/client` für Android und zweiten PC (Noise-Initiator `IK`/`IKpsk1`, `hello`-Rahmen, Pinning; eine verworfene Verbindung beim Koppeln = „Kopplung nicht möglich – am PC neu zeigen“, sonst `network`); Entdeckung als Trait: Desktop `mdns-sd`, Android vorerst nur Adress-Hinweis (Paket 4 speist `NsdManager`-Ergebnisse ein).
- Statischer Client-Schlüssel: in Rust erzeugt, gespeichert über `secure-store` (Android) bzw. den Desktop-Schlüsselspeicher aus Paket 2b; API im PR belegen; Test: nie im Backup.
- Kein Playwright-Zweiinstanzen-E2E (die Web-App läuft dort ohne Tauri, der Hub lebt in der Rust-Schale, F10). Stattdessen: Rust-Integrationstest in `crates/lan-sync` (`#[cfg(test)]`: zwei `client`-Instanzen gegen einen In-Prozess-Hub über Loopback – koppeln, Änderung von A erscheint bei B, Konflikt nach Feld-LWW, Hub aus → Client meldet `network`) + vitest für `adapters/lan.ts` gegen ein Fake-`lanSync.request` (Seitengrößen, Fehlercodes, `revoked` nur nach authentisierter Antwort).

## Nicht in diesem Paket
Einstellungs-UI über eine Test-Schaltfläche hinaus, Android-Plugin (WLAN-Auslöser), Hintergrund-Abgleich, Tailscale.

## Abnahme
- `npm run check`, `test`, `e2e` (`e2e:sync` unverändert grün; kein neuer Zweiinstanzen-Lauf), Rust-Checks; `exclusion.test.ts`/`privacy.test.ts` unverändert; Test „Schlüssel und Kopplungsdaten nie in Backup/Diagnose“.
- Docs: decisions core.md „Sync“, ARCHITECTURE-MAP Zeile, STATUS eine Zeile.

## Skills
`council` (Guardian: Schlüsselablage, Backup/Diagnose-Ausschluss, Plattformregel; Architect: Adapter-Grenze, eine Engine, Epoch/Cursor, keine LWW außerhalb `mergeOps`; Advocate: Verhalten bei Nichterreichbarkeit, keine Fehlerflut). Full stop.
```

### Prompt – package 4: UI, QR, Android (`feat/lan-sync-ui`)

```
# Aufgabe: Sync im Heimnetz – Einstellungsseite, Koppeln per QR, Android-WLAN-Auslöser, Doku (Paket 4 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/lan-sync-ui` von frischem `develop`, erst nach Merge von Paket 3. Hotspot-Zeilen: `strings.ts` (nur Block `sync`), `web/package.json`, `web/src-tauri/Cargo.toml`.

## Ausgangslage
CONCEPT §2 (Nutzungsbild, drei Schritte ohne Eintippen), §6 (Android), §8 (UI-Skizze, Fokus-Regeln); `pages/settings/{SyncSection,SyncDevices,ConnectParts}.tsx`; docs/design/FOCUS-GUIDELINES.md, FOCUS-WORDING.md.

## Pflichtliste
- Sync-Seite nach CONCEPT §8 (Zustandstabelle dort ist verbindlich): Banner nie Rot, Fehler im `attention`-Ton mit Text, Icon und dem nächsten Schritt aus der Tabelle; „Kopplung lösen“ auch am Client mit Rückfrage; „Schlüssel erneuern“ am Hub (Geräteliste, mit Rückfrage); Fakten mit Datum statt „vor n Tagen“; „Jetzt abgleichen“; Geräteliste nur am Hub mit „Kopplung lösen“ und einmaligem Hinweis nach 90 Tagen; „Gerät koppeln“ nur am Hub (QR groß, still erneuert, kein Countdown, Firewall-Hinweis beim ersten Mal, Bestätigung mit 6-stelligem Code); „Kopplung lösen“ mit einer Rückfrage; Schalter „Mit Windows starten“ und „Im Tray weiterlaufen“ nur im Koppel-Dialog vorausgewählt, auf der Seite nur eine Faktzeile, wenn einer aus ist; Zustände aus der Tabelle CONCEPT §8 inkl. Koppel-Fehlern, Erststart und Hub; „Eigener Server (erweitert)“ eingeklappt.
- Zweiter PC: „Mit einem anderen PC koppeln“ mit Webcam-Scan (`getUserMedia`; Decoder im PR belegen); ohne Webcam kein Weg in dieser Runde.
- `lan-watch` speist `NsdManager`-Ergebnisse (oder hält den Multicast-Lock) in den Entdeckungs-Trait aus Paket 3.
- Handy: „Mit PC koppeln“ → `tauri-plugin-barcode-scanner` (eigener Commit); gefährliche Rechte nur Kamera; normale Rechte `ACCESS_NETWORK_STATE`, `CHANGE_WIFI_MULTICAST_STATE`.
- Eigenes Plugin `plugins/lan-watch` (Kotlin): `NetworkCallback` für WLAN → Ereignis → `syncNow()`; Multicast-Lock bzw. `NsdManager` für die Suche; keine Standort-Berechtigung, keine SSID.
- Texte de/en (Vorschläge, alle fünf Sprachen über `check:i18n`; `(P)` = Pluralfunktion):
  - Koppeln: „Mit PC koppeln / Pair with PC“, „Gerät koppeln / Pair a device“, „Mit einem anderen PC koppeln / Pair with another PC“, „{name} koppeln? Code {code} / Pair {name}? Code {code}“, „Steht derselbe Code auf {name}? Wenn nicht: Abbrechen. / Does {name} show the same code? If not: cancel.“, „Am PC bestätigen · Code {code} / Confirm on your PC · Code {code}“, „Koppeln / Pair“, „Abbrechen / Cancel“, „{name} ist gekoppelt. / {name} is paired.“, „Mit {PC} gekoppelt / Paired with {PC}“ (`{PC}` = Name oder „deinem PC“ / “your PC” solange Standardname, ein Helfer für alle Texte), „Kopplung abgebrochen. / Pairing cancelled.“, „Neu versuchen / Try again“, „Kopplung nicht möglich – am PC neu zeigen. / Pairing not possible – show the code on your PC again.“, „Das ist kein Kopplungscode von Nemo. / This is not a Nemo pairing code.“, „Neu scannen / Scan again“, „PC nicht gefunden – sind beide im selben WLAN? / PC not found – are both on the same Wi-Fi?“, „Ohne Kamera geht das Koppeln mit einem anderen PC noch nicht. / Pairing with another PC needs a camera for now.“, „Kamera ist aus. / Camera is off.“, „In den Einstellungen erlauben / Allow in settings“, „Windows fragt gleich, ob Nemo im Heimnetz erreichbar sein darf – wähle „Zulassen“. / Windows will ask whether Nemo may be reachable on your home network – choose “Allow”.“.
  - Zustand: „Abgeglichen / Synced“, „Gleicht ab … / Syncing …“, „Gleiche dein Handy im Heimnetz mit diesem PC ab. / Sync your phone with this PC on your home network.“, „Gleiche im Heimnetz mit deinem PC ab. / Sync with your PC on your home network.“, „Dieser PC gleicht ab · {n} Geräte gekoppelt / This PC syncs · {n} devices paired“ (P), „Gleicht nur im Heimnetz ab / Syncs only on your home network“, „Windows blockiert den Abgleich. / Windows is blocking sync.“, „Windows-Einstellungen öffnen / Open Windows settings“, „Heimnetz-Abgleich aktiv / Home-network sync on“ (Tray), „Neuer Router? Dieses Netz als Heimnetz verwenden / New router? Use this network as home network“, „Ist das dein Heimnetz zu Hause? Nur dann bestätigen. / Is this your network at home? Only confirm if it is.“, „Verwenden / Use“, „Gleicht ab, sobald dein PC im selben WLAN erreichbar ist / Syncs as soon as your PC is reachable on the same Wi-Fi“, „Läuft Nemo auf dem PC? / Is Nemo running on the PC?“, „Diese Kopplung wurde gelöst. / This pairing was removed.“, „Lange keinen PC gefunden. Falls du ihn neu eingerichtet hast: neu koppeln. / No PC found for a long time. If you set it up again: pair again.“, „Daten vom PC lassen sich nicht lesen. / Data from the PC cannot be read.“, „Neu koppeln / Pair again“.
  - Fakten: „Zuletzt abgeglichen / Last synced“, „gerade eben / just now“, „Noch nicht abgeglichen / Not yet synced“, „{n} Änderungen / {n} changes“ (P), „Jetzt abgleichen / Sync now“, „Nur im WLAN / Wi-Fi only“.
  - Geräte: „Gekoppelte Geräte / Paired devices“, „Zuletzt gesehen {date} / Last seen {date}“, „Länger nicht gesehen. Lösen, wenn du es nicht mehr nutzt. / Not seen for a while. Unpair it if you no longer use it.“, „Kopplung lösen / Unpair“, „{name} lösen? Es gleicht erst wieder ab, wenn du es neu koppelst. / Unpair {name}? It will only sync again after you pair it again.“, „Von {PC} lösen? Dieses Gerät gleicht erst wieder ab, wenn du es neu koppelst. / Unpair from {PC}? This device will only sync again after you pair it again.“, „Schlüssel erneuern / Renew key“, „Neuen Schlüssel erzeugen? Alle gekoppelten Geräte laden ihre Daten danach neu hoch. / Create a new key? All paired devices upload their data again afterwards.“, „Lösen / Unpair“, „{name} kann nicht mehr abgleichen. / {name} can no longer sync.“.
  - Schalter: „Mit Windows starten / Start with Windows“, „Im Tray weiterlaufen / Keep running in the tray“, „Damit dein Handy abgleichen kann, wenn du heimkommst / So your phone can sync when you get home“, „Nemo startet nicht mit Windows · Ändern / Nemo does not start with Windows · Change“, „Nemo läuft nach dem Schließen nicht weiter · Ändern / Nemo does not keep running after closing · Change“; „Eigener Server (erweitert) / Own server (advanced)“.
  - Umstieg: „Vom Server auf das Heimnetz umstellen / Switch from server to home network“, „Zuerst eine Sicherung / Backup first“, „Diese Geräte gleichen weiter über den Server ab, bis du sie auch umstellst: / These devices keep syncing through the server until you switch them too:“, „Am Server sperren / Lock on server“, „Vom Server trennen / Disconnect from server“.
- Umstieg Server → LAN: Dialog mit Pflicht-Backup zuerst, Liste der Geräte, die der Server noch kennt (mit „Am Server sperren“), dann Trennen, dann Koppeln (CONCEPT §7).
- Doku: `docs/user/sync.md` + `.de.md` neuer erster Abschnitt „Im Heimnetz mit dem PC“; Server-Abschnitt bleibt; MANUAL-TESTS: echter Zweigeräte-Lauf (Handy + PC koppeln, Änderung hin und zurück, Feld-Konflikt, PC aus → ruhiger Status; ersetzt den E2E aus Paket 3, F10), Koppeln, Handy kommt heim (App offen / App im Hintergrund / App geschlossen), PC aus, Gäste-WLAN, Kopplung lösen, Windows-Firewall beim ersten Koppeln; Messung Entdeckung/erster Abgleich auf echtem Handy in die Tabelle CONCEPT §9 nachtragen.

## Nicht in diesem Paket
Hintergrund-Abgleich (WorkManager), Tailscale, Änderungen an Protokoll oder Crate außer Fehlerbehebungen.

## Abnahme
- `npm run check`, `test`, `e2e`, `check:i18n`, `check:readme`; a11y für die Sync-Seite; 412 px ohne Überlauf; Fokus-Checkliste (FOCUS-GUIDELINES 1–9) im PR-Text; Koppeln in drei Schritten ohne Eintippen (Klicks je Gerät wie CONCEPT §2 gezählt und im PR genannt).
- `.changes/`-Notiz (DE/EN): „Handy und PC gleichen sich im Heimnetz ab – koppeln per QR-Code, kein eigener Server nötig.“

## Skills
`review loop` über den Diff. Full stop.
```
