# Launch review 2 – packages (prompts)

Findings and evidence: [LAUNCH-REVIEW-2026-11.md](LAUNCH-REVIEW-2026-11.md). One package = one chat, one branch from fresh `develop`, one PR against `develop`; paste one prompt per chat. Order = order of the blockers. "Sven merges" = the package touches a hard-limit area (signing, secrets, gitleaks configuration, artifact audit, `release.yml`, sync encryption, crypto, vault logic, `guard.rs`) or needs GitHub settings; the chat never merges. Every package: a test that is red before, `.changes/*-security.md` (de + en), hand tests into [../MANUAL-TESTS.md](../MANUAL-TESTS.md) next to the `SEC-…` block, `council` with a Guardian. Delete this file in the PR that closes the last package.

| # | Package | Branch | Findings | Blocks | Who merges |
|---|---|---|---|---|---|
| 0 | SC1 (no chat) | – | steps of the private note; list "For the maintainer in GitHub" | exe, APK, website | Sven, by hand |
| 1 | Release pipeline: signing only where it belongs | `ci/security-release-guard` | SC2, SC3, SC4, SC9, SC10, NS4 (and what the private note assigns to it) | exe, APK (condition) | Sven |
| 2 | "Alle Daten löschen" also wipes the native stores | `fix/security-reset-native` | R1, R2, R3 | exe, APK | Sven |
| 3 | Downloads and torrent hardening | `fix/security-downloads-hardening` | DL1–DL11 | exe (condition) | – |
| 4 | Android update: flavour and version | `fix/security-update-auth` | NS2, NS3, S13 (decision) | APK (condition) | Sven |
| 5 | Vault bridge first instance, overlay host | `fix/security-bridge-first-instance` | X2, X4 | extension, exe (condition) | Sven |
| 6 | Sync token into the secret store | `fix/security-sync-token-store` | S5 | exe, APK, PWA (condition) | Sven |
| 7 | Chat stays with its provider | `fix/security-ai-provider-pin` | AI1 | exe, APK, PWA (condition) | – |
| 8 | Home network and remote control, small hardening | `fix/security-lan-hardening` | H1, H2, H4, H5, H6, H10, F1, F2, F3, E1–E5 | – | – (H3, H10 rule text: Sven) |
| 9 | Android: manifest, lock screen, clipboard | `fix/security-android-surface` | NS5, NS6, NS8 (V4) | – | – |
| 10 | Web layer and server lows | `fix/security-web-lows` | R5, R6, R8, M2, M5, M6, Q1, Q2, Q3, B1–B3, PC2, PC3, N9, SC6, SC7; V5 only if not accepted | – | – |
| 11 | Privacy texts, second pass | `docs/security-privacy-texts-2` | D9, D10 (rest), D11, D13, M7, F5 | – | – |

Not packaged – info items and lows whose recommendation is "accept for 1.0": H7–H9, F4, F6, F7, E6–E9 (review with the exchange file packages), B4–B7, PC4, PC5, A5 (low, accept), A9–A11, MOD1, MOD2, NS9, NS10, Q4, Q5, SC5 (low, accept: not reachable), SC8, SC11, D15, V9, T6–T8, P5 (low, accept). Mediums with recommendation accept: S13, V5.

### Prompt – package 1: release pipeline (`ci/security-release-guard`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 1 – Release-Pipeline: Signieren nur beim Veröffentlichen · Opus

