# Remote control – packages (prompts)

Decisions: [CONCEPT.md](CONCEPT.md) §11 (decided 2026-11-10, all recommendations) and [`docs/decisions/core.md`](../../decisions/core.md) "Remote control". Template: plan/PACKAGES.md (removed 2026-11-10, in the git history). One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Order 0 → 1a → 1b → 2 → 3 → 4 → 5, a stop after each. Sven's answers to CONCEPT §12 are recorded (all recommendations), so the prompts below stand as written; package 0 is done (2026-11-10). **Never parallel to an open LAN-sync package or PR** (`crates/lan-sync` is the shared hotspot): check `docs/CHATS.md` and the open PRs first. Model: Claude Opus. Skills: `council` per package with the lenses named in the prompt (Guardian always: grant, logging, rate limits, channel), then `full stop` (PR against `develop`, council table in the PR description, never merge).

| # | Package | Branch | Scope | Hotspots to announce | Skills |
|---|---|---|---|---|---|
| 0 | Rules (done) | `docs/remote-control-rules` | `CLAUDE.md` one line, `docs/rules/remote-control.md` full text | root `CLAUDE.md` | `review-loop`, `full stop` |
| 1a | Hub: input session and grant | `feat/remote-hub-session` | `crates/lan-sync` only: mode 3, `input/`, trust fields, registry with mode, outbound queue, duplex client, rule tests (all testable on Linux) | `crates/lan-sync` | `council`, `full stop` |
| 1b | PC: media sink, settings, visible state | `feat/remote-host-media` | new `crates/remote-input`, `src/remote.rs`, tray variant, seam `remoteHost`, settings section, chip | `core/platform`, `Cargo.toml`/lock, capabilities, `strings.ts` | `council`, `full stop` |
| 2 | Phone: module with _Medien_, volume keys | `feat/remote-module-media` | `src/remote_client.rs`, seam `remote`, module `remote` (page Medien, all states), volume keys in `plugins/screen-mode`, fake; **first real hand test of 1a + 1b** | `core/platform`, capabilities, `strings.ts` | `council`, `full stop` |
| 3 | Touchpad and clicks | `feat/remote-touchpad` | latency measurement first; records move/button/scroll end to end, `SendInput` pointer, page Touchpad, native phone unlock, PC notification for the full level | `crates/lan-sync` | `council`, `full stop` |
| 4 | Keyboard and special keys | `feat/remote-keyboard` | text + key enum end to end, page Tastatur | `crates/lan-sync` | `council`, `full stop` |
| 5 | Widget and polish | `feat/remote-polish` | widget action, user docs, maturity `stable` | – | `council`, `full stop` |

Each package: own branch from fresh `develop`, PR against `develop`, row in CHATS.md (and one row per hotspot under "Hotspots"), `.changes/` note (DE/EN; package 0: label `no-changelog`), STATUS one line, decisions in `docs/decisions/core.md`, the focus checklist (1–9) answered in the PR text, hand tests added to `docs/MANUAL-TESTS.md` (input simulation cannot be proven in CI). Packages 1a and 1b cannot be tried by hand on a real PC (no controller exists yet): they are proven by Rust tests and the Windows build check, stay `preview`, and package 2 carries their hand tests. After each package: move the "Wartet auf Sven" row to the next package.

### Prompt – package 0: rules (`docs/remote-control-rules`)

```
# Aufgabe: Fernsteuerung – Hard-Rule-Zeilen (Paket 0, nur Doku)

Routing: Claude Code · Fernsteuerung Paket 0 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `docs/remote-control-rules` von frischem `develop`. Vorgegebene Session-Branches ignorieren. Hotspot root `CLAUDE.md`: Zeile in docs/CHATS.md „Hotspots“, eigener kleiner PR.

## Ausgangslage
Konzept docs/design/remote-control/CONCEPT.md, entschieden am 2026-11-10 (§11, §12). Regelvorschlag wörtlich in CONCEPT §5 „Proposed rule lines“.

## Pflichtliste
- Regelzeile in root CLAUDE.md (nach „LAN sync“) und Volltext aus CONCEPT §5 (liegt in docs/rules/remote-control.md, weil docs/RULES.md am Größen-Budget ist); nichts an bestehenden Regeln ändern. Startkontext-Budget von CLAUDE.md prüfen (`npm run check:docs`).

## Nicht in diesem Paket
Jeder Produktcode.

## Abnahme
`npm run check:docs` ohne neue Warnungen; Label `no-changelog`; STATUS eine Zeile; „Wartet auf Sven“ auf Paket 1a stellen.

## Skills
`review-loop`, danach `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 1a: hub – input session and grant (`feat/remote-hub-session`)

```
# Aufgabe: Fernsteuerung – Eingabe-Sitzung und Freigabe im LAN-Hub (Paket 1a)

Routing: Claude Code · Fernsteuerung Paket 1a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-hub-session` von frischem `develop` – **erst wenn kein LAN-Sync-PR offen ist und Paket 0 gemergt ist** (Hotspot `crates/lan-sync`; vorher Zeile in docs/CHATS.md „Hotspots“, ein Chat). Vorgegebene Session-Branches ignorieren. Nur `web/src-tauri/crates/lan-sync/**` und Doku.

