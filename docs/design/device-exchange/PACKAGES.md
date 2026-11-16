# Device exchange – packages (prompts)

Decisions: [CONCEPT.md](CONCEPT.md) §11 and [`docs/decisions/core-device-exchange.md`](../../decisions/core-device-exchange.md). One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Order R ∥ 1a → 1b → 2 → 3 → 4, a stop after each. **Never parallel to an open LAN-sync or remote-control package or PR** (`crates/lan-sync`, `src/lan_*.rs`, `src/remote*.rs` are shared); check `npm run chats:status` and the notes repo (`rounds/`, `board/`) first and write a heads-up there.

| #   | Package                            | Branch                      | Scope                                                                                                                                                                                                                                                                                                                                        | Hotspots to announce                                                                                | Skills                                                 |
| --- | ---------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| R   | Rule line                          | `docs/device-exchange-rule` | root `CLAUDE.md` one line, new `docs/rules/device-exchange.md`, index line in `docs/RULES.md`; Sven merges; does not block 1a (the packages already follow the proposal)                                                                                                                                                                     | root `CLAUDE.md`, `docs/RULES.md`                                                                   | `review-loop`, `full stop`                             |
| 1a  | Hub: exchange session, items       | `feat/exchange-hub`         | `crates/lan-sync` only: mode 4, `exchange/` (wire, gate, session), trust field `exchange`, item outbox trait, duplex client `transport/exchange_client.rs`, rule tests – all testable on Linux                                                                                                                                               | `crates/lan-sync`                                                                                   | `council`, `full stop`                                 |
| 1b  | Module with text and links         | `feat/exchange-module`      | shell `src/exchange.rs` (PC: grant commands, outbox file) + `src/exchange_client.rs` (phone), `build.rs`, capabilities, seam `exchange` + fake, module `exchange` (page, cards text/link, widget, seed, settings, first-run step, privacy test, `BLOCKED_MODULES`), signature `handoff`, de/en                                               | `core/platform/types.ts`, `core/platform/tauri/index.ts`, capabilities, `strings.ts`, `ui/identity` | `council`, `full stop`                                 |
| 2   | Files and images                   | `feat/exchange-files`       | offer/accept/chunk/end/resume, receiver folder (Rust folder dialog), name cleaning (extend `crates/downloader/src/name.rs` or move it to a shared crate), `Zone.Identifier`, risk class, accept limit, free-space check, thumbnails, PC drop + Rust file dialog, phone picker + app storage + _Teilen_/_Speichern unter_; device measurement | `crates/lan-sync`, `core/platform`, `Cargo.toml`/lock                                               | `council`, `full stop`                                 |
| 3   | Share target and „An Handy senden“ | `feat/exchange-share`       | `plugins/share-intent` (`image/*`, `*/*`, `SEND_MULTIPLE`, copy to cache), `pages/ShareTarget.tsx` („An PC senden“), `core/exchange/send.ts` (event), one menu entry in Merkliste, Notizen, Browser                                                                                                                                          | `plugins/share-intent`, `router.tsx`, `core/events`                                                 | `council`, `full stop`                                 |
| 4   | Clipboard, several files, polish   | `feat/exchange-polish`      | _Zwischenablage senden_ (sensitive check), multi-select/drag several, retention cleanup, notification per burst, widget, user docs de/en, maturity                                                                                                                                                                                           | `strings.ts`                                                                                        | `review-loop` (`council` if a rule moves), `full stop` |

Each package: own branch from fresh `develop`, PR against `develop`, `.changes/` note (DE/EN; R: label `no-changelog`), decisions in `docs/decisions/core-device-exchange.md`, the focus checklist (1–9) answered in the PR text, hand tests added to `docs/MANUAL-TESTS.md` (ids `AX…`; the channel cannot be proven on a real phone in CI). 1a cannot be tried by hand (no client UI yet): proven by Rust tests; 1b carries its hand tests. Council: Guardian (permission, file safety, never run, AI separation, logging) is mandatory in every package.

### Prompt – package R: rule line (`docs/device-exchange-rule`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Closing: #closing · PR: #pr-text
Routing: Claude Code · Austausch – Hard-Rule-Zeile (Paket R, nur Doku) · Opus

