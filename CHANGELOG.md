# Changelog

Release notes are generated from Conventional Commits (`npm run changelog -- --version <x.y.z>` in `web/`); this file mirrors the published releases. Full lists with commit links: [GitHub Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).

## Unreleased

## 1.0.0 (2026-10-07) – "Nemo 1.0.0"
Erste stabile Hauptversion: neue Oberfläche („Klar 2“), neu geordnete Module, KI-Einträge, Fokus-Hilfen und fünf Sprachen. Bundle-ID, Updater-Endpunkt und Backup-Formate bleiben gleich; Installationen ab 0.3.0 aktualisieren sich in der App.

### Wichtig vor dem Update
- **Daten alter Module werden nicht übernommen, wenn du direkt von 0.3.x kommst.** Entfernt sind die Tabellen von Einkauf, Packlisten, Apps & Links, Geburtstagen, Geschenken, Verträgen, Erinnerungen, Gewohnheiten, Zeiterfassung und Nachrichten (News). Sie wandern nicht in die neuen Module Listen, Merkliste, Personen, Unterlagen und Kalender. Wer solche Daten braucht, sichert sie vorher (Einstellungen → Backup) oder bleibt bei 0.3.1. Todos, Notizen, Kalender, Finanzen und Tresor sind nicht betroffen.
- Die Datenbank wird auf Version 19 migriert; danach läuft keine ältere App mehr mit diesen Daten. Vor dem Update legt die App ein Sicherungs-Backup an.
- Installationen bis 0.2.x können sich nicht mehr selbst aktualisieren (Dateinamen jetzt `Nemo-*`) und müssen neu installiert werden.
- Alle Geräte, die per Sync verbunden sind, auf dieselbe Version bringen.

### Neu
- **Oberfläche „Klar 2“:** neue Farben und Radien, Übersicht als Startseite mit Widgets, Bereiche und Seitenleiste, Einstellungen mit Suche und „Über Nemo“, Rückgängig-Verlauf, Tastenkürzel.
- **Module neu geordnet:** Listen (Einkauf, Packliste, Checkliste), Personen (Geburtstage, Geschenke), Unterlagen (Verträge), Erinnerungen als Kalender-Termine, Werkzeuge von 18 auf 12, „Dieser PC“ mit System-Info.
- **KI-Einträge** in jedem Modul (Regeln zuerst, Cloud nur als Rückfall, Vorschau mit Rückgängig), lokales Modell, Chat-Modul und Hauptschalter „KI abschalten“.
- **Fokus- und Aufmerksamkeitshilfen:** „Als Nächstes“, Tagesplan, Fokusmodus, ruhige Erinnerungen mit „Später“, Morgen-Übersicht, Erfassen ohne Rückfrage, Fortschritt ohne Druck. Alles abschaltbar.
- **Lesbarkeit:** Lesehilfe, Textgröße „Extra groß“, Zeilenabstand „Luftig“, weniger Bewegung.
- **Fünf Sprachen:** Deutsch, Englisch, Spanisch, Französisch, Portugiesisch (Brasilien).
- **Absturzfestigkeit:** Diagnose mit Vorschau und „Fehler melden“, Wiederherstellungsbildschirm, sicherer Modus, Fehlerkarten pro Modul.
- **Supporter-Modus**, Kalender-Benachrichtigungen vorab, wiederkehrende Todos, Passwort-Generator und Brave-Erweiterung, Rechtliches in „Über Nemo“.

### Behoben, Sicherheit
- Sicherheits-Review vor dem Start mit kleinen Korrekturen; CodeQL-Befunde bearbeitet. Viele kleine UI- und Testkorrekturen.

### Hinweise
- **Bekannt:** Gerätefunktionen (Windows Hello, Android-Keystore, Disk-Modul, Update-Austausch) sind nur von Hand prüfbar. Bitte Fehler melden.

## 0.3.1 (2026-10-01) – "Nemo 0.3.1"
Small update: new wordmark. Installations of 0.3.0 are offered it via in-app update; data stays intact.

### Changed
- New "Nemo" wordmark in clownfish style: the sidebar and the header show the lettering instead of just the fish icon.
- README header image and social-media preview image with the new wordmark and the claim.

### Fixed, security
- No changes.

### Notes
- **No breaking changes:** internal IDs, backup formats, database and updater endpoint are unchanged.
- **Known:** the device features (disk, Windows Hello, Android biometrics, sync with older devices) are still only checked by hand. Please report bugs.

## 0.3.0 (2026-10-01) – "Nemo 0.3.0"
First stable version under the name Nemo. It is the "latest version": installations of 0.2.0 are offered it via in-app update; data stays intact. It contains everything from 0.3.0-beta.1 (see below) plus the changes here.

### New
- New app icon (clownfish) and new "Nemo" wordmark.
- Plus everything from the pre-release: setup assistant, quick capture, disk and system info module (Windows), pantry, time tracking, gift ideas, tools text/time zones/image/PDF, flat design "Klar", MIT licence.