## Ausgangslage
Konzept docs/design/remote-control/CONCEPT.md (§1 Inventur, §3 „Shape of the input session“, §4 Freigabe, §5 Bedrohungsmodell), Regeln docs/rules/remote-control.md + docs/RULES.md „LAN sync“. Lies `noise/frame.rs` (Modus-Byte, Tags, Caps), `noise/mod.rs` (`raise_cap`, `read_first`), `endpoint.rs` (`handle_first`, `Session::receive`, `check_open`), `hub/router.rs` (`Connection::on_frame`, Limits), `hub/netpolicy.rs` (`decide`: Heimnetz vs. Kopplungsfenster), `transport/mod.rs` (`drive`, `deliveries`, Zeitlimits), `transport/client.rs`, `trust/mod.rs` (`SessionRegistry`) + `trust/file.rs`, `tests/rules.rs`; web/src-tauri/CLAUDE.md.

## Pflichtliste
- Handshake-Modus 3 (`MODE_INPUT`, im Prolog). Angenommen **nur** auf einem Bind des gespeicherten Heimnetzes: jeder Bind trägt ein Heimnetz-Kennzeichen, berechnet aus der gespeicherten Netz-Id auch bei offenem Kopplungsfenster, fail-closed; geprüft je angenommener Verbindung (CONCEPT §3). Das ist eine Kennzeichnung, keine Änderung der Bind-Regeln. Frame-Cap der Eingabe-Sitzung: 256 Byte bis zum ersten authentisierten Frame, dann 512, nie 65 535.
- Eine Eingabe-Sitzung ruft `trust.touch` nie auf (`lastSeen` bleibt Sync-Kontakt).
- Modul `src/input/`: Codec (feste 4-Byte-Records, Text-Tag, Tags getrennt von Sync; unbekannte Art/Id/Tag schließt), Sitzungsautomat (`open` → `opened`/`refused`, Codes und PC→Handy-Liste aus CONCEPT §3, Controller-Platz erst nach angenommenem `open`; **Stufe der Sitzung beim `open` festgelegt** = kleinere aus Anfrage und Freigabe, kein Wechsel in der Sitzung; `opened` trägt `grant` (Obergrenze des Geräts) und `unlockRequired` (nur wahr bei Freigabe `full` und eingeschalteter Option), auch beim Medien-`open`), Tor je Ereignis (Hauptschalter, Freigabe, Stufe, Sperrzustand), Token-Eimer und Einzel-Limits aus CONCEPT §5 (auch „lauter“ ≤ 5/s), Trait `InputSink` (typisierte Enums; Test-Senke). Zeit kommt als Parameter herein (monotone Dauer aus `drive` für die Eimer; kein Uhr-Zugriff in `src/input`). Codec auf allen Zielen, Tor/Eimer/Platz/Registry nur Desktop; Duplex-Client per `#[path]` wie `client`; `hub_modules_are_compiled_out_on_mobile` erweitert. Alle Arten sind im Codec und im Tor vorhanden und getestet; welche die Senke ausführt, entscheiden die späteren Pakete.
- Sync-Sitzung lehnt Eingabe-Tags ab und umgekehrt; der Eingabe-Pfad fasst Store und Store-Mutex nie an.
- Registry: Sitzungen tragen ihren Modus. „Fernsteuerung beenden“ und Hauptschalter aus schließen nur Modus-3-Sitzungen; Sperren und Rotieren schließen alle wie bisher.
- Trust-Liste: `remote` (`off` | `media` | `full`, Standard `off`), `remotePaused`, `remoteUnlock` (Standard an) mit `#[serde(default)]`, alte Datei bleibt lesbar; Hauptschalter gerätelokal in `lan-sync/`. Setter verweigern jedes Erweitern (Erhöhen, Entpausieren, Hauptschalter an, Entsperren aus), solange eine `full`-Sitzung offen ist; die Shell prüft in 1b nach dem Dialog erneut. Nichts über Nutzungszeiten speichern.
- Transport: ausgehende Warteschlange je Verbindung (im Tick abgefragt wie `deliveries`; `state` ≤ 5/s; setzt den Leerlauf-Timer nicht zurück); Duplex-Eingabe-Client unter `src/transport/` (Lese-Thread, Sperre nie über einem blockierenden Lesen, weiter `TransportState`).
- Tests: Tor (ohne Schalter/Freigabe/Stufe nichts; pausiert; gesperrt nur Medien; Zeiger-Record auf einer als `media` geöffneten Sitzung schließt sie, auch bei Freigabe `full`; Erweitern-Sperre hängt an der geöffneten Stufe), Codec-Tabellen, Limits, Modus-Trennung in beide Richtungen, Heimnetz- und Fremdnetz-Bind bei offenem Fenster → Modus 3 nur auf dem Heimnetz-Bind, Netz-Id unlesbar → nirgends; Cap 256 → 512; `lastSeen` nach einer Eingabe-Sitzung unverändert; Registry (Beenden schließt Sync nicht), Trust-Datei alt → neu, kein Erhöhen während `full`-Sitzung, Client ↔ Hub Ende zu Ende mit Test-Senke; `tests/rules.rs` erweitert: kein Logging, kein `unsafe`, keine Uhr in `src/input`, keine OS-Eingabe-API, Sockets nur in `src/transport`. `contract/`-Fälle unverändert grün.

