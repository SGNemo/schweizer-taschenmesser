# Remote control – packages (prompts)

Decisions: [CONCEPT.md](CONCEPT.md) §11 (provisional) and [`docs/decisions/core.md`](../../decisions/core.md) "Remote control". Template: [plan/PACKAGES.md](../plan/PACKAGES.md). One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Order 0 → 1 → 2 → 3 → 4 → 5, a stop after each. **Package 0 starts only after Sven has answered CONCEPT §12**; the chat first writes his answers into `docs/decisions/core.md` and adapts the prompts below where an answer differs from the recommendation. **Never parallel to an open LAN-sync package or PR** (`crates/lan-sync` is the shared hotspot): check `docs/CHATS.md` and the open PRs first. Model: Claude Opus. Skills: `council` per package with the lenses named in the prompt (Guardian always: grant, logging, rate limits, channel), then `full stop` (PR against `develop`, council table in the PR description, never merge).

| # | Package | Branch | Scope | Hotspots to announce | Skills |
|---|---|---|---|---|---|
| 0 | Rules | `docs/remote-control-rules` | `CLAUDE.md` one line, `docs/RULES.md` full text | root `CLAUDE.md` | `review-loop`, `full stop` |
| 1 | PC: channel, grant, media, visible state | `feat/remote-host-media` | `crates/lan-sync` (`input/`, trust field), new `crates/remote-input`, `src/remote.rs`, settings section, tray + chip, seam `remoteHost` | `crates/lan-sync`, `core/platform`, `Cargo.toml`/lock, capabilities, `strings.ts` | `council`, `full stop` |
| 2 | Phone: module with _Medien_ | `feat/remote-module-media` | `src/remote_client.rs`, seam `remote`, module `remote` (page Medien, empty and refused states), fake | `core/platform`, capabilities, `strings.ts` | `council`, `full stop` |
| 3 | Touchpad and clicks | `feat/remote-touchpad` | records move/button/scroll end to end, `SendInput` pointer, page Touchpad, latency hand test | `crates/lan-sync` | `council`, `full stop` |
| 4 | Keyboard and special keys | `feat/remote-keyboard` | text + key enum end to end, page Tastatur | `crates/lan-sync` | `council`, `full stop` |
| 5 | Widget, tray polish, phone volume keys | `feat/remote-polish` | widget action, notification, volume keys in `plugins/screen-mode`, maturity `stable` | `core/platform` | `council`, `full stop` |

Each package: own branch from fresh `develop`, PR against `develop`, row in CHATS.md (and one row per hotspot under "Hotspots"), `.changes/` note (DE/EN; package 0: label `no-changelog`), STATUS one line, decisions in `docs/decisions/core.md`, the focus checklist (1–9) answered in the PR text, hand tests added to `docs/MANUAL-TESTS.md` (input simulation cannot be proven in CI). After each package: move the "Wartet auf Sven" row to the next package.

### Prompt – package 0: rules (`docs/remote-control-rules`)

```
# Aufgabe: Fernsteuerung – Hard-Rule-Zeilen (Paket 0 von 5, nur Doku)

Routing: Claude Code · Fernsteuerung Paket 0 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `docs/remote-control-rules` von frischem `develop`. Vorgegebene Session-Branches ignorieren. Hotspot root `CLAUDE.md`: Zeile in docs/CHATS.md „Hotspots“, eigener kleiner PR.

## Ausgangslage
Konzept docs/design/remote-control/CONCEPT.md; Svens Antworten auf §12 stehen im Auftrag über diesem Prompt. Regelvorschlag wörtlich in CONCEPT §5 „Proposed rule lines“.

## Pflichtliste
- Svens Antworten als Bullet in docs/decisions/core.md („Remote control“), CONCEPT §11/§12 auf „answered <Datum>“ stellen; wo eine Antwort von der Empfehlung abweicht: CONCEPT §4 und die Prompts in PACKAGES.md anpassen.
- Regelzeile in root CLAUDE.md (nach „LAN sync“) und Volltext in docs/RULES.md, aus CONCEPT §5, an die Antworten angepasst; nichts an bestehenden Regeln ändern. Startkontext-Budget von CLAUDE.md prüfen (`npm run check:docs`).

## Nicht in diesem Paket
Jeder Produktcode.

## Abnahme
`npm run check:docs` ohne neue Warnungen; Label `no-changelog`; STATUS eine Zeile; „Wartet auf Sven“ auf Paket 1 stellen.

## Skills
`review-loop`, danach `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 1: PC side – channel, grant, media and volume, visible state (`feat/remote-host-media`)