# Aufgabe: Austausch – Regelzeile und Volltext
Lies docs/design/device-exchange/CONCEPT.md §6 (Vorschlag) und docs/rules/remote-control.md (Form).
## Pflichtliste
- Root `CLAUDE.md`: die Zeile aus CONCEPT §6, kurz wie die anderen (check:docs Startbudget halten).
- `docs/rules/device-exchange.md`: Volltext (Modus 4, Heimnetz, Freigabe am PC, Standard aus, nie über das Netz setzbar; Dateien nur auf der Platte, Pfade nur in Rust, kein Befehl nimmt einen Pfad; Namen bereinigt, nie öffnen/ausführen, Risiko-Liste; Zwischenablage nur auf Tipp, nie automatisch schreiben; kein aiSchema/searchable/dataApi; nie Inhalte, Namen, Größen loggen).
- `docs/RULES.md` eine Indexzeile; Entscheidungs-Bullet.
## Abnahme
check:docs grün; Label no-changelog; Sven merged.
## Skills
review-loop (eine Runde), file-pr, babysit-pr. Full stop.
```

### Prompt – package 1a: hub – exchange session (`feat/exchange-hub`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Closing: #closing · PR: #pr-text
Routing: Claude Code · Austausch – Austausch-Sitzung im LAN-Hub (Paket 1a) · Opus

# Aufgabe: Austausch – Modus 4, Nachrichten und Links im Hub (nur crates/lan-sync)
Lies CONCEPT.md §4 und §6, docs/RULES.md „LAN sync“, docs/rules/remote-control.md (Muster), crates/lan-sync/src/{noise,hub,input,trust,transport} und tests/rules.rs.
## Pflichtliste
- `MODE_EXCHANGE = 4` (frame.rs, `Mode`), Kappe 256 → 65 535 erst nach `hello`; nur auf Heimnetz-Bindung (wie Modus 3), sonst authentisiertes `unknown-device`.
- `src/exchange/`: Wire (Tags 0x30–0x3f, binär, Längen geprüft, UTF-8 geprüft; in 1a nur open/opened/refused/item/ack/ping, die Datei-Tags reserviert), Gate (Modul am PC an, Freigabe `exchange {on, paused}` in trust.json, Rate 300/h), Sitzung (Eingang → Trait `ExchangeSink::item`, Ausgang aus Trait `ExchangeOutbox` je Gerät, ack-basiert).
- Registry mit Modus; Kopplung lösen schließt alle, Austausch pausieren nur Modus 4.
- Duplex-Client `transport/exchange_client.rs` (Leser-Thread, `ping` alle 60 s), auf allen Zielen kompiliert; Hub-Teile nur Desktop.
- Regeltests: Tags getrennt (Sync/Input/Austausch), keine Netz-Nachricht erreicht einen Setter, kein Logging, Hub-Module auf Mobile ausgeschlossen.
## Nicht in diesem Paket
Shell, Web, Dateien.
## Abnahme
cargo fmt/clippy/test für lan-sync grün; Windows-Check; Entscheidungs-Bullet; .changes (unsichtbar → kurz „Vorbereitung“) oder no-changelog mit Begründung.
## Skills
council (Guardian Pflicht: Freigabe, nie über das Netz setzbar, Logging; Architect: keine Vermischung mit Sync/Input), file-pr, babysit-pr. Full stop.
```

### Prompt – package 1b: module with text and links (`feat/exchange-module`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Closing: #closing · PR: #pr-text
Routing: Claude Code · Austausch – Modul mit Nachrichten und Links (Paket 1b) · Opus