## Nicht in diesem Paket
Alles außerhalb der Crate: Windows-Senke, Befehle, Tray, Einstellungen (1b); Handy (2). Jede Änderung an Sync-Nachrichten, Pairing, Bind-Regeln (die Heimnetz-Kennzeichnung der Binds ist keine), Local API.

## Abnahme
- `cargo fmt --check`, `clippy -D warnings`, `cargo test --locked -p` für `lan-sync` grün; Shell baut weiter (`cargo check`).
- Docs: STATUS eine Zeile, docs/decisions/core.md; Label `no-changelog` (noch nichts für Nutzer sichtbar); CHATS-Zeilen rein und im letzten Commit raus; „Wartet auf Sven“ auf Paket 1b.

## Skills
Nach dem Bau `council` über den Diff (Guardian: Heimnetz-Bedingung, Tor je Ereignis, Modus-Trennung, Cap, Limits, Freigabe nie übers Netz setzbar, kein Erhöhen während Steuerung, Logging-Verbot; Architect: `lan-sync` bleibt ohne `unsafe`/Uhr/OS-API, Registry mit Modus, ausgehender Pfad ohne Eingriff in den Sync-Weg, Duplex-Client und Sperren, Trust-Migration; Advocate: Fehlercodes reichen für je einen klaren Satz am Handy – sonst entfällt die Linse). Bis 5 Runden (Sicherheit). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge. Ein STOPP vor dem Council, wenn Modus 3 oder der ausgehende Pfad nicht ohne Eingriff in die Noise- oder Sync-Logik gehen (Frage mit Empfehlung, ≤ 4).
```

### Prompt – package 1b: PC – media sink, settings, visible state (`feat/remote-host-media`)

Split in two PRs (one topic each): **part 1** `feat/remote-host-media` = crate `remote-input`, shell `src/remote.rs`, tray, commands, Rust tests, hand tests. **Part 2** `feat/remote-host-settings` (from fresh `develop` after part 1) = everything under "Web" below plus the web tests, the diagnostics negative list, the DE/EN texts, the focus checklist and the `.changes/` note; contract of the four commands: `src/remote.rs` (`RemoteStatusDto`). Error names and what the page says: `not-started` (hub is off: the sentence + link to pairing), `cancelled` (the person pressed "Abbrechen": no message), `busy` (a question is already open at the PC), `busy-controlled` (not while mouse and keyboard are controlled; ask again afterwards), `changed` (the grant changed while the question was open: reload, ask again), `not-found` (device no longer paired), `failed` (could not be saved), `bad-id`/`bad-level`/`unconfirmed`/`internal` (programming errors: generic message). Part 2 hands the app language to Rust with the tray labels (`lang`), so the shell's own texts follow the app language. Part 2 holds back the level "mouse and keyboard" and the "Am Handy entsperren" option in the settings section: package 3 adds both (`LEVELS` in `RemoteHostSection.tsx`, texts `levels.full` already there).

```
# Aufgabe: Fernsteuerung – PC-Seite: Medien und Lautstärke, Einstellungen, sichtbarer Zustand (Paket 1b)