```
# Aufgabe: Fernsteuerung – PC-Seite: Eingabe-Sitzung im LAN-Hub, Freigabe je Gerät, Medien und Lautstärke, sichtbarer Zustand (Paket 1 von 5)

Routing: Claude Code · Fernsteuerung Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-host-media` von frischem `develop` – **erst wenn kein LAN-Sync-PR offen ist und Paket 0 gemergt ist** (Hotspots `crates/lan-sync`, Plattform-Naht `core/platform/types.ts` + `tauri/index.ts` + `web.ts`, `Cargo.toml`/`Cargo.lock`, Capabilities; vorher je eine Zeile in docs/CHATS.md „Hotspots“, ein Chat). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept docs/design/remote-control/CONCEPT.md (§3 Transport Option b, §4 Freigabe, §5 Bedrohungsmodell, §6 PC-Seite), Regeln docs/RULES.md „Remote control“ + „LAN sync“. Lies `crates/lan-sync/src/noise/frame.rs` (Modus-Byte, Tags), `noise/mod.rs`, `endpoint.rs` (`Session::receive`), `hub/router.rs` (`Connection::on_frame`, Limits), `trust/mod.rs` + `trust/file.rs`, `transport/client.rs`, `tests/rules.rs`; `src/lan_sync.rs` (`DeviceDto`, `lan_devices`), `src/capture.rs` (`build_tray`), `build.rs` `COMMANDS`, `capabilities/desktop.json`, `tests/commands.rs`; `crates/system-info/src/platform.rs` (Audio-Endpoint, `imp`-Muster); `web/src/pages/settings/LanHubSection.tsx`, `sections.tsx`, `layout/SyncBadge.tsx`; web/src-tauri/CLAUDE.md.

