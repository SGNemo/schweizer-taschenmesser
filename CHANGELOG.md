# Changelog

Release notes are generated from Conventional Commits (`npm run changelog -- --version <x.y.z>` in `web/`); this file mirrors the published releases. Full lists with commit links: [GitHub Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).

## Unreleased

### Breaking
- **Nachrichten, Habit-Tracker und Zeiterfassung sind nicht mehr sichtbar** (stillgelegt). Ihre Daten bleiben gespeichert, synchronisieren weiter und sind in jedem Backup enthalten; eine Wiederherstellung der Oberfläche gibt es nicht. Wer die Daten braucht, exportiert sie vorher über ein Backup (Einstellungen → Backup).
- **Werkzeuge:** Prozent & MwSt und Kosten teilen sind jetzt Modi des Rechners, Base64, JSON, UUID und Hash stecken im Werkzeug „Entwickler“, der Notizzettel ist der feste „Zettel“ oben in den Notizen. Gespeicherte Werkzeug-Auswahl wird übernommen.
- **Einkaufsliste und Packlisten sind das neue Modul „Listen“** (Einkauf, Packliste, Checkliste), **Apps & Links sind die Ansicht „Lesezeichen“ der Merkliste** (Kacheln nach erstem Tag). Bestehende Daten werden beim Start, nach Sync und nach Backup-Import kopiert; die alten Module sind stillgelegt. **Alle Geräte müssen aktualisiert werden**: ein altes Gerät schreibt weiter in die alten Tabellen. Die acht Startseiten-Vorlagen von Apps & Links entfallen; `mailto:`/`tel:`-Links lassen sich im Lesezeichen-Editor nur als http(s) neu speichern.
- **Verträge & Garantien gehen in „Unterlagen“ (früher Dokumente) auf, Geburtstage und Geschenkideen im neuen Modul „Personen“.** Bestehende Daten werden beim Start, nach Sync und nach Backup-Import kopiert; die alten Module sind stillgelegt. Geschenkideen werden der Person mit demselben Namen zugeordnet, sonst wird eine neue Person angelegt. **Alle Geräte müssen aktualisiert werden**: ein altes Gerät schreibt weiter in die alten Tabellen. Erinnerungs-Einstellungen werden übernommen (Unterlagen: eigene Vorlaufzeit für Kündigungsfristen).
- **Erinnerungen sind jetzt Termine der Art „Erinnerung“ im Kalender** (Tab „Erinnerungen“; `/reminders` leitet dorthin). Bestehende Erinnerungen werden beim Start, nach Sync und nach Backup-Import kopiert, pausierte bleiben pausiert; das Modul ist stillgelegt, ebenso sein Dashboard-Widget (die Einträge erscheinen in „Heute & Morgen“). **Alle Geräte müssen aktualisiert werden**: ein altes Gerät schreibt weiter in die alten Tabellen. Die Standard-Uhrzeit wird übernommen.
- **Systeminfo** ist ein Tab von „Dieser PC“ (früher Datenträger); der Pfad `/system` entfällt.

### Neu
- **Kalender:** Termine können vorher benachrichtigen (zum Beginn bis 1 Tag vorher, auch bei Wiederholungen); ganztägige Termine zu einer einstellbaren Uhrzeit.
- **ToDos:** Aufgaben wiederholen sich (Abhaken legt die nächste an), „Irgendwann“ hält Aufgaben aus den offenen Listen heraus; wiederkehrende Fälligkeiten erscheinen im Kalender.
- Werkzeug-Rahmen: `/tools/<id>`, Befehlspalette „Werkzeug: …“, Strg+. öffnet die Werkzeuge; breiterer Dialog, „Zurück“ in der Kopfzeile.
- Uhrzeit der Abo-Erinnerung einstellbar; „Startdaten“-Knopf auch bei Verträgen, Packlisten, Vorräten, Dokumenten, Geschenken, Budgets und Notizen.

### Behoben
- Abo-Namen brechen nicht mehr buchstabenweise um; „Auf die Einkaufsliste“ meldet, wenn die Einkaufsliste aus ist; veraltete Texte (Kalender, Backup-Hinweis im Assistenten, Profil „Produktiv“) korrigiert.

## 0.3.1 (2026-10-01) – "Nemo 0.3.1"
Kleines Update: neue Wortmarke. Installationen von 0.3.0 bekommen es per In-App-Update angeboten, die Daten bleiben erhalten.

### Geändert
- Neue Wortmarke „Nemo“ im Clownfisch-Stil: In der Seitenleiste und der Kopfzeile erscheint der Schriftzug statt nur des Fisch-Symbols.
- README-Kopfbild und Vorschaubild für soziale Netzwerke mit der neuen Wortmarke und dem Claim.

### Behoben, Sicherheit
- Keine Änderungen.

### Hinweise
- **Keine Breaking Changes:** interne IDs, Backup-Formate, Datenbank und Updater-Endpunkt sind unverändert.
- **Bekanntes:** Die Geräte-Funktionen (Datenträger, Windows Hello, Android-Biometrie, Sync mit älteren Geräten) sind weiter nur von Hand geprüft. Bitte Fehler melden.

## 0.3.0 (2026-10-01) – "Nemo 0.3.0"
Erste stabile Version unter dem Namen Nemo. Sie ist die „neueste Version“: Installationen von 0.2.0 bekommen sie per In-App-Update angeboten, die Daten bleiben erhalten. Sie enthält alles aus 0.3.0-beta.1 (siehe unten) plus die Änderungen hier.

### Neu
- Neues App-Icon (Clownfisch) und neue Wortmarke „Nemo“.
- Dazu alles aus der Vorabversion: Einrichtungsassistent, Schnell erfassen, Datenträger- und Systeminfo-Modul (Windows), Vorrat, Zeiterfassung, Geschenkideen, Werkzeuge Text/Zeitzonen/Bild/PDF, flaches Design „Klar“, MIT-Lizenz.

### Geändert
- Interne Verbesserungen an Build und Tests (schnellere Prüfungen). Keine Änderung am Verhalten der App.

### Behoben
- Release-Prüfung der Download-Links las ihre Parameter falsch (nur Build-Werkzeug, betrifft die App nicht).

### Sicherheit
- Keine neuen Änderungen gegenüber 0.3.0-beta.1 (verschlüsselte Backups, Geräte-Tokens, Sync-Tresor v2, verschlüsselte Sicherungskopien vor Updates).

### Hinweise
- **Keine Breaking Changes:** interne IDs, Backup-Formate und Updater-Endpunkt sind unverändert; alte Backups lassen sich weiter importieren. Die lokale Datenbank wird beim ersten Start automatisch auf Version 13 migriert.
- **Download-Namen:** Dateien heißen jetzt `Nemo-Portable.exe` und `Nemo.apk`; die bisherigen `Taschenmesser-*`-Dateien liegen als Kopie dabei, damit installierte Apps weiter aktualisieren können.
- **Bekanntes:** Geräte-Funktionen (Datenträger, Windows Hello, Android-Biometrie, Sync mit älteren Geräten) sind nur von Hand geprüft. Bitte Fehler melden.

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