# Aufgabe: Austausch – Modul, Shell-Anbindung, Text und Links
Lies CONCEPT.md §2, §3, §5–7, docs/howto/new-module.md, web/src/modules/CLAUDE.md, MODULE-IDENTITY.md (4.0), FOCUS-GUIDELINES.md; Muster: modules/remote, src/remote.rs, src/remote_client.rs, core/platform/tauri/remote*.ts.
## Pflichtliste
- Shell PC `src/exchange.rs`: Sink/Outbox aus 1a (Outbox-Datei je Gerät in App-Daten), Befehle `exchange_status`, `exchange_send`, `exchange_set_device` (nur Desktop), Events an die Web-Ansicht; Handy `src/exchange_client.rs` (öffnet bei Start/Vordergrund/WLAN-Wechsel/60 s, hält die Sitzung offen solange die Seite sichtbar ist). build.rs, capabilities, tests/commands.rs.
- Seam `exchange` in core/platform (types, tauri, web = nicht verfügbar) + Fake für e2e.
- Modul `exchange`: platforms desktop+android, area system, identity teal/ocean, head standard, widget status, Signatur `handoff`; Tabelle `exchange_items` local: true (db:bump), Aufbewahrung 30 Tage; Seite mit Karten Text/Link, Feld + Senden, Zustände als Text; Ersteinrichtung am PC (Geräte vorausgewählt, ein Klick); Seed; Einstellungen über Registry; kein aiSchema/searchable, dataApi false, `BLOCKED_MODULES`; privacy.test.ts.
- de/en Texte; Nutzer-Doku folgt in Paket 4.
## Abnahme
check, test, e2e (Fake: Text hin und her, Warteschlange, Handy-Viewport), check:modules, check:i18n; Handtests AX1–AX4 in MANUAL-TESTS; Screenshots im PR.
## Skills
council (Guardian Pflicht: KI-Trennung, keine Pfade/Inhalte im Log; Architect: Plattform-Naht; Advocate: „an mich selbst schicken“, ruhige Zustände), design:design-critique, design:ux-copy, file-pr, babysit-pr. Full stop.
```

### Prompt – package 2: files and images (`feat/exchange-files`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Closing: #closing · PR: #pr-text
Routing: Claude Code · Austausch – Dateien und Bilder (Paket 2) · Opus

# Aufgabe: Austausch – Dateien in Blöcken, Ablageordner, Sicherheit beim Empfang
Lies CONCEPT.md §4–6 und proto/ (Messung, Namensregeln, Risiko-Liste); crates/downloader/src/name.rs.
## Pflichtliste
- Wire offer/accept/wait/refuse/chunk/end/result/cancel; eine Übertragung je Sitzung; Hash beim Schreiben, Fortsetzen aus `.part` (24 h), Prüfsumme, Größen-/Speicher-/Annahme-Grenzen; PC → Handy-Chunks nicht an den 200-ms-Takt gebunden (messen).
- Namen bereinigen (alle Fälle aus proto/run.mjs + Windows), eindeutig, Risiko-Klasse, Windows `Zone.Identifier` (ZoneId 3); Pfade nur in Rust, kein Befehl nimmt einen Pfad (Rust-Dateidialog, natives Drag & Drop), Ordnerwahl per Rust-Dialog, Standard Downloads/Nemo.
- Handy: Picker, App-Speicher (Deckel 2 GB), Teilen / Speichern unter; Vorschaubilder auf dem Empfänger (nie SVG/HEIC).
- Karten Bild/Datei mit Fortschritt, Abbrechen, „Annehmen“; gefährliche Endungen ohne Öffnen, mit Warnzeile.
- Messung auf echtem Handy + PC (MB/s, Touchpad-Latenz während Übertragung) als MANUAL-TESTS-Zeile; CONCEPT §10 ergänzen.
## Abnahme
cargo + web checks, e2e mit Fake (Drop, Fortschritt, Abbrechen, gefährliche Datei), Handtests AX5–AX9.
## Skills
council (Guardian Pflicht: Datei-Sicherheit, nie ausführen, Pfade; Architect: Speicherort außerhalb der DB), file-pr, babysit-pr. Full stop.
```

### Prompt – package 3: share target and „An Handy senden“ (`feat/exchange-share`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Closing: #closing · PR: #pr-text
Routing: Claude Code · Austausch – Teilen-Ziel und „An Handy senden“ (Paket 3) · Opus

# Aufgabe: Austausch – aus anderen Apps und Modulen senden
Lies CONCEPT.md §2, §7; plugins/share-intent, pages/ShareTarget.tsx, core/events.
## Pflichtliste
- share-intent: ACTION_SEND/SEND_MULTIPLE für image/* und */*, Kotlin kopiert in den Cache (Größe begrenzt), Rust bekommt Tokens; Text bleibt wie heute.
- ShareTarget: „An PC senden“ zuerst, wenn Austausch an und PC gekoppelt.
- `core/exchange/send.ts` (canSendToDevice, sendToDevice → Event), Modul abonniert in services; je ein Menüeintrag „An Handy senden“ in Merkliste, Notizen, Browser (keine Modul-Importe, kein Manifest-Vertrag geändert).
- „Als ToDo / Als Notiz“ auf Textkarten über die bestehenden Schnellerfassungsziele.
## Abnahme
check, test, e2e (Handy-Viewport Teilen, Menüeintrag), Handtests AX10–AX12.
## Skills
council (Guardian Pflicht; Advocate: Teilen-Ziel in 3 Taps), design:ux-copy, file-pr, babysit-pr. Full stop.
```

### Prompt – package 4: clipboard, several files, polish (`feat/exchange-polish`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Closing: #closing · PR: #pr-text
Routing: Claude Code · Austausch – Zwischenablage, mehrere Dateien, Politur (Paket 4) · Opus

# Aufgabe: Austausch – Zwischenablage senden, Mehrfachauswahl, Benachrichtigung, Nutzer-Doku
## Pflichtliste
- Handy „Zwischenablage senden“: nur auf Tipp lesen, EXTRA_IS_SENSITIVE → Rückfrage, Nemo-eigene sensible Kopie nie anbieten; PC nur „Kopieren“ (Option „gleich übernehmen“, aus).
- Mehrere Dateien (Picker, Drag), Gruppenzeile; Ordner-Hinweis „als ZIP“.
- Benachrichtigung je Schwung über die Policy, Schalter; Widget-Feinschliff; Aufräumen nach Aufbewahrung.
- docs/user/exchange.md + .de.md; Reife nach Handtests.
## Abnahme
check, test, e2e, check:readme, Handtests AX13–AX15.
## Skills
review-loop (council, falls eine Regel berührt wird), design:design-critique, file-pr, babysit-pr. Full stop.
```