## Pflichtliste
- `crates/lan-sync`: Handshake-Modus 3 (`MODE_INPUT`, im Prolog); Modul `input/` mit Codec (feste 4-Byte-Records, Tags getrennt von Sync), Sitzungsautomat (`open` → `opened`/`refused` mit den Codes aus CONCEPT §3, ein Controller, `closed`), Tor je Ereignis (Hauptschalter, Freigabe, Stufe, Sperrzustand), Token-Eimer und Einzel-Limits (CONCEPT §5), Trait `InputSink`; in diesem Paket nur die Arten `media` und `lock`, alles andere schließt. Sync-Sitzung lehnt Eingabe-Tags ab und umgekehrt; der Eingabe-Pfad fasst den Store nie an. Client-Hälfte (öffnen, senden, Zustand empfangen) für Paket 2.
- Trust-Liste: Feld `remote` (`off` | `media` | `full`, Standard `off`, `#[serde(default)]`, alte Datei lesbar), `pausedRemote`, `remoteUsedAt` (Rückfall `full` → `media` nach 30 Tagen); Hauptschalter gerätelokal in `lan-sync/`; nichts davon in synchronisierten Einstellungen. Sperren/Rotieren/Schalter aus beendet Eingabe-Sitzungen sofort.
- Neue Crate `crates/remote-input` (ohne Sockets, ohne `tauri`, ohne `serde`): `InputSink` für Windows – Lautstärke ±2 %/Ton aus, Wiedergabe/Pause, Weiter, Zurück, `LockWorkStation`, Sperrzustand lesen; `cfg(not(windows))` → `unsupported`. `windows`-Crate (kein `enigo`); Abhängigkeit in eigenem kleinen Commit; Crate in die `-p`-Listen der CI; `cargo check --target x86_64-pc-windows-msvc`.
- Shell `src/remote.rs`: Befehle `remote_status`, `remote_set_enabled`, `remote_set_device` (Erhöhen nur nach nativem Dialog aus Rust, Text nennt Gerät und Stufe), `remote_end` (schließt + pausiert) – `build.rs` `COMMANDS` + `capabilities/desktop.json`; **kein** Befehl, der eine Eingabe auslöst. Tray: Eintrag „Fernsteuerung beenden“ und Tooltip, solange eine Sitzung offen ist (aus Rust, nicht aus der Web-Ansicht).
- Web: Naht `remoteHost` (Vertrag, Tauri-Brücke, Web-Stub `unsupported`, E2E-Fake); Einstellungs-Abschnitt „Fernsteuerung“ (Kategorie `verbindungen`, `maturity: 'preview'`): Hauptschalter, je gekoppeltem Gerät zwei Schalter + Optionen, „Fernsteuerung beenden“, pausierte Geräte; ruhiger Chip in der Topbar nur während einer Sitzung. Texte DE + EN.
- Tests: Rust – Tor (ohne Schalter/Freigabe/Stufe nichts), Codec (unbekannte Art/Id/Tag schließt, Fuzz-artige Tabellen), Limits, Modus-Trennung (Sync-Tag in Eingabe-Sitzung und umgekehrt), älterer Hub lehnt Modus 3 ab, Trust-Datei alt → neu; `tests/rules.rs` erweitert: kein Logging, kein `unsafe`, keine OS-Eingabe-API in `lan-sync`; `remote-input` ohne Socket/`tauri`; Quelltext-Test „kein Befehl simuliert Eingabe“. Web – Abschnitt, Chip, e2e mit Fake; Diagnose-Negativliste (`core/diagnostics`) um die Fernsteuerung erweitert.
- Handtests in docs/MANUAL-TESTS.md: Lautstärke/Medien am echten PC, auch hinter dem Sperrbildschirm (CONCEPT §4 „unsicher“), erhöhte Fenster, Tray-Eintrag; bis Paket 2 mit einem Test-Client aus den Crate-Tests.

## Nicht in diesem Paket
Handy-Modul und Client-Befehle (Paket 2); Zeiger, Klicks, Scroll (3); Text und Tasten (4); Widget, Benachrichtigung, Lautstärketasten (5); Linux/macOS; jede Änderung an Sync-Nachrichten, Pairing, Bind-Regeln, Local API.

## Abnahme
- `cargo fmt --check`, `clippy -D warnings`, `cargo test --locked` für `lan-sync`, `remote-input`, `--test commands`; `npm run check`, `test`, `check:i18n`, `e2e` grün; `contract/`-Fälle unverändert grün.
- Fokus-Checkliste 1–9 im PR-Text; Docs: STATUS eine Zeile, docs/decisions/core.md, ARCHITECTURE-MAP (neue Crate, Naht), `.changes/`-Notiz (DE/EN); CHATS-Zeilen rein und im letzten Commit raus; „Wartet auf Sven“ auf Paket 2 + Handtests.