# Aufgabe (unbeaufsichtigt): SC2, SC3, SC4, SC9, SC10, NS4 aus docs/security/LAUNCH-REVIEW-2026-11.md
Lies den Bericht, docs/howto/release-deps.md, docs/architecture/releases.md, PR #542 (geparkt; nichts daraus übernehmen, ohne es zu nennen). Sven legt diesem Prompt die private Notiz zu SC1 bei: was sie diesem Paket zuweist, gehört dazu; ihr Inhalt steht nie in Repo, PR-Text, Commit oder Scribble.
## Pflichtliste
- SC3: Signier-Secrets und APK-Signatur nur bei `publish == 'true'`. SC4: kein Cache-Restore im veröffentlichenden Build.
- SC2: eigene Secret-Namen für den Dev-Keystore (Sven legt sie an; ohne sie stoppt der Job mit klarer Meldung wie beim Dev-Updater-Schlüssel).
- SC9/NS4: `audit-release.mjs` schlägt beim Veröffentlichen auf einem leeren Ordner fehl; geprüft wird das zusammengeführte Manifest der signierten APK (Berechtigungen, exportierte Komponenten, Klartext aus) gegen eine Erlaubt-Liste. SC10: veraltete Zeile in `.gitleaksignore` nur als Vorschlag.
- Nichts abschwächen: gitleaks, Artefakt-Audit, Schlüsselprüfung bleiben mindestens so streng.
## Abnahme
Tests in `web/scripts/lib/*.test.ts` vorher rot; Probelauf-Log im PR-Text; `git diff --stat` im PR-Text; was Sven in GitHub anlegen muss, als Liste.
## Skills
council (Guardian: wo Schlüssel neben Code aus einem Branch liegen). Mergt Sven selbst. Full stop.
```

### Prompt – package 2: reset wipes the native stores (`fix/security-reset-native`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 2 – „Alle Daten löschen“ räumt auch Heimnetz, Freigaben und native Dateien · Opus

# Aufgabe (unbeaufsichtigt): R1, R2, R3
Lies docs/security/LAUNCH-REVIEW-2026-11.md (R1–R3 und die Liste „not cleared today“), docs/rules/remote-control.md, RULES „LAN sync“, web/src/core/reset/device.ts, web/src-tauri/src/lan_sync.rs. Hotspot `crates/lan-sync`: vorher `npm run chats:status` und Heads-up im Notizen-Repo.
## Pflichtliste
- Ein nativer Befehl (nur Webview `main`), den `resetDevice` vor dem Löschen der Datenbank ruft: Hub stoppen, Sitzungen schließen, Ordner `lan-sync/` (Vertrauensliste, hub.db, Heimnetz, Port, Freigaben, Programme, Austausch) und beide Schlüsselbund-Einträge des Hubs löschen; am Handy `lan_client_unpair` und `exchange/inbox.json`. Kein Pfad vom Webview.
- Ebenfalls: `downloads.json`, `torrent-state/` (Engine vorher stoppen), `browser_clear_data`, `pc-care/journal.json` (nur wenn leer oder nach Rückfrage im Dialogtext – entscheide und begründe), `logs/panic.log`, Native-Messaging-Manifest samt Registry-Eintrag, `models/` als Auswahl im Dialog.
- R2: `share.code.*` löschen (Namen vor dem DB-Löschen lesen). R3: `disablePush()` best effort.
- Ein fehlschlagender Schritt hält den Reset nicht auf; der Dialogtext nennt, was gelöscht wird (de + en).
## Abnahme
Rust-Test: nach dem Befehl kein Listener, Ordner und Schlüssel weg; Vitest mit Fake-Plattform: Reihenfolge und Fehlertoleranz; Handtest SEC-2 aktualisieren.
## Skills
council (Guardian: was ein früher gekoppeltes Gerät und wer den PC übernimmt danach noch kann). Mergt Sven selbst. Full stop.
```

### Prompt – package 3: downloads and torrent (`fix/security-downloads-hardening`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 3 – Downloads und Torrent härten · Opus

# Aufgabe (unbeaufsichtigt): DL1–DL11
Lies den Bericht (Abschnitt Downloads), web/src-tauri/crates/{downloader,torrent}, src/{downloads,torrent}.rs, modules/downloads. Zuerst im Quelltext von librqbit 9.1.0 klären (im PR-Text festhalten): wie Dateipfade aus der Metainfo behandelt werden (`..`, absolut, reservierte Namen), ob `Session::stop` Listener und DHT schließt.
## Pflichtliste
- DL1: nie überschreiben (eigener Unterordner oder Vorabprüfung; Fortsetzen eines eigenen Torrents bleibt möglich).
- DL2: Engine stoppt, wenn das Modul oder der Torrent-Teil ausgeht und beim Schließen ins Tray ohne aktive Torrents; sichtbare Zeile „Torrent läuft“.
- DL3: `Zone.Identifier` (ZoneId 3) nach dem Umbenennen, auch für Torrent-Dateien.
- DL4/DL5: private, Loopback- und Link-Local-Ziele ablehnen, Weiterleitungen je Sprung prüfen (höchstens 3), https→http nicht folgen; Tracker-Adressen filtern.
- DL6: Zielordner nur aus der nativen Ordnerwahl (Token in Rust) oder dem Download-Ordner; `desktop.json`-Beschreibung berichtigen.
- DL10: Torrent-Schalter, DHT, UPnP und Zielordner gerätelokal (nicht im Sync); ein vorbelegter Ordner wird nativ geprüft wie DL6.
- DL7–DL9, DL11: Lese-Timeout, Namensbereinigung (ein gemeinsamer Bereiniger mit `crates/lan-sync/src/exchange/name.rs`), Adressen ohne Zugangsdaten speichern, beim Laden neu prüfen, `saturating_mul`.
## Abnahme
Je Punkt ein Rust-Test, vorher rot; Handtests SEC-11 und zwei neue (MotW, vorhandene Datei); Lizenz/Lock unverändert oder begründet.
## Skills
council. Full stop.
```

### Prompt – package 4: Android update (`fix/security-update-auth`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 4 – Update: Kanal und Version prüfen · Opus

# Aufgabe (unbeaufsichtigt): NS2, NS3; S13 als Entscheidungsvorlage
Lies den Bericht, web/src-tauri/src/update.rs, src/portable.rs, plugins/apk-installer, web/src/core/update/**. Signierung und Schlüssel nur lesen.
## Pflichtliste
- NS3: `validate.rs` kennt den Build-Kanal wie `update.rs`; stabile App lehnt Dev-Adressen ab.
- NS2: vor dem Tausch die Version der geprüften Nutzlast mit der laufenden vergleichen; ältere ablehnen.
- S13: drei Wege mit Aufwand und Folgen (Digest im signierten Manifest, `.apk.sig` mit dem Updater-Schlüssel, so lassen); Empfehlung, nichts bauen.
## Abnahme
Rust-Tests vorher rot; Handtests SEC-6, SEC-7 angepasst.
## Skills
council. Mergt Sven selbst. Full stop.
```