Routing: Claude Code · Fernsteuerung Paket 1b · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-host-media` von frischem `develop`, nach dem Merge von Paket 1a (Hotspots Plattform-Naht `core/platform/types.ts` + `tauri/index.ts` + `web.ts`, `Cargo.toml`/`Cargo.lock`, Capabilities, `web/src/strings.ts`; je eine Zeile in docs/CHATS.md „Hotspots“). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §4 (Freigabe-Tabelle, Stufen, gesperrter Bildschirm), §6 (Crates, Abbildung, Befehle), §7 („Cut“). Lies `src/lan_sync.rs` (`DeviceDto`, `lan_devices`, Aufbau des Hub-Kerns), `src/capture.rs` (`build_tray`, Dialog-Plugin), `build.rs` `COMMANDS`, `capabilities/desktop.json`, `tests/commands.rs`, `crates/system-info/src/platform.rs` (Audio-Endpoint, `imp`-Muster), `web/src/pages/settings/LanHubSection.tsx`, `sections.tsx`, `layout/SyncBadge.tsx`, `core/platform/system.ts` + `tauri/system.ts` + `fakeSystem.ts`.

## Pflichtliste
- Neue Crate `crates/remote-input` (ohne Sockets, `tauri`, `serde`): eigene Enums, keine Abhängigkeit auf `lan-sync` (die Shell implementiert `InputSink` und reicht weiter); Windows – Lautstärke ±2 %/Ton aus (Audio-Endpoint), Wiedergabe/Pause, Nächster, Vorheriger (Medien-Sitzung des Systems), `LockWorkStation`, Sperrzustand; **kein `SendInput` in diesem Paket, keine `VK_MEDIA_*`/`VK_VOLUME_*`**. Ein eigener Arbeits-Thread (COM/WinRT dort initialisiert, typisierte Befehle über einen Kanal, Lautstärke und Sperrzustand zwischengespeichert); ein Hub-Thread blockiert nie auf dem System. `cfg(not(windows))` → `unsupported`. `windows`-Crate (kein `enigo`); neue Features in eigenem kleinen Commit; Crate in die `-p`-Listen der CI; `cargo check -p … --target x86_64-pc-windows-msvc`.
- Shell `src/remote.rs`: `remote_status`, `remote_set_enabled`, `remote_set_device` (Stufe, Pause aufheben, Entsperr-Option), `remote_end` (schließt + pausiert); **jedes Erweitern** (Stufe erhöhen, Pause aufheben, Hauptschalter an bei gespeicherter Freigabe, Entsperren aus) nur nach nativem Dialog aus Rust (Gerätename, letzter Sync-Kontakt, „Erlauben“/„Abbrechen“), Ablauf fest: `Remote::ticket()` nehmen → Dialog zeigen → Setter mit dem Ticket aufrufen (ein Ticket, ein Erweitern; ohne Ticket lehnt die Crate jedes Erweitern ab, mit Ticket auch dann, wenn seit dem Ticket eine `full`-Sitzung offen war). `Router::with_input` auf **jedem** Desktop aufrufen – wo sich das System nicht steuern lässt mit einer Senke, die `supported() == false` sagt – `build.rs` `COMMANDS` + `capabilities/desktop.json`, `async`; **kein** Befehl, der eine Eingabe auslöst. Tray aus Rust: Symbol-Variante, Tooltip und erster Eintrag „Fernsteuerung beenden“, solange eine Sitzung offen ist – aus Rust-Zustand bei **jedem** Neuaufbau (`tray_menu`), auch wenn die Web-Ansicht `desktop_set_tray_labels`/`desktop_set_tray_today` aufruft (Test).
- Web: Naht `remoteHost` (Vertrag, Brücke, Web-Stub `unsupported`, E2E-Fake); Einstellungs-Abschnitt „Fernsteuerung“ (Kategorie `verbindungen`, `maturity: 'preview'`): Hauptschalter; je gekoppeltem Gerät eine Dreier-Auswahl (inaktiv mit einem erklärenden Satz, solange der Hauptschalter aus ist); „Erweitert“ mit „Am Handy entsperren“; „Fernsteuerung beenden“ mit dem Hinweis aus CONCEPT §4; pausierte Geräte mit „Wieder einschalten“; ohne Hub ein Satz + Link zur Kopplung. Ruhiger Chip in der Topbar nur während einer Sitzung. Texte DE + EN.
- Tests: `remote-input` (Entscheidungslogik über dem `imp`-Modul, Quelltext-Test: kein Socket, kein `tauri`, kein `SendInput`-Aufruf für Medien), `tests/commands.rs`, Quelltext-Test „kein Tauri-Befehl simuliert Eingabe“; Web: Abschnitt, Chip, e2e mit Fake; Diagnose-Negativliste (`core/diagnostics`) um die Fernsteuerung erweitert.
- Handtests in docs/MANUAL-TESTS.md eintragen (ausführbar ab Paket 2): Lautstärke/Medien am echten PC mit zwei Playern, hinter dem Sperrbildschirm, Tray-Variante bei geschlossenem Fenster, „Beenden“ pausiert, Dialog lässt sich während einer Sitzung nicht bestätigen.

## Nicht in diesem Paket
Änderungen am Protokoll (1a); Handy-Modul und Client-Befehle (2); Zeiger, Klicks, Scroll, Benachrichtigung (3); Text und Tasten (4); Linux/macOS.

## Abnahme
- Rust-Checks für `remote-input`, `lan-sync`, `--test commands`; `npm run check`, `test`, `check:i18n`, `e2e` grün.
- Fokus-Checkliste 1–9 im PR-Text; Docs: STATUS eine Zeile, docs/decisions/core.md, ARCHITECTURE-MAP (neue Crate, Naht), `.changes/`-Notiz (DE/EN); CHATS-Zeilen rein und raus; „Wartet auf Sven“ auf Paket 2.

## Skills
Nach dem Bau `council` über den Diff (Guardian: nativer Dialog, kein Erhöhen während Steuerung, Capabilities, kein Eingabe-Befehl, Tray aus Rust, Medien ohne simulierte Eingabe, Logging-Verbot; Architect: Crate-Schnitt, Arbeits-Thread, Plattform-Naht, Verdrahtung Senke ↔ Hub; Advocate: Abschnitt verständlich ohne Lesen, klarer Aus-Schalter, Pause-Hinweis, ruhiger Chip, Wortwahl). Bis 5 Runden. Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge.
```

### Prompt – package 2: phone – module with Medien (`feat/remote-module-media`)