## Skills
Nach dem Bau `council` über den Diff (Guardian: Freigabe nur am PC und nie übers Netz setzbar, nativer Dialog, Tor je Ereignis, Modus-Trennung, Limits, Logging-Verbot, Capabilities, kein Eingabe-Befehl; Architect: `lan-sync` bleibt ohne `unsafe`/OS-API, Schnitt `InputSink`, keine Vermischung mit `hub/handler.rs`, Trust-Datei-Migration, Plattform-Naht; Advocate: Abschnitt verständlich ohne Lesen, klarer Aus-Schalter, ruhiger Chip, Wortwahl). Bis 5 Runden (Sicherheit). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge. Ein STOPP vor dem Council, wenn Modus 3 im Handshake nicht ohne Eingriff in die Noise-Logik geht (Frage mit Empfehlung, ≤ 4).
```

### Prompt – package 2: phone – module with Medien (`feat/remote-module-media`)

```
# Aufgabe: Fernsteuerung – Handy-Modul mit der Seite „Medien“ (Paket 2 von 5)

Routing: Claude Code · Fernsteuerung Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-module-media` von frischem `develop`, nach dem Merge von Paket 1 (Hotspots Plattform-Naht, Capabilities, `web/src/strings.ts`; Zeilen in docs/CHATS.md). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §2 (Seite Medien), §7 (Manifest-Tabelle, Widget, Fokus-Checkliste). Lies docs/howto/new-module.md (auch „New module for some platforms only“), web/src/modules/CLAUDE.md, docs/design/MODULE-IDENTITY.md, FOCUS-GUIDELINES.md, FOCUS-WORDING.md, `modules/disk/manifest.ts` (Modul ohne Sammlungen), `src/lan_client.rs` (Schlüssel im Keystore, `spawn_blocking`), `core/platform/tauri/lanClient.ts`, `fakeLanClient.ts`.

## Pflichtliste
- Shell `src/remote_client.rs`: `remote_client_open` (Hub, Stufe, Zustands-Kanal), `remote_client_send` (ein Bündel), `remote_client_close`; eigene Verbindung, nicht der `Link`-Mutex des Sync; nur für das Handy freigegeben; Schlüssel bleiben in Rust.
- Naht `remote` (Vertrag, Brücke, Web-Stub, `fakeRemote.ts` mit Demo-PC „PC-Sven“, Lautstärke 42 %).
- Modul `remote` per `npm run gen:module`: `platforms: ['android']`, Bereich System, Identität laut CONCEPT §7 (`check:modules` entscheidet), `layout: 'full'`, keine Sammlungen, `dataApi: false`, `BLOCKED_MODULES`, `exclusion.test.ts`, `seed: { none: 'live-data' }`, `noOnboarding`, `maturity: 'preview'`, Einstellungen (Haptik, Bildschirm anlassen).
- Seite mit `PageHeader`/`PageTitle`, zunächst nur Medien (die Tabs Touchpad und Tastatur kommen mit Paket 3/4, bis dahin kein Platzhalter); Medien: drei + drei Knöpfe laut CONCEPT §2, Zustandszeile, „PC sperren“ im Menü; Zustände: kein PC gekoppelt, nicht erreichbar, am PC nicht erlaubt, pausiert, gesperrt – je ein Satz + ein nächster Schritt.
- Widget `StatusWidget` (Zustand + Aktion „Öffnen“; die Aktion „Wiedergabe / Pause“ folgt in Paket 5); öffnet keine Verbindung beim Anzeigen.
- Tests: Einheit (Zustände → Texte, Bündel), e2e mit Fake im Handy-Viewport, `check:modules`, `widgets.test.tsx`, `registry.test.ts`.

## Nicht in diesem Paket
Touchpad, Tastatur, Widget-Aktion, Lautstärketasten, Handy-Entsperren (kommt mit Paket 3, erst die volle Stufe braucht es), Änderungen an der PC-Seite außer Fehlern aus Paket 1.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `check:modules`, `e2e`, Rust-Checks grün; Handtest Pixel: Pause, Weiter, lauter/leiser, PC sperren, WLAN weg und wieder da.
- Fokus-Checkliste im PR-Text, Bildschirmfotos (nur Testdaten); Docs wie Paket 1; `npm run gen:modules`; „Wartet auf Sven“ auf Paket 3.

## Skills
`council` über den Diff (Guardian: Client hält keine Freigabe-Logik, die der PC nicht selbst prüft, Schlüssel bleiben in Rust, nichts geloggt, Modul für KI/Daten-API unsichtbar; Architect: Naht, Modul nur auf dem Handy, kein zweiter Sync-Weg; Advocate: einhändig ohne Hinsehen, Zustandstexte, keine blinkende Anzeige, Daumenzone). Danach `full stop`.
```