### Prompt – package 5: vault bridge (`fix/security-bridge-first-instance`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 5 – Tresor-Bridge: erste Pipe-Instanz, Overlay · Opus

# Aufgabe (unbeaufsichtigt): X2, X4
Lies docs/security/VAULT-EXTENSION.md, LAUNCH-REVIEW-2026-10-06.md (X2, X4), crates/vault-bridge/src/{ipc,server}.rs, extension/src/content/ui.ts, extension/CLAUDE.md.
## Pflichtliste
- X2: erste Instanz in `bind()` anlegen (`FILE_FLAG_FIRST_PIPE_INSTANCE`), `AddrInUse` nach oben geben, Schleife stoppt statt neu zu versuchen; die App zeigt „belegt“.
- X4: vor jedem Klick prüfen, dass der Host verbunden, sichtbar und nicht überdeckt ist; entfernt → neu anhängen.
- Bedrohungsmodell in VAULT-EXTENSION.md nachziehen.
## Abnahme
Rust-Test (Windows-Job) und Extension-Test vorher rot; Handtest SEC-1 angepasst.
## Skills
council. Mergt Sven selbst. Full stop.
```

### Prompt – package 6: sync token (`fix/security-sync-token-store`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 6 – Sync-Token in den Schlüsselspeicher · Opus

# Aufgabe (unbeaufsichtigt): S5
Lies AUDIT-2026-09-30.md (S5), web/src/core/sync/service.ts, web/src/sw.ts, core/setup/detect.ts. Sync-Verschlüsselung nicht anfassen.
## Pflichtliste
- Token über `getPlatform().secrets`; Umzug beim ersten Start (alt lesen, neu schreiben, alt löschen), in der PWA bleibt IndexedDB der Speicher (begründen, dokumentieren).
- Service Worker liest weiter nur den Schlüssel; Reset und Diagnose kennen den neuen Namen.
## Abnahme
Vitest: Umzug, Reset, kein Token in Backup/Diagnose; e2e sync grün.
## Skills
council. Mergt Sven selbst. Full stop.
```

### Prompt – package 7: chat provider (`fix/security-ai-provider-pin`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 7 – Chat bleibt bei seinem Anbieter · Opus