Split in two PRs (one topic each): **part 1** `feat/remote-module-media` = shell `src/remote_client.rs` (mobile handler, `mobile.json`, guard tests), seam `remote` (contract, bridge, stub, `fakeRemote.ts`), state logic `core/remote/session.ts` with its tests. **Part 2** `feat/remote-module-page` (from fresh `develop` after part 1) = the module `remote` (manifest, page Medien, settings, widget), the phone's volume keys (`plugins/screen-mode`), wiring `syncRound` to the sync service, texts, e2e, focus checklist, screenshots, `.changes/` note, hand tests.

What part 2 gets from `core/remote/session.ts` and still has to decide:

| View | Sentence and step |
| --- | --- |
| `not-paired`, `unreachable`, `refused` (each reason), `no-input-here`, `too-old` | the rows of CONCEPT §7; `refused: locked` cannot happen on Medien, `limit` and `ended` can also arrive during a session |
| `connecting` | the PC's line without a state word, no spinner that moves |
| `slow` (after 5 s, the attempt goes on) | a neutral line, e.g. „PC-Sven antwortet noch nicht.“ + _Erneut versuchen_ – no verdict and no Wi-Fi hint yet; a press that waited is dropped |
| `disconnected` | no sentence of its own: the last known state stays, quiet; the next touch reconnects |
| `retry` | the unconnected line + _Erneut versuchen_ |
| `idle` | the page is not in front; nothing to show |

- One `RemoteSession` for the whole app (module-level), shared by page and widget: the PC keeps one session per device, a second instance would replace the first.
- The PC's name is not in `RemoteOpened`: take the name the phone shows for its sync PC (pairing), not a new field.
- The page applies `createHoldGate` to held buttons and held volume keys and passes `{ repeat: true }` for every repeat; a repeat never opens a connection.
- Wording of `too-old`: the PC hanging up twice is strong evidence, not proof (a PC shedding load looks the same for a moment) – say what to check („Nemo auf dem PC aktuell?“), not a verdict.
- Known and for the hand tests: on slow Wi-Fi a play/pause the PC did carry out can show „nicht verbunden“ after 3 s; a late answer heals it, but a second press before that toggles again. Show the fresh state as soon as the session stands.
- Part 2 is split once more: the module (page, widget, settings) is `feat/remote-module-page`; the phone's **hardware volume keys** (`plugins/screen-mode`, Kotlin; the setting, the row „Lautstärketasten steuern den PC“ shown while `takesVolumeKeys()`) are their own PR `feat/remote-volume-keys`, because they need an Android build and a real phone to try.
- Still open after `feat/remote-module-page`: the hardware volume keys with their setting and the row „Lautstärketasten steuern den PC“ (shown while `takesVolumeKeys()`) → `feat/remote-volume-keys`.

```
# Aufgabe: Fernsteuerung – Handy-Modul mit der Seite „Medien“ und Lautstärketasten (Paket 2)

Routing: Claude Code · Fernsteuerung Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-module-media` von frischem `develop`, nach dem Merge von Paket 1b (Hotspots Plattform-Naht, Capabilities, `web/src/strings.ts`; Zeilen in docs/CHATS.md). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §2 (Seite Medien), §7 (Voraussetzung, Manifest-Tabelle, Zustands-Tabelle, Widget, Fokus-Checkliste). Lies docs/howto/new-module.md (auch „New module for some platforms only“), web/src/modules/CLAUDE.md, docs/design/MODULE-IDENTITY.md, FOCUS-GUIDELINES.md, FOCUS-WORDING.md, `modules/disk/manifest.ts` (Modul ohne Sammlungen), `src/lan_client.rs` (Schlüssel im Keystore, `spawn_blocking`), `core/platform/tauri/lanClient.ts`, `fakeLanClient.ts`.