### Prompt – package 3: touchpad and clicks (`feat/remote-touchpad`)

```
# Aufgabe: Fernsteuerung – Touchpad, Klicks, Scrollen (Paket 3 von 5)

Routing: Claude Code · Fernsteuerung Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-touchpad` von frischem `develop`, nach Paket 2; kein LAN-Sync-PR offen (Hotspot `crates/lan-sync`, Zeile in docs/CHATS.md). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §2 (Gesten-Tabelle, Randstreifen), §3 (Latenz, Bündeln je Bild), §4 (volle Stufe, Handy-Entsperren, gesperrter PC), §6 (Abbildung auf `SendInput`). Prototyp-Zahlen CONCEPT §3.

## Pflichtliste
- `lan-sync` `input/`: Arten `move`, `button`, `scroll` hinter der Stufe `full`; Limits; beim Sitzungsende lässt der PC gehaltene Tasten los.
- `remote-input`: `SendInput` für Zeiger, Tasten links/rechts, Rad senkrecht/waagrecht; gesperrt → `locked`.
- Seite Touchpad: Querformat, Vollbild, Bildschirm bleibt an; Gesten laut Tabelle als reine Funktion „Berührungen → Records“ (getestet); Randstreifen Links/Rechts; Empfindlichkeit; einmalige, schließbare Legende; Bündeln je Animationsbild, ausstehendes Schreiben summiert Bewegungen; Haptik beim Ziehen.
- Handy-Entsperren vor einer vollen Sitzung, wenn die PC-Option an ist (`getPlatform().biometrics` oder Geräte-Sperre; ohne eingerichtete Sperre: Hinweis statt Blockade).
- Messung: Handtest mit echtem Handy im WLAN, Latenz Finger → Zeiger (Zeitlupenvideo oder Messmodus nur im Dev-Build, ohne Protokoll in der App), Tabelle in CONCEPT §3 ergänzen. Ziel p95 < 30 ms; verfehlt → STOPP mit Vorschlag (Berührungen im Kotlin-Plugin erfassen).

## Nicht in diesem Paket
Text, Tasten, Pinch, Drei-Finger-Gesten, Zeiger-Beschleunigung in eigener Regie (Windows macht sie).

## Abnahme
Checks wie Paket 2; Handtests in MANUAL-TESTS (Klick, Doppelklick, Rechtsklick, Ziehen, Scrollen, erhöhtes Fenster, Sperren während des Ziehens); Fokus-Checkliste; Docs; „Wartet auf Sven“ auf Paket 4.

## Skills
`council` (Guardian: Stufe je Ereignis, Limits, keine Koordinate geloggt oder gespeichert, Entsperren ist Bremse und so beschrieben; Architect: Gesten als reine Funktion, kein Stau, Loslassen am Ende; Advocate: ohne Hinsehen, Legende, Reizlast im Vollbild). Bis 5 Runden. Danach `full stop`.
```

### Prompt – package 4: keyboard and special keys (`feat/remote-keyboard`)

```
# Aufgabe: Fernsteuerung – Text senden und Sondertasten (Paket 4 von 5)