# Aufgabe (unbeaufsichtigt): AI1
Lies den Bericht (AI1), web/src/core/ai/router.ts + router.test.ts, modules/chat/engine.ts.
## Pflichtliste
- Ein Chat mit Verlauf oder angehängten Daten geht nur an den Anbieter, der ihn zuerst beantwortet hat; ist der gerade gesperrt, kommt eine ruhige Meldung mit „Anderen Anbieter wählen“ statt eines stillen Wechsels.
- Die Antwort nennt den Anbieter. Der Assistent (ohne Nutzerdaten) darf weiter wechseln.
## Abnahme
`router.test.ts`/Engine-Test vorher rot; privacy.test.ts grün; Texte de + en.
## Skills
council. Full stop.
```

### Prompt – package 8: home network (`fix/security-lan-hardening`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 8 – Heimnetz und Fernsteuerung: kleine Härtungen · Opus

# Aufgabe (unbeaufsichtigt): H1, H2, H4, H5, H6, F1, F2, F3, E1–E5; H3 und H10 nur als Vorschlag
Lies den Bericht, RULES „LAN sync“, docs/rules/remote-control.md, docs/design/sync-lan/CONCEPT.md. Noise, Schlüssel und Datenschlüssel nur lesen. Hotspot `crates/lan-sync`: Heads-up zuerst.
## Pflichtliste
- H1: Frist bis zum ersten authentifizierten Frame, Annahmen zählen ins Limit. H2: `open()` nur im WLAN. H4: Gesamtdauer des Kopplungsfensters. H5: Fehler zeigen, Speichern wiederholen. H6: Code am PC eintippen oder nativer Dialog.
- F1: „Abbrechen“ ist Standardtaste. F2: Gleicher-Hub-Prüfung. F3/NS7: Dateibereich der Seite einengen + Test.
- E1–E5: Grenzen je Gerät, Limit am Handy, Modul-aus erreicht den nativen Schalter, Ausgang bei Pause, Namensfilter im Dialog.
- H3: Text und Ablauf „Schlüssel erneuern nach dem Entkoppeln“ als Vorschlag im PR-Text (Sync-Verschlüsselung: Sven entscheidet). H10: mDNS je Schnittstelle binden oder den Regelsatz „nie 0.0.0.0“ auf den TCP-Listener einschränken – beide Wege mit Aufwand, Sven entscheidet (Regeltext).
## Abnahme
Rust-Tests je Punkt vorher rot; `tests/rules.rs` erweitert; Handtests SEC-3, SEC-10.
## Skills
council. Full stop.
```

### Prompt – package 9: Android surface (`fix/security-android-surface`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 9 – Android: Sicherung, Sperrbildschirm, Zwischenablage · Opus

# Aufgabe (unbeaufsichtigt): NS5, NS6, NS8
- NS5: `dataExtractionRules` (nichts in Cloud-Backup und Geräteumzug) über `web/scripts/lib/androidManifest.ts` + Test.
- NS6: Benachrichtigungen mit Sichtbarkeit „privat“, Einstellung „Inhalt auf dem Sperrbildschirm zeigen“ (aus), de + en.
- NS8: Kotlin-Befehl in `plugins/secure-store` setzt `EXTRA_IS_SENSITIVE`.
## Abnahme
Skript- und Vitest-Tests vorher rot; Handtest SEC-13.
## Skills
council. Full stop.
```

### Prompt – package 10: web layer and server lows (`fix/security-web-lows`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 10 – kleine Befunde in Web-Schicht und Server · Opus

# Aufgabe (unbeaufsichtigt): R5, R6, R8, M2, M5, M6, Q1, Q2, Q3, B1–B3, PC2, PC3, N9, SC6, SC7 (V5 nur, wenn Sven es nicht angenommen hat)
Lies den Bericht; je Befund die kleinste Änderung mit einem Test, der vorher rot ist. Höchstens zwei PRs (Web/Server · Rust). Was sich als größer zeigt, kommt als Vorschlag in den PR-Text.
## Abnahme
check, test, e2e grün; Liste „gemacht / zurückgestellt mit Grund“.
## Skills
council. Full stop.
```

### Prompt – package 11: privacy texts, second pass (`docs/security-privacy-texts-2`)

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Sicherheit Paket 11 – Datenschutztexte, zweiter Durchgang · Opus

# Aufgabe (unbeaufsichtigt): D9, D10 (Rest), D11, D13, M7, F5
- Neue Flüsse in `docs/legal/DATA-FLOWS.md` und `tLegal.flows` (de + en, ids in `core/legal/legal.test.ts`): Austausch und Fernsteuerung im Heimnetz als eigene Zeile, Leck-Prüfung (pwnedpasswords), Link- und Tab-Vorschau („nie im Hintergrund“ in `strings.legal.ts:118,368` berichtigen).
- `core/net/catalogue.ts`: api.anthropic.com. Spotify: Trennen widerruft nicht bei Spotify (Text + docs/user/spotify*.md). Regeltext Fernsteuerung: Maus/Tastatur-Freigabe reicht so weit wie der Nutzer.
- Website-Liste und docs/user/security*.md nachziehen.
## Abnahme
legal.test.ts, check:readme, check:legal, check:docs grün. Keine Rechtsberatung.
## Skills
council (Advocate: Versprechen gegen Code). Full stop.
```