## Pflichtliste
- Shell `src/remote_client.rs`: `remote_client_open` (Hub, Stufe, Zustands-Kanal), `remote_client_send` (ein Bündel), `remote_client_close`; eigene Verbindung über den Duplex-Client aus 1a, nicht der `Link`-Mutex des Sync; **nur** im `cfg(mobile)`-Handler und in `capabilities/mobile.json` (nicht `default.json`), `tests/commands.rs` dafür erweitern (liest heute weder den mobilen Handler noch `mobile.json`; zusätzlich: die Befehle fehlen in `default.json` und `desktop.json`); Schlüssel bleiben in Rust. Älterer PC: Eingabe-Sitzung scheitert, Sync-Sitzung geht → eigener Zustand „PC zu alt“.
- Signale der Crate richtig lesen (Kopf von `transport/input_client.rs`): `NoAnswer` + Sync-Sitzung geht = „PC zu alt“; `NoAnswer` hat mehrere Ursachen (alter Hub, falscher Hub-Schlüssel, Hub wehrt zu viele Verbindungsversuche ab): „zu alt“ erst nach zweimal `NoAnswer` im Abstand einiger Sekunden mit gelungener Sync-Runde dazwischen, `NoAnswer` + Sync scheitert = nicht erreichbar; bis zur Entscheidung die unverbundene Zeile „PC-Sven“, die Sync-Runde stößt das Modul selbst über die Naht an; `Protocol` beim Öffnen (auch: unbekannter Ablehnungs-Code eines neueren PCs) = unverbundener Zustand + „Erneut versuchen“; sagt auch die Sync-Sitzung „nicht gekoppelt“, gilt die Zeile „Noch kein PC gekoppelt“; nur ein `open` zugleich, neu öffnen höchstens etwa einmal je Sekunde und nie je Tastenwiederholung (der Hub zählt 20 Verbindungsversuche je Minute, Sync eingeschlossen); `Network` = nicht erreichbar; ein Sendefehler (`Closed`, `Network`) ist nie ein eigener Zustand; `UnknownDevice` = dieses Netz nimmt keine Eingabe an oder nicht mehr gekoppelt – **nie deswegen entkoppeln**, ob gekoppelt sagt allein die Sync-Sitzung (eigene Zeile in der Zustands-Tabelle); `Closed(None)` = Zustand „nicht verbunden“, beim nächsten Tippen neu öffnen; nach eigenem Senden antwortet der PC binnen etwa einer halben Sekunde mit seinem Zustand, auch unverändert – bleibt das ein paar Sekunden aus: „nicht verbunden“. Halten von Lauter/Leiser am Handy auf ≤ 5 Schritte/s begrenzen.
- Naht `remote` (Vertrag, Brücke, Web-Stub, `fakeRemote.ts` mit Demo-PC „PC-Sven“, Lautstärke 42 %).
- Modul `remote` per `npm run gen:module`: `platforms: ['android']`, Bereich System, Identität laut CONCEPT §7 (`check:modules` entscheidet), `layout: 'full'`, keine Sammlungen, `dataApi: false`, `BLOCKED_MODULES`, `exclusion.test.ts`, `seed: { none: 'live-data' }`, `noOnboarding`, `maturity: 'preview'`, Einstellungen (Haptik, Bildschirm anlassen).
- Seite mit `PageHeader`/`PageTitle`, zunächst nur Medien (die Tabs Touchpad und Tastatur kommen mit Paket 3/4, bis dahin kein Platzhalter); Medien: unterste Reihe Leiser · Lauter, darüber Vorheriger · Wiedergabe / Pause · Nächster (CONCEPT §2), Zustandszeile, „Ton aus“ und „PC sperren“ im Menü; **jeder** Zustand der Tabelle in CONCEPT §7 mit seinem Satz und seinem einen Schritt.
- Lautstärketasten des Handys steuern den PC, nur solange eine Sitzung offen ist (`plugins/screen-mode`, Kotlin; über die Naht; Schalter, Standard an; ruhige Zeile „Lautstärketasten steuern den PC“ nur dann; nach einem Leerlauf-Ende zählt ein Tastendruck als Berührung und verbindet neu; nur in abgelehnten oder nicht erreichbaren Zuständen bleiben die Tasten beim Handy). Die Seite Medien öffnet immer mit `open { media }`. Halten wiederholt (≤ 5/s); „Lauter“ hebt „Ton aus“ auf. Sitzung öffnet, wenn das Modul in den Vordergrund kommt.
- Widget `StatusWidget` (Zustand „PC-Sven“ + Aktion „Öffnen“; die Aktion „Wiedergabe / Pause“ folgt in Paket 5); öffnet keine Verbindung beim Anzeigen.
- Tests: Einheit (Zustände → Texte, Bündel), e2e mit Fake im Handy-Viewport, `check:modules`, `widgets.test.tsx`, `registry.test.ts`.

## Nicht in diesem Paket
Touchpad, Tastatur, Widget-Aktion, Handy-Entsperren (kommt mit Paket 3, erst die volle Stufe braucht es), Bedienung vom Android-Sperrbildschirm, Änderungen an der PC-Seite außer Fehlern aus 1a/1b.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `check:modules`, `e2e`, Rust-Checks grün; Handtest Pixel + Windows-PC, **zugleich die Handtests aus 1a/1b**: Pause, Nächster, lauter/leiser (Knöpfe und Tasten), PC sperren, Medien hinter dem Sperrbildschirm, zwei Player, WLAN weg und wieder da, „Beenden“ am PC → Text am Handy, Tray-Variante. Ein Player ohne Medien-Sitzung, der sich nicht pausieren lässt: als Frage an Sven, kein Tasten-Ersatz.
- Fokus-Checkliste im PR-Text, Bildschirmfotos (nur Testdaten); Docs wie Paket 1; `npm run gen:modules`; „Wartet auf Sven“ auf Paket 3.