Routing: Claude Code · Fernsteuerung Paket 4 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-keyboard` von frischem `develop`, nach Paket 3; kein LAN-Sync-PR offen (Hotspot `crates/lan-sync`). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §2 (Seite Tastatur), §5 (Zeilen „Tastatur als Angriffsweg“, „Mitleser“), §6 (Tasten-Liste, `KEYEVENTF_UNICODE`).

## Pflichtliste
- `lan-sync` `input/`: Text-Tag (UTF-8 ≤ 256 Byte, Steuerzeichen abgelehnt), `key(id)` aus fester Liste; keine rohen Tastencodes, keine frei wählbaren Kombinationen; Limits.
- `remote-input`: Text als Unicode-Eingabe; Tasten-Liste aus CONCEPT §6; Umschalttasten werden im selben Aufruf gedrückt und gelöst.
- Seite Tastatur: ein Textfeld + „Senden“, Sondertasten in Dreiergruppen; Feld ohne Verlauf, ohne Speicherung, ohne Lesehilfe (`NoReadAid`), nach dem Senden leer; Autovervollständigen des Handys bleibt.
- Tests: Codec-Tabellen (Steuerzeichen, Überlänge, unbekannte Id), Quelltext-Test „kein Text/keine Taste in Logs, Diagnose, Speicher“, e2e mit Fake.

## Nicht in diesem Paket
Live-Tippen Zeichen für Zeichen, Zwischenablage, Makros, eigene Tastenkürzel, Win-Taste.

## Abnahme
Checks wie Paket 3; Handtests (Umlaute, Emoji, langes Wort, Enter getrennt, gesperrter PC, erhöhtes Fenster); Fokus-Checkliste; Docs; „Wartet auf Sven“ auf Paket 5.

## Skills
`council` (Guardian: feste Liste, kein Weg für rohe Codes, Logging-Verbot und Diagnose-Negativliste, Text nirgends gespeichert; Architect: Codec, keine zweite Tasten-Tabelle; Advocate: tippen – lesen – senden, Sondertasten auffindbar). Bis 5 Runden. Danach `full stop`.
```

### Prompt – package 5: widget, tray polish, phone volume keys (`feat/remote-polish`)

```
# Aufgabe: Fernsteuerung – Widget-Aktion, Hinweis am PC, Lautstärketasten des Handys, Reife „stable“ (Paket 5 von 5)

Routing: Claude Code · Fernsteuerung Paket 5 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-polish` von frischem `develop`, nach Paket 4 (Hotspot Plattform-Naht; Zeile in docs/CHATS.md). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §4 (sichtbarer Zustand), §7 (Widget), offene Handtests aus den Paketen 1–4.

## Pflichtliste
- Widget: eine Aktion „Wiedergabe / Pause“ (ein Tipp verbindet und sendet), Zustandszeile mit Kontext; leerer Zustand „PC koppeln“.
- PC: eine ruhige Systembenachrichtigung beim Beginn (höchstens eine je Gerät in 30 Minuten, ohne Ton), Tray-Symbol-Variante während der Sitzung.
- Handy: Lautstärketasten steuern den PC, solange die Seite offen ist (`plugins/screen-mode`, Kotlin; Schalter, Standard an); über die Naht, nicht direkt.
- Reife von Modul und Einstellungs-Abschnitt auf `stable`, wenn alle Handtests bestanden sind; sonst Liste der offenen Punkte und `preview` bleibt.
- Nutzer-Doku `docs/user/` DE + EN (kurz: einschalten, Stufen, beenden).

## Nicht in diesem Paket
Wake-on-LAN, Makros, Titelanzeige, zweiter PC als Fernbedienung, Linux/macOS.

## Abnahme
Checks wie zuvor, `check:readme`, `check:doclinks`; Fokus-Checkliste (Benachrichtigung zählt als Reiz: begründen); Docs; „Wartet auf Sven“-Zeile entfernen oder auf die offenen Handtests stellen.

## Skills
`council` (Guardian: Widget öffnet nichts ohne Tipp, Hinweis kommt aus Rust; Architect: Plugin-Schnitt; Advocate: Benachrichtigung nicht flutend, Widget verständlich). Danach `full stop`.
```
