# Changelog

Release notes are generated from Conventional Commits (`npm run changelog -- --version <x.y.z>` in `web/`); this file mirrors the published releases. Full lists with commit links: [GitHub Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).

## Unreleased

### Breaking
- **Nachrichten, Habit-Tracker und Zeiterfassung sind nicht mehr sichtbar** (stillgelegt). Ihre Daten bleiben gespeichert, synchronisieren weiter und sind in jedem Backup enthalten; eine Wiederherstellung der Oberfläche gibt es nicht. Wer die Daten braucht, exportiert sie vorher über ein Backup (Einstellungen → Backup).
- **Werkzeuge:** Prozent & MwSt und Kosten teilen sind jetzt Modi des Rechners, Base64, JSON, UUID und Hash stecken im Werkzeug „Entwickler“, der Notizzettel ist der feste „Zettel“ oben in den Notizen. Gespeicherte Werkzeug-Auswahl wird übernommen.
- **Einkaufsliste und Packlisten sind das neue Modul „Listen“** (Einkauf, Packliste, Checkliste), **Apps & Links sind die Ansicht „Lesezeichen“ der Merkliste** (Kacheln nach erstem Tag). Bestehende Daten werden beim Start, nach Sync und nach Backup-Import kopiert; die alten Module sind stillgelegt. **Alle Geräte müssen aktualisiert werden**: ein altes Gerät schreibt weiter in die alten Tabellen. Die acht Startseiten-Vorlagen von Apps & Links entfallen; `mailto:`/`tel:`-Links lassen sich im Lesezeichen-Editor nur als http(s) neu speichern.
- **Verträge & Garantien gehen in „Unterlagen“ (früher Dokumente) auf, Geburtstage und Geschenkideen im neuen Modul „Personen“.** Bestehende Daten werden beim Start, nach Sync und nach Backup-Import kopiert; die alten Module sind stillgelegt. Geschenkideen werden der Person mit demselben Namen zugeordnet, sonst wird eine neue Person angelegt. **Alle Geräte müssen aktualisiert werden**: ein altes Gerät schreibt weiter in die alten Tabellen. Erinnerungs-Einstellungen werden übernommen (Unterlagen: eigene Vorlaufzeit für Kündigungsfristen).
- **Erinnerungen sind jetzt Termine der Art „Erinnerung“ im Kalender** (Tab „Erinnerungen“; `/reminders` leitet dorthin). Bestehende Erinnerungen werden beim Start, nach Sync und nach Backup-Import kopiert, pausierte bleiben pausiert; das Modul ist stillgelegt, ebenso sein Dashboard-Widget (die Einträge erscheinen in „Heute & Morgen“). **Alle Geräte müssen aktualisiert werden**: ein altes Gerät schreibt weiter in die alten Tabellen. Die Standard-Uhrzeit wird übernommen.
- **Die alten Tabellen sind entfernt** (Nachrichten, Habits, Zeiterfassung, Erinnerungen, Einkauf, Packlisten, Apps & Links, Geburtstage, Geschenke, Verträge: 15 Tabellen, Datenbank-Version 18). Ihre Daten waren seit 0.5–0.7 in die neuen Module kopiert; **wer noch Daten in einer dieser Tabellen hat (Geräte < 0.7, die nie aktualisiert wurden), verliert sie.** Backups aus Versionen vor 0.5 lassen sich weiter einlesen, die alten Tabellen darin werden übersprungen (die Vorschau nennt die Zahl) – Einkauf, Packlisten, Verträge, Geburtstage, Geschenke und Erinnerungen daraus kommen nicht mehr zurück.
- **Systeminfo** ist ein Tab von „Dieser PC“ (früher Datenträger); der Pfad `/system` entfällt.

### Neu
- **Ausgeschaltete Module direkt einschalten:** Wenn ein Hinweis ein ausgeschaltetes Modul nennt (z. B. „Auf die Einkaufsliste“ im Vorrat ohne Listen), gibt es einen Knopf „Aktivieren“ und die Aktion wird danach gleich ausgeführt. Dasselbe gilt für die Teilen-Seite und für Antworten des KI-Assistenten.
- **Fokus- und Aufmerksamkeitshilfen (Paket 1 „Anfangen“), alle einzeln abschaltbar unter Einstellungen → Darstellung → „Fokus & Aufmerksamkeit“:** „Jetzt dran“ schlägt oben auf der Übersicht eine einzige Aufgabe vor (Anfangen, Später, Etwas anderes); der Tagesplan zeigt höchstens drei Dinge für heute und was schon erledigt ist; der Fokusmodus zeigt eine Aufgabe mit Schritten und Ring-Timer ohne Menüs (Zustand bleibt beim Neuladen, Anzeige oben, sanftes Ende); „Als Nächstes“ zeigt die Zeit bis zum nächsten Termin; ToDos haben eine geschätzte Dauer (auch per Schnellerfassung: „… 15 min“) und lassen sich für heute einplanen; „Jetzt wichtig“ ist ruhiger („Wartet noch“ eingeklappt, kein roter Tageszähler für alte ToDos, „Neu planen“ verteilt sie auf die nächsten Tage).
- **Ruhige Erinnerungen (Paket 2), alle abschaltbar unter Einstellungen → Benachrichtigungen → „Ruhige Erinnerungen“:** Ist die App offen, erscheint eine fällige Erinnerung als Karte mit „Erledigt“ und „Später“ (10 Min, 1 Std, heute Abend, morgen früh, wenn ich am PC bin). Ruhezeit (22–7 Uhr) für automatische Zusätze, höchstens 3 Hinweise pro Stunde (der Rest wird zu einem Hinweis zusammengefasst), optional gestaffelte Erinnerungen vor Terminen und eine sanfte Nachfrage. Statt einzelner ToDo-Hinweise gibt es morgens einen Hinweis, der die ToDos für heute nennt. Das Ende einer Fokus-Runde kann auch bei geschlossener App melden. „Woran war ich?“ zeigt auf der Übersicht nach einer längeren Pause den Weg zurück.
- **Erfassen, Ruhe, Wiederfinden (Paket 3):** Die Schnellerfassung fragt bei unklarem Text nicht mehr nach, sondern legt ihn so, wie du ihn getippt hast, im ToDo-Eingang ab (abschaltbar unter Schnellerfassung). Strg+Enter öffnet das ganze Formular mit dem getippten Text. „Eingang sortieren“ geht die Dinge im Eingang eins nach dem anderen durch. Die Suche (Strg+K) zeigt zuerst, was du zuletzt benutzt hast (Verlauf auf dem Gerät, löschbar). Darstellung: Textgröße „Sehr groß“, Zeilenabstand „Luftig“, „Bewegung: Weniger“ in der App und die ruhige Übersicht „Nur das Wichtigste“.
- **Sichtbarer Fortschritt ohne Druck (Paket 4), abschaltbar unter Einstellungen → Darstellung → „Fokus & Aufmerksamkeit“:** wiederkehrende ToDos zeigen „n in Folge“ (ein Pausentag bricht nichts ab, es gibt nie einen Verlust), ein freundlicher Wochenrückblick in „Jetzt dran“, abends „Tag abschließen“ (Übriges mit einem Tipp auf morgen schieben) und in den Listen „Aus Vorlage“ mit Morgenroutine, Abendroutine und Wochenplanung.
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