## Skills
`council` über den Diff (Guardian: Client hält keine Freigabe-Logik, die der PC nicht selbst prüft, Schlüssel bleiben in Rust, nichts geloggt, Modul für KI/Daten-API unsichtbar; Architect: Naht, Modul nur auf dem Handy, kein zweiter Sync-Weg; Advocate: einhändig ohne Hinsehen, Zustandstexte, keine blinkende Anzeige, Daumenzone). Danach `full stop`.
```

### Prompt – package 3: touchpad and clicks (`feat/remote-touchpad`)

Split in three PRs (one topic each): **part 1** `feat/remote-touchpad-host` = `remote-input` pointer (`src/pointer.rs`, `SendInput` mouse only, own thread) and the shell sink forwarding move/button/scroll. **Part 2** `feat/remote-full-notice` = the PC's quiet notification when a session of the full level opens (Rust, once per device in 30 minutes). (Part 2 has no off switch: it belongs next to the level "Maus und Tastatur" in the PC's settings, which part 3 offers for the first time – part 3 adds the switch – held in Rust, device-local, default on, off only through the native dialog (it loosens an option) – and the level must not be offered without it: ☐ switch exists before `RemoteHostSection` offers "Maus und Tastatur".) **Part 3** `feat/remote-touchpad` = the phone: level `full` in `remote_client_open` with the native unlock, the page Touchpad, gestures as a pure function, texts, e2e. Part 3 starts with the measurement on a real phone (below); parts 1 and 2 do not depend on it.

What part 3 gets from part 1: wheel unit = 1/8 notch per wire unit, `dy > 0` moves the view down and `dx > 0` to the right (the page decides "natural" direction before sending); a spare release is harmless; the PC sums moves that wait, so the phone never needs to merge for the PC's sake.

```
# Aufgabe: Fernsteuerung – Touchpad, Klicks, Scrollen (Paket 3)

Routing: Claude Code · Fernsteuerung Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-touchpad` von frischem `develop`, nach Paket 2; kein LAN-Sync-PR offen (Hotspot `crates/lan-sync`, Zeile in docs/CHATS.md). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §2 (Gesten-Tabelle, Randstreifen), §3 (Latenz, Bündeln je Bild), §4 (volle Stufe, Handy-Entsperren, gesperrter PC), §6 (Abbildung auf `SendInput`). Prototyp-Zahlen CONCEPT §3.

## Pflichtliste
- **Zuerst messen** (vor dem Seitenbau): Pointer-Ereignis in der Seite → am PC angewendet, echtes Handy im WLAN, ein `invoke` je Ereignis; Messmodus nur im Dev-Build, ohne Protokoll in der App; Tabelle in CONCEPT §3 ergänzen. Ziel p95 < 30 ms für unseren Teil; verfehlt → STOPP mit Vorschlag (Berührungen im Kotlin-Plugin erfassen).
- `lan-sync`: nur was 1a offen ließ (Senke führt `move`, `button`, `scroll` aus); das Loslassen gehaltener Maustasten am Sitzungsende macht die Crate seit 1a.
- `remote-input`: `SendInput` für Zeiger, Tasten links/rechts, Rad senkrecht/waagrecht. Ein überzähliges Loslassen einer Maustaste muss die Senke vertragen (`lan-sync` lässt am Sitzungsende die Tasten dieser Sitzung los). Solange `state.locked`, sendet das Handy keine Zeiger- oder Tasten-Records (der Hub zählt sie sonst als verworfen und schließt bei anhaltender Flut mit `limit`).
- Seite Touchpad: folgt der Lage des Handys, nicht immersiv, Bildschirm bleibt an; Gesten laut Tabelle als reine Funktion „Berührungen → Records“ (getestet); Streifen Links/Rechts über der Gestenzone (unterer Safe-Area-Abstand + ein Abstandsschritt), Ziehen = Links halten; Empfindlichkeit; einmalige, schließbare Legende; je Pointer-Ereignis sofort senden (zusammengefasste Bewegungen summiert), kein Timer; nur bei ausstehendem Schreiben summieren.
- Stufenwechsel und Handy-Entsperren: Medien bleibt eine `media`-Sitzung; die erste Nutzung von Touchpad/Tastatur schließt sie und öffnet neu mit `open { full }`. `remote_client_open` fragt für die Stufe `full` vorher **nativ in Rust** nach dem Entsperren, wenn `unlockRequired` (nicht in der Seite; Ausgangspunkt `plugins/secure-store`, `biometric_*`), höchstens einmal in 8 Stunden, solange Nemo läuft (nur im Speicher des Prozesses); ohne Entsperren entsteht keine volle Sitzung (Test); Gerät mit Freigabe `media`: Touchpad/Tastatur zeigen sofort ihren Satz, keine Abfrage, kein Neuöffnen (Test); die Medien-Sitzung bleibt bis zum gelungenen Entsperren offen; eine volle Sitzung trägt auch Medien; ohne eingerichtete Sperre: Hinweis statt Blockade; beide Zustände mit ihren Sätzen aus CONCEPT §7.
- PC: eine ruhige Systembenachrichtigung, wenn eine Sitzung der vollen Stufe öffnet (nie bei einer Medien-Sitzung, gleich welche Freigabe) (aus Rust, höchstens eine je Gerät in 30 Minuten – nur im Speicher gezählt –, ohne Ton, abschaltbar).

## Nicht in diesem Paket
Text, Tasten, Ziehen per langem Druck, Pinch, Drei-Finger-Gesten, Zeiger-Beschleunigung in eigener Regie (Windows macht sie).

## Abnahme
Checks wie Paket 2; Handtests in MANUAL-TESTS (Klick, Doppelklick, Rechtsklick, Ziehen, Scrollen, erhöhtes Fenster, Sperren während des Ziehens, Nemos Freigabe-Dialog lässt sich vom Handy aus nicht bestätigen); Fokus-Checkliste; Docs; „Wartet auf Sven“ auf Paket 4.

## Skills
`council` (Guardian: Stufe je Ereignis, Limits, keine Koordinate geloggt oder gespeichert, Entsperren nativ und als Bremse beschrieben, kein Erhöhen während Steuerung, Benachrichtigung aus Rust; Architect: Gesten als reine Funktion, kein Stau, Loslassen am Ende; Advocate: ohne Hinsehen, Legende, Reizlast im Vollbild). Bis 5 Runden. Danach `full stop`.
```

