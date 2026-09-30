# Changelog

Release notes are generated from Conventional Commits (`npm run changelog -- --version <x.y.z>` in `web/`); this file mirrors the published releases. Full lists with commit links: [GitHub Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).

## Unreleased

## 0.3.0-beta.1 (2026-09-30) – "Nemo 0.3.0-beta.1" (Vorabversion)
Vorabversion zum Ausprobieren: Sie erscheint nicht als „neueste Version“ und wird nicht automatisch per App-Update angeboten. Die Installation über eine bestehende Installation behält alle Daten.

### Neu
- **Nemo:** neuer Name, neues Logo („Welle“) und ein ruhiges, flaches Design mit Akzentfarben (Hell/Dunkel).
- **Einrichtungsassistent** für den Start (manuell, nie erzwungen).
- **Schnell erfassen:** Tastenkürzel, Tray-Symbol und Autostart (Windows), Teilen-Ziel (Android), Eingabe in Alltagssprache.
- **Datenträger (Windows):** Laufwerke scannen, Treemap, Aufräum-Helfer, doppelte Dateien; Löschen nur mit Sperrliste, Papierkorb als Standard und Bestätigung per Namenseingabe.
- **Systeminfo (Windows):** CPU, Speicher, Akku, Grafik, Netzwerk.
- **Neue Module:** Vorrat, Zeiterfassung, Geschenkideen.
- **Neue Werkzeuge:** Text, Zeitzonen, Bild, PDF.
- Lizenz: MIT.

### Geändert
- Kurze README mit Nutzer-Dokumentation unter `docs/user/`.
- Alle Dateien heißen jetzt Nemo-*; die bisherigen Taschenmesser-*-Dateien liegen als Kopie dabei, damit installierte Apps weiter aktualisieren können.

### Behoben
- Android: Teilen-Ziel baute nicht (Android 12+), Statusleisten-Symbol für Benachrichtigungen.
- Falscher Tag im Zeitstempel der letzten Synchronisierung.

### Sicherheit
- Verschlüsselte Backups mit Prüfung vor dem Wiederherstellen; automatische Sicherungen (Windows).
- Sync: Geräte-Tokens, Sperre bei Fehlversuchen, neuer Tresor (Argon2id), Konfliktprotokoll.
- Sicherungskopien vor Updates sind verschlüsselt.

### Hinweise
- **Keine Breaking Changes:** interne IDs, Backup-Formate und Updater-Endpunkt sind unverändert; alte Backups lassen sich weiter importieren. Die lokale Datenbank wird beim ersten Start automatisch auf Version 13 migriert.
- **Bekanntes:** Die Geräte-Funktionen (Datenträger, Windows Hello, Android-Biometrie, Update auf bestehender Installation) sind nur von Hand geprüft. Bitte Fehler melden.
- **Vorabversion:** Windows-Portable und APK von Hand von der Releases-Seite laden (SmartScreen-Hinweis bei der EXE ist zu erwarten).

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