### Changed
- Internal improvements to build and tests (faster checks). No change in the app's behaviour.

### Fixed
- The release check of the download links read its parameters wrongly (build tool only, does not affect the app).

### Security
- No new changes compared to 0.3.0-beta.1 (encrypted backups, device tokens, sync vault v2, encrypted backup copies before updates).

### Notes
- **No breaking changes:** internal IDs, backup formats and updater endpoint are unchanged; old backups can still be imported. The local database is migrated to version 13 automatically on first start.
- **Download names:** files are now called `Nemo-Portable.exe` and `Nemo.apk`; the previous `Taschenmesser-*` files are included as copies so installed apps can keep updating.
- **Known:** device features (disk, Windows Hello, Android biometrics, sync with older devices) are only checked by hand. Please report bugs.

## 0.3.0-beta.1 (2026-09-30) – "Nemo 0.3.0-beta.1" (pre-release)
Pre-release for trying out: it does not appear as the "latest version" and is not offered automatically via app update. Installing over an existing installation keeps all data.

### New
- **Nemo:** new name, new logo ("Wave") and a calm, flat design with accent colours (light/dark).
- **Setup assistant** for getting started (manual, never forced).
- **Quick capture:** keyboard shortcut, tray icon and autostart (Windows), share target (Android), input in everyday language.
- **Disk (Windows):** scan drives, treemap, clean-up helpers, duplicate files; deleting only with a block list, recycle bin by default and confirmation by typing the name.
- **System info (Windows):** CPU, memory, battery, graphics, network.
- **New modules:** pantry, time tracking, gift ideas.
- **New tools:** text, time zones, image, PDF.
- Licence: MIT.

### Changed
- Short README with user documentation under `docs/user/`.
- All files are now called Nemo-*; the previous Taschenmesser-* files are included as copies so installed apps can keep updating.

### Fixed
- Android: share target did not build (Android 12+), status bar icon for notifications.
- Wrong day in the timestamp of the last sync.

### Security
- Encrypted backups with a check before restoring; automatic backups (Windows).
- Sync: device tokens, lockout after failed attempts, new vault (Argon2id), conflict log.
- Backup copies before updates are encrypted.

### Notes
- **No breaking changes:** internal IDs, backup formats and updater endpoint are unchanged; old backups can still be imported. The local database is migrated to version 13 automatically on first start.
- **Known:** the device features (disk, Windows Hello, Android biometrics, update over an existing installation) are only checked by hand. Please report bugs.
- **Pre-release:** download the Windows portable and the APK by hand from the releases page (a SmartScreen notice for the EXE is expected).

## 0.2.0 (2026-09-30) – "Taschenmesser 0.2.0"
### Breaking changes
- **windows:** portable executable with its own signed self-update; Windows installers are no longer published.
### Features
- **mcp:** stdio MCP server wrapping the local import API
- **localapi:** loopback-only AI import API for the desktop app; import batches wait for confirmation, with diff and undo
- **dataapi:** import format from module schemas and JSON paste import
- map and WhatsApp links, share page and the Apps & Links module
- **tools:** toolbar, tool library, 14 tools and palette calculator
- **news:** RSS/Atom news module with local article cache, starter pack and an explicit AI brief
- **connectors:** Google calendar and mail suggestions, ICS subscriptions, external calendar events; connector types, PKCE helpers, redaction and a loopback OAuth listener
- **server:** SSRF-hardened proxy for public calendar and feed URLs
- **onboarding:** start-data wizard, importers per module, bank statements and HelpHint
- **layout:** PageContainer layout system and wide-screen module layouts
- **security:** OS keystore, biometric vault unlock and screenshot protection
- **ai:** multiple providers with a fallback router, limits and encrypted keys
- **accounts:** encrypted password vault, fully excluded from the AI
- **update:** self-update for desktop and Android with pre-update backup
- **android:** Tauri Android setup, APK installer plugin, OS-scheduled reminders
- **desktop:** embed the web app in a Tauri 2 shell behind a PlatformService
### Bug fixes
- **localapi:** request deadline and a cap on waiting imports
- pad VAPID private keys to 32 bytes; bundle connector settings UIs with the settings page
- **ai:** concurrent provider changes no longer overwrite each other; hash-wasm kept out of the main bundle; saving a provider form no longer reverts its switch
- **android:** apk-installer plugin compiled against API 36
### Build & CI
- secret scan (gitleaks), release artifact audit, keystore cleanup, signed release pipeline, download README

## 0.2.0-beta.2 (2026-09-30)
First portable Windows build; connectors, news, tools, start-data wizard, layout system (see 0.2.0).

## 0.2.0-beta.1 (2026-09-29)
Desktop and Android shells, self-update, password vault, multi-provider AI, OS keystore and biometrics, CI and signed releases. Earlier phases 1–6 (PWA foundation, recurrence engine, finance, sync server with end-to-end encryption, AI assistant, extra modules) were developed on `develop` without releases.