### Prompt – package 4: keyboard and special keys (`feat/remote-keyboard`)

```
# Aufgabe: Fernsteuerung – Text senden und Sondertasten (Paket 4)

Routing: Claude Code · Fernsteuerung Paket 4 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-keyboard` von frischem `develop`, nach Paket 3; kein LAN-Sync-PR offen (Hotspot `crates/lan-sync`). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
CONCEPT §2 (Seite Tastatur), §5 (Zeilen „Tastatur als Angriffsweg“, „Mitleser“), §6 (Tasten-Liste, `KEYEVENTF_UNICODE`).

## Pflichtliste
- `lan-sync`: nur was 1a offen ließ (Senke führt Text und `key(id)` aus); weiter keine rohen Tastencodes, keine frei wählbaren Kombinationen.
- `remote-input`: Text als Unicode-Eingabe; Tasten-Liste aus CONCEPT §6; Umschalttasten werden im selben Aufruf gedrückt und gelöst.
- Seite Tastatur: ein Textfeld mit Fokus (`data-autofocus`); die Enter-Taste der Handy-Tastatur sendet Zeile + Enter, „Senden“ sendet ohne Enter; Tasten und Reihen genau laut CONCEPT §2 („Rücktaste“, Pfeil-Kreuz, „Mehr“; bei offener Handy-Tastatur nur Feld + „Senden“); Feld ohne Verlauf, ohne Speicherung, ohne Lesehilfe (`NoReadAid`), nach dem Senden leer; Autovervollständigen des Handys bleibt.
- Tests: Codec-Tabellen (Steuerzeichen, Überlänge, unbekannte Id), Quelltext-Test „kein Text/keine Taste in Logs, Diagnose, Speicher“, e2e mit Fake.

## Nicht in diesem Paket
Live-Tippen Zeichen für Zeichen, Zwischenablage, Makros, eigene Tastenkürzel, Win-Taste.

## Abnahme
Checks wie Paket 3; Handtests (Umlaute, Emoji, langes Wort, Enter getrennt, gesperrter PC, erhöhtes Fenster); Fokus-Checkliste; Docs; „Wartet auf Sven“ auf Paket 5.

## Skills
`council` (Guardian: feste Liste, kein Weg für rohe Codes, Logging-Verbot und Diagnose-Negativliste, Text nirgends gespeichert; Architect: Codec, keine zweite Tasten-Tabelle; Advocate: tippen – lesen – senden, Sondertasten auffindbar). Bis 5 Runden. Danach `full stop`.
```

### Prompt – package 5: widget and polish (`feat/remote-polish`)

```
# Aufgabe: Fernsteuerung – Widget-Aktion, Nutzer-Doku, Reife „stable“ (Paket 5)

Routing: Claude Code · Fernsteuerung Paket 5 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/remote-polish` von frischem `develop`, nach Paket 4. Vorgegebene Session-Branches ignorieren. Keine Hotspots.

## Ausgangslage
CONCEPT §7 (Widget), offene Handtests aus den Paketen 1a–4.

## Pflichtliste
- Widget: eine Aktion „Wiedergabe / Pause“ (ein Tipp verbindet und sendet), Zustand „PC-Sven“, Lautstärke nur während einer offenen Sitzung; ein Tipp, der nicht geht, zeigt den Satz des Zustands (CONCEPT §7), sein Schritt öffnet das Modul; leerer Zustand „PC koppeln“.
- Reife von Modul und Einstellungs-Abschnitt auf `stable`, wenn alle Handtests bestanden sind; sonst Liste der offenen Punkte und `preview` bleibt.
- Nutzer-Doku `docs/user/` DE + EN (kurz: Voraussetzung Heimnetz-Kopplung, einschalten, Stufen, beenden und wieder einschalten).

## Nicht in diesem Paket
Bedienung vom Android-Sperrbildschirm/aus der Benachrichtigungsleiste (eigenes Paket, falls Sven es will), Wake-on-LAN, Makros, Titelanzeige, zweiter PC als Fernbedienung, Linux/macOS.

## Abnahme
Checks wie zuvor, `check:readme`, `check:doclinks`; Fokus-Checkliste; Docs; „Wartet auf Sven“-Zeile entfernen oder auf die offenen Handtests stellen.

## Skills
`council` (Guardian: Widget öffnet nichts ohne Tipp; Architect: kein zweiter Verbindungsweg; Advocate: Widget verständlich, Doku ohne Fachwörter). Danach `full stop`.
```
