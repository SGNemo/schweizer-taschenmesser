# Status – Taschenmesser

Stand: nach Release `v0.2.0` (stabil, auf `main`; enthält Windows-Portable, APK, `latest.json`). Keine offenen Issues, keine offenen PRs (geprüft bei Erstellung dieser Datei).

## Fertig
- Phasen 1–13: Fundament, Kernmodule, Finanzen/Rechnungen/Abos, Sync + Backup (E2E-verschlüsselbar), KI-Assistent + Multi-Provider-Router, Extra-Module, Tauri Desktop (portable exe) + Android, CI/signierte Releases, Selbst-Update, Passwort-Tresor inkl. OS-Keystore/Biometrie, Startdaten-Assistent, Verbindungen (Google, ICS), Nachrichten, Werkzeuge, Links/Teilen/Launcher. Notizen je Phase: [`architecture.md`](architecture.md).
- Einrichtungsassistent (`core/setup/`, `layout/setup/`): manuell startbar (Settings, Palette, Dashboard-Karten), jederzeit abbrechbar, Fortschritt geräte-lokal; Schritte Grundlagen, Sync/Wiederherstellung, Profile, Werkzeuge, Tresor, KI-Anbieter, Verbindungen, Startdaten, Import per KI, Benachrichtigungen, Backup/Updates, Dashboard; Checkliste im Dashboard; `setupSteps` an Manifesten. Details: `ARCHITECTURE-MAP.md`, `DECISIONS.md`, `HOW-TO.md`.
- Layout-System (`PageContainer`, PR #3), Aufräumen + Doku-Split (PR #2).
- KI-Import-Runde (PR #4): JSON-Import je Modul, lokale Import-API (nur Desktop, Loopback, Tokens, Vorschau/Undo), MCP-Wrapper `mcp/`, Anleitung [`AI-IMPORT.md`](AI-IMPORT.md).
- Releases: `v0.2.0-beta.1`, `v0.2.0-beta.2` (erste portable Version), `v0.2.0`.

## Diese Runde (Branch `feat/disk-cleaner-and-modules`)
- **Datenträger** (nur Desktop): Laufwerkskarten, paralleler Rust-Scan (Fortschritt, Pause, Abbruch, „Nicht gelesen“-Liste), Treemap + Liste + Schnellfilter + Details, Auswahl-Korb, Löschen in den Papierkorb (Standard) oder endgültig mit Sperrliste, Tippbestätigung, Bericht; Aufräum-Helfer (bekannte Temp-/Cache-Ordner, leere Ordner, doppelte Dateien).
- **Systeminfo** (nur Desktop), **Zeiterfassung**, **Vorräte** (mit Weitergabe an die Einkaufsliste), **Geschenkideen**; Werkzeuge **Text**, **Zeitzonen**, **Bilder verkleinern**, **PDF**.
- `manifest.platforms` + `availableManifests()`; Tauri-Befehle einzeln freigegeben (`build.rs`, `capabilities/desktop.json`); DB-Version 13.

## Ideen (nicht gebaut)
- Datenträger: Sunburst-Ansicht, „Letzten Scan zwischenspeichern“ (lokal, standardmäßig aus), MFT-Schnellscan mit Adminrechten, Ordner frei wählen (Dialog), Android-Speicherübersicht (belegt/frei, ohne Scan/Löschen), eigene Aufräum-Regeln.
- Module: Fahrzeug (Tanken, Verbrauch, TÜV/Service), Journal/Tagebuch, Garantie-/Belegverwaltung mit Foto, Zwischenablage-Verlauf (Passwörter ausschließen), Text-Snippets, Autostart-Übersicht (nur Anzeige), Medikamenten-/Wasser-Erinnerung, Watchlist/Leseliste, Putzplan, Sparziele (Haushaltsbuch), Reise (Packlisten, Reisedokumente, Zeitzonen), Speedtest/WLAN-Name (Systeminfo).
- Werkzeuge: Farbwähler/Kontrast-Check, Datei-Prüfsumme + Text-Diff, WLAN-QR, Regex-Tester, Notenrechner, BMI/Kalorien (ohne Speicherung), Massen-Umbenennen, Bild-Farben extrahieren, PDF komprimieren.
- Zeiterfassung: Stundensätze/Beträge, Projektfarben.

## Nicht gebaut / bekannte Grenzen
- Google-Drive-Sync-Adapter (nur `core/sync/adapters/googleDrive.stub.ts`), Binär-Anhänge im Sync, Tombstone-GC, Mehrmandanten-Server.
- Google-Login auf Android, zweiseitiger Kalender-Sync, FinTS/PSD2, Mail-Body-Parsing.
- Spotify-Connector (bewusst nicht gebaut), natives Android-Share-Target für die APK.
- Windows-Binaries ohne Authenticode-Zertifikat (SmartScreen-Warnung); Pre-Update-Backups liegen im `%APPDATA%`-Ordner, auch im portablen Modus.
- Providerdaten (Modellnamen, Preise, Limits, CORS aus der PWA), Startpaket-Feed-Adressen, Bankdatei-Spaltennamen und Launcher-Adressen sind unverifiziert (siehe Checklisten unten).
- Geräteverhalten der nativen Shells (Windows Hello, Android-Keystore/Biometrie, Update-Austausch, Push) nur von Hand prüfbar.
- Einrichtungsassistent: keine automatischen lokalen Backups, keine App-Sperre, kein Screenshot-Schutz-Schalter (gibt es in der App nicht; der Assistent zeigt nur Vorhandenes). Kein Ollama-CORS-Workaround im Browser (Erkennung ist Best-Effort). Hinweise zu genauen Alarmen/Akku-Optimierung sind nur Text (keine Plugin-API geprüft/gebaut). Wochenstart nur im Kalender (KI-Zeiträume rechnen weiter mit Montag).

## Bekannte Probleme / Hinweise
- README-Download-Badges zeigen auf das neueste *stabile* Release und funktionieren jetzt (seit `v0.2.0`).
- TypeScript ist auf 6.0.x gepinnt (typescript-eslint unterstützt `<6.1`).
- Aus PR #2 zurückgestellte Vorschläge: Plugin-Bumps `@tauri-apps/plugin-http` 2.8 / `plugin-opener` 2.7 (JS und Rust gemeinsam, per CI verifizieren), TypeScript 7 / `@types/node` 26, zxcvbn-Wörterbücher aus dem Precache nehmen (Entscheidung nötig), Vitest-`node`-Projekt für reine Logiktests, CI-Caching, evtl. `serde_json` in `web/src-tauri/Cargo.toml` entfernen.
- Aus PR #3 offene Vorschläge: globaler „+“-FAB ab 900 px durch „+ Neu“ in der Top-Bar ersetzen; ToDo-Board mit Listen als Spalten.

## Nächste sinnvolle Schritte
1. Hardware-Checklisten unten abarbeiten (Sven), Fehler melden.
2. Update-Test auf echten Geräten mit dem nächsten Release (Schritte unter „Offen – macht Sven").
3. Einrichtungsassistent: offene Kleinigkeiten – Link „Einrichtung öffnen“ in den Leerzuständen der einzelnen Module (12 Seiten mit `StartDataButton`), Verbindungs-/Import-Schritte per Android-Zurück-Geste (Import-Dialog über dem Assistenten), automatische Backups als eigenes Feature.
4. Unverifizierte Adressen/Formate mit echten Daten prüfen (N1, C7, L4, Provider-Endpunkte).
5. Entscheidungen: Spotify-Widget (L5), Precache der Wörterbücher, FAB-Änderung.

---

## Manuelle Tests offen
Nur auf echter Hardware prüfbar (das macht Sven am Ende). Alles andere ist per Unit-/E2E-Tests und CI-Läufen abgedeckt.

### Datenträger, Systeminfo (diese Runde) – nur auf echtem Windows prüfbar
Alles mit einem **Testordner** mit erfundenen Dateien, nie mit echten Nutzerdaten:
D1. *Scan echtes Laufwerk:* Datenträger → C: scannen. Fortschritt läuft, UI bleibt flüssig, Summe stimmt grob mit dem Explorer („Größe auf Datenträger“ des Ordners) überein. Ergebnis mit „Nicht gelesen“-Liste (z. B. `System Volume Information`). ☐
D2. *Treemap navigieren:* Klick in einen Ordner, Brotkrumen zurück, Umschalt+Klick wählt nur aus, Pfeiltasten/Eingabe/Rücktaste, Tooltip, Legende, Farbe nach Tiefe, Filter „Älter als“, „Dateityp“. ☐
D3. *Laufwerksarten:* USB-Stick und Netzlaufwerk erscheinen mit richtigem Typ; SSD/HDD-Angabe stimmt (kann „Festplatte“ ohne Angabe sein). ☐
D4. *Cloud-Platzhalter:* Ein OneDrive-Ordner mit „Nur online“-Dateien wird gescannt, ohne dass etwas heruntergeladen wird; Hinweis „liegen nur online“ erscheint. ☐
D5. *Verknüpfungen:* Ein Ordner mit Junction/Symlink auf einen großen Ordner: wird nicht doppelt gezählt (Hinweis „nicht betreten“). ☐
D6. *Papierkorb:* Testordner (mit ein paar Dateien) → Löschen → „In den Papierkorb“: Ordner liegt im Windows-Papierkorb, lässt sich wiederherstellen; Baum und Summen aktualisieren sich ohne Neu-Scan. ☐
D7. *Papierkorb nicht möglich:* Einen Testordner auf einem USB-Stick/Netzlaufwerk ohne Papierkorb löschen: Bericht „Papierkorb nicht möglich – nichts gelöscht“, der Ordner ist noch da; erst der bewusste „endgültig“-Schritt löscht. ☐
D8. *Sperrliste:* Diese Pfade zeigen **keine** Löschen-Schaltfläche, sondern „Geschützt“: Laufwerkswurzel, `C:\Windows` (und darin), `C:\Program Files`, `C:\ProgramData`, `C:\Users`, dein Profilordner, `AppData`, `System Volume Information`, `$Recycle.Bin`, `pagefile.sys`/`hiberfil.sys`, Ordner der Taschenmesser-App und ihrer Daten, Ordner eines laufenden Programms. Mit 8.3-Namen (`dir /x`) und über eine Junction auf `C:\Windows` ebenfalls nicht löschbar. ☐
D9. *Abbruch:* Scan während der Laufzeit abbrechen (Teilergebnis bleibt nutzbar); Löschen einer großen Testordner-Auswahl mit „Stoppen“ unterbrechen (Rest bleibt unberührt). ☐
D10. *Datei in Benutzung:* Eine geöffnete Testdatei in einem Testordner: Bericht „Teilweise gelöscht“ mit Grund „Datei in Benutzung“. ☐
D11. *Bestätigungen:* Große Löschung (> 10 GB oder > 10 000 Dateien, z. B. Testordner mit vielen leeren Dateien) und „endgültig“ verlangen das Eintippen des Namens; Dokumente/Bilder/Desktop zeigen die Warnung für persönliche Ordner. ☐
D12. *Aufräum-Helfer:* „Aufräumen“ auf der Startseite listet Temp/Downloads/Browser-Caches (nur vorhandene); „Doppelte Dateien“ findet zwei gleiche Testdateien, ein Exemplar bleibt immer. ☐
D13. *Im Explorer zeigen / Pfad kopieren* funktionieren (auch bei langen Pfaden). ☐
D14. *Berechtigungen:* App startet, Updater, Google-Login und lokale API funktionieren weiterhin (alle App-Befehle sind jetzt einzeln freigegeben; `capabilities/desktop.json`). ☐
D15. *Systeminfo:* Werte stimmen mit dem Task-Manager grob überein (CPU-Name, RAM, Akku am Laptop, Grafikkarte, lokale IP). ☐
D16. *Android/PWA:* „Datenträger“ und „Systeminfo“ erscheinen weder in der Modul-Bibliothek noch im Menü. ☐

### Schritt 11b – OS-Keystore, Biometrie, Bildschirmschutz
**Windows (`Taschenmesser-Portable.exe`)**
1. *API-Schlüssel im Credential Manager:* Einstellungen → KI-Assistent → Anbieter hinzufügen → Schlüssel eintragen → Speichern → „Verbindung testen". Dann Windows-Suche „Anmeldeinformationsverwaltung" → „Windows-Anmeldeinformationen": Es gibt einen Eintrag `ai-key:<anbieter>` (Adresse `io.github.sgnemo.taschenmesser`). ☐
2. *Migration:* Ein Schlüssel, der schon mit einer älteren Version gespeichert war, funktioniert nach dem Update weiter (nach der ersten Nutzung erscheint er im Credential Manager). ☐
3. *Windows Hello:* Accounts → Tresor anlegen/entsperren → „Import, Export & Sicherheit" → „Biometrisches Entsperren aktivieren" (Master-Passwort eingeben) → Windows-Hello-Fenster erscheint und bestätigt. Danach „Sperren" → beim Sperrbildschirm fragt Windows Hello automatisch → Tresor offen. ☐
4. *Abbruch:* Beim Hello-Fenster „Abbrechen" → Tresor bleibt gesperrt, Passwortfeld und Button „Mit Biometrie entsperren" sind da. ☐
5. *Deaktivieren:* „Biometrisches Entsperren deaktivieren" → beim nächsten Sperren kein Hello-Fenster mehr; der Eintrag `bio:vault-dek:…` ist aus dem Credential Manager verschwunden. ☐
6. *Ohne Hello (kein PIN/Gesicht eingerichtet):* Abschnitt zeigt „Nicht verfügbar…", nichts bricht. ☐

**Android (signierte APK)**
7. *Keystore-Schlüssel:* API-Schlüssel speichern, App komplett schließen und neu öffnen, „Verbindung testen" funktioniert. Nach Neustart des Handys ebenfalls. ☐
8. *Biometrie aktivieren:* Accounts → Import, Export & Sicherheit → aktivieren (Master-Passwort) → Fingerabdruck-Dialog → „aktiv". Sperren → Sperrbildschirm zeigt den Dialog → Fingerabdruck → offen. ☐
9. *Abbrechen / falscher Finger:* Dialog abbrechen → gesperrt, Passwort geht weiter; falscher Finger → Dialog meldet Fehler, kein Entsperren. ☐
10. *Fingerabdrücke geändert:* In den Android-Einstellungen einen Fingerabdruck hinzufügen oder löschen → beim nächsten Entsperren erscheint „Biometrisches Entsperren ist nicht mehr gültig…", Master-Passwort entsperrt, Biometrie lässt sich neu aktivieren. ☐
11. *Bildschirmschutz:* Auf der Accounts-Seite Screenshot versuchen (wird blockiert/schwarz), App-Umschalter (Übersicht) zeigt kein Vorschaubild; auf anderen Seiten (Dashboard) normale Screenshots. ☐
12. *Hintergrund-Sperre:* App in den Hintergrund → nach eingestellter Zeit ist der Tresor gesperrt. ☐

**Beide:** Tresor-Daten und KI-Schlüssel bleiben nach einem App-Update erhalten (Update-Test, siehe unten). ☐

### KI-Zugriff / lokale Import-API (Phase 2)
Nur in der Windows-App prüfbar (der Server selbst ist per Rust-Tests geprüft, die Oberfläche per E2E mit Ersatz-Server):
K1. *Aktivieren:* Einstellungen → KI-Zugriff → Schalter an → Status „Läuft auf http://127.0.0.1:47631“. Windows-Firewall fragt **nicht** (nur Loopback). ☐
K2. *Zugang:* „Zugang anlegen“, Name, ToDos Lesen + Schreiben → Schlüssel erscheint einmal, kopieren. PowerShell: `Invoke-RestMethod -Uri http://127.0.0.1:47631/v1/modules -Headers @{Authorization="Bearer <Schlüssel>"}` listet nur ToDos. ☐
K3. *Schutz:* dieselbe Anfrage ohne/mit falschem Schlüssel → 401; im Browser `http://127.0.0.1:47631/v1/modules` öffnen → Fehler (kein Zugriff). Von einem anderen Gerät im WLAN ist der Port nicht erreichbar. ☐
K4. *Probelauf:* `POST /v1/todos/import?dryRun=true` mit einem Eintrag → Ergebnis je Eintrag, in der App erscheint nichts. ☐
K4b. *Import mit Vorschau:* derselbe Aufruf ohne `dryRun` → Banner „… möchte 1 Eintrag in „ToDos“ übernehmen“ → Ansehen → Übernehmen; nach dem Sync ist der Eintrag auf dem Handy. „Import rückgängig machen“ (Einstellungen → KI-Zugriff) entfernt ihn überall. Ein Eintrag mit `id` erscheint als Änderung (alt → neu) und ist nicht vorausgewählt. ☐
K5. *Widerrufen / Port belegt:* Zugang widerrufen → nächste Anfrage 401. Port auf einen belegten Wert stellen → verständliche Meldung. ☐

### Portable Windows-Build (Phase 13)
Nur auf echtem Windows prüfbar (CI baut nur; der Smoke-Test dort ist informativ):
P1. *Start:* `Taschenmesser-Portable.exe` (Pre-Release-Download) starten, SmartScreen „Weitere Informationen → Trotzdem ausführen". Die App öffnet sich, die Daten der bisher installierten Version sind da (gleiche App-Kennung). ☐
P2. *WebView2 fehlt:* auf einem Rechner/VM ohne WebView2 startet die exe → deutsches Meldungsfenster mit „OK" (öffnet die Microsoft-Seite) statt stillem Absturz. ☐
P3. *Portabler Modus:* Ordner `data` neben die exe legen, starten → die App ist leer (neues Profil), `data\` füllt sich; ohne den Ordner wieder das Benutzerprofil. ☐
P4. *Update (erst ab dem zweiten portablen Release):* Kanal Beta → „Jetzt prüfen" → „Jetzt aktualisieren": Backup, Download, die exe ersetzt sich, startet neu, neue Version, Daten da, im Ordner bleiben keine `.old`/`.new`-Dateien (nach dem nächsten Start). ☐
P5. *Fehlerfall:* exe in einen schreibgeschützten Ordner legen und aktualisieren → verständliche Meldung („Ordner nicht beschreibbar"), alte Version läuft weiter. ☐

### Verbindungen, Kalender, Kontoauszug (Phase 13, Schritt 3)
Braucht ein echtes Google-Konto bzw. eine echte Bankdatei – bitte nur mit eigenen Daten, nichts davon in den Chat kopieren:
C1. *Kalender-Abo (ICS):* Einstellungen → Verbindungen → Kalender-Abo: „Geheime Adresse im iCal-Format" deines Google-Kalenders eintragen. Im Browser (PWA) braucht das den Sync-Server (Proxy), in der Windows-App geht es direkt. Termine erscheinen im Kalender mit Badge „Extern", sind nur lesbar; Adresse entfernen → Termine verschwinden. ☐
C2. *Google-Login (nur Windows-App):* eigene Client-ID/Secret eintragen (siehe unten), „Verbinden" → der Browser öffnet die Google-Anmeldung → nach „Zulassen" erscheint die Seite „Die Anmeldung ist abgeschlossen" und die Karte zeigt „Verbunden". Bei einer unverifizierten App zeigt Google eine Warnung („Google hat diese App nicht überprüft" → „Erweitert" → „… öffnen"). ☐
C3. *Kalender-Sync:* nach dem Login erscheint die Liste deiner Kalender (nur der Hauptkalender ist angehakt); „Jetzt abgleichen" holt die Termine. Termin in Google ändern/löschen → nach „Jetzt abgleichen" (oder spätestens nach 30 min) auch hier. Zeiten stimmen (Zeitzone!), ganztägige und mehrtägige Termine ebenfalls. ☐
C4. *Ablauf des Tokens:* Status „Testing" in der Google Cloud Console → nach 7 Tagen zeigt die Karte „Abgelaufen" + „Neu anmelden"; lokale Termine bleiben. („In Produktion" vermeidet das.) ☐
C5. *Gmail-Scan:* Feature „E-Mails" einschalten (neuer Login mit mehr Rechten), dann in Rechnungen/Abos/Verträge/Kalender „… aus E-Mails erkennen" → Zeitraum wählen → Vorschau prüfen. Es darf nur passieren, was du bestätigst; der Vorschau-Text nennt „N Mails gelesen (Absender, Betreff, Datum, Vorschauzeile)". Prüfe, ob die Erkennungsquote brauchbar ist (Heuristiken sind auf erfundenen Beispielen getestet, nicht auf echten Mails). ☐
C6. *Trennen:* „Trennen" → Dialog „Termine behalten / löschen"; danach ist der Zugriff in deinem Google-Konto unter „Sicherheit → Drittanbieter-Zugriff" verschwunden. ☐
C7. *Kontoauszug:* Online-Banking → Umsätze → Export „CSV-CAMT" (oder „CAMT"). **Bitte nur die Kopfzeile (erste Zeile) einer echten Datei prüfen/schicken** und mit `Buchungstag`, `Verwendungszweck`, `Beguenstigter/Zahlungspflichtiger`, `Betrag` vergleichen; dann Finanzen → Einstellungen → Startdaten → „Kontoauszug importieren": Vorschau, Import, zweiter Import zeigt nur „Schon vorhanden". Abos: „Abos im Kontoauszug erkennen" zeigt regelmäßige Abbuchungen. ☐

### Nachrichten (Phase 13, Schritt 4)
N1. *Feed-Adressen des Startpakets:* Nachrichten → „Startdaten einrichten" → Startpaket: die neun Adressen (`web/src/modules/news/starter.ts`) stammen aus dem Gedächtnis und konnten hier nicht geprüft werden. „Aktualisieren" → bei einem Feed mit Fehler unter „Feeds verwalten" steht der Grund; kaputte Adressen ersetzen (oder mir die richtige nennen). ☐
N2. *Browser (PWA):* Abrufen geht nur mit Sync-Server (Proxy); ohne erscheint der Hinweis. In der Windows-App ohne Server. ☐
N3. *„Für später"* legt den Artikel in der Merkliste ab (Modul „Merkliste" muss an sein); „Im Browser lesen" öffnet den Artikel im Standardbrowser. ☐
N4. *KI-Tagesüberblick:* mit eingerichtetem KI-Anbieter → „Tagesüberblick mit KI" → kurze Punktliste; in Einstellungen → KI-Assistent steht der Verbrauch; es werden nur Schlagzeilen gesendet. ☐

### Werkzeuge (Phase 13, Schritt 5)
T1. *QR lesen:* Werkzeuge → QR-Code → „Lesen" → Kamera erlauben → einen QR-Code halten: Text erscheint (Windows-App/Chrome: `BarcodeDetector`; auf dem Handy Kamerarecht in der APK). Wo es nicht geht, steht ein Hinweis; Erzeugen geht immer. ☐
T2. *Währung:* mit Internet: Kurse laden, umrechnen; danach Netz aus → gespeicherte Kurse mit Datum. Die Schnittstelle `api.frankfurter.dev` ist nur per Doku geprüft (in der Windows-App keine CORS-Hürde, im Browser hängt es an deren CORS-Erlaubnis). ☐
T3. *Timer:* Timer starten, Sheet schließen – läuft weiter; bei Ablauf kommt die Benachrichtigung (Windows und Android). ☐

### Links, Teilen, Apps & Links (Phase 13, Schritt 6)
L1. *Karte:* Termin mit Ort → „Auf der Karte zeigen“ öffnet Google Maps (Windows: Browser, Android: Maps-App). ☐
L2. *WhatsApp:* Geburtstage → Knopf neben dem Namen → WhatsApp (Web/App) mit Glückwunschtext, Kontakt wählen. ☐
L3. *Teilen (Android, PWA in Chrome installiert):* in einer anderen App „Teilen“ → Taschenmesser → Seite „Teilen“ mit den Zielen (nur eingeschaltete Module); Merkliste/Notiz/ToDo öffnen vorbefüllt. Die **APK** hat kein Teilen-Ziel (nicht gebaut). ☐
L4. *Apps & Links:* Modul einschalten → „Startdaten einrichten“ → Vorschläge; die acht Startseiten (DHL, Hermes, DPD, Bahn, Maps, WhatsApp Web, Spotify, DWD) im Browser öffnen und melden, welche nicht stimmt. ☐
L5. *Spotify:* nicht gebaut (siehe docs/architecture.md). Soll ein Now-Playing-Widget kommen, brauche ich eine Entscheidung: Premium-Konto als Entwickler nötig, max. 5 Nutzer. ☐

### Einrichtungsassistent
E1. *Aus den Einstellungen starten und abbrechen (Windows-Portable und Android):* Einstellungen → „Einrichtung starten“ → ein, zwei Schritte mit „Weiter“ → X → „Später fortsetzen“; App schließen und neu öffnen: es öffnet sich nichts von selbst; erneut starten bietet „Fortsetzen bei …“. Android: Zurück-Geste fragt nach, statt die Seite zu verlassen. ☐
E2. *Frische Installation (Windows-Portable, dann Android-APK):* Übersicht zeigt die Willkommenskarte (kein Vollbild); „Einrichtung starten“ → alle Schritte durchgehen. Tresor: Master-Passwort festlegen, mit Fingerabdruck bzw. Windows Hello entsperrbar. KI-Anbieter mit echtem Schlüssel: „Verbindung testen“, danach Eintrag `ai-key:<anbieter>` im Credential Manager. Benachrichtigungen: erlauben; Android: Erinnerung bei geschlossener App, Hinweis zu genauen Alarmen/Akku-Optimierung. ☐
E3. *Wiederherstellung aus Backup:* frische App → Schritt „Sync und Wiederherstellung“ → „Backup-Datei einspielen“ → Module/Daten sind da; danach Profile/Startdaten überspringen. ☐
E4. *Bestehende Installation bleibt unberührt:* Update einer App mit Daten: keine Willkommenskarte, keine Checkliste, Daten unverändert; Einstellungen → „Einrichtung starten“ zeigt den aktuellen Zustand, nichts wird ohne Bestätigung geändert (Profil zeigt erst den Diff). ☐
E5. *Google-Verbindung im Assistenten (Windows):* Schritt „Konten verknüpfen“ → Anmeldung starten und im Browser abbrechen bzw. den Assistenten schließen: kein Token gespeichert, Status bleibt „Nicht verbunden“. ☐

## Offen – macht Sven
**Neu (Datenträger):** Die Checkliste D1–D16 oben auf einem echten Windows-Rechner abarbeiten (Windows-Code ist nur per `cargo check --target x86_64-pc-windows-msvc` geprüft, nicht ausgeführt). Windows-Portable-Größe vorher/nachher: nur der Release-Workflow kann sie messen (Dry-Run auf `develop`, siehe HOW-TO).

Installation und Update auf echten Geräten (Windows und Android) – Schritt für Schritt:

1. **Dateien holen (Pre-Release).** GitHub → Repository → *Releases* → das neueste Pre-Release. Die README-Badges („Windows (portabel) herunterladen" …) zeigen auf das *neueste stabile* Release und funktionieren erst, wenn es ein stabiles Release gibt – bis dahin die Dateien direkt von der Release-Seite laden: `Taschenmesser-Portable.exe` (Windows) und `Taschenmesser.apk` (Android). Prüfsumme optional: `Taschenmesser.apk.sha256`.
2. **Von der installierten Windows-Version umsteigen (einmalig, `0.2.0-beta.1` kann sich nicht selbst auf die portable Datei aktualisieren).** (a) Alte App: Einstellungen → Backup → exportieren. (b) `Taschenmesser-Portable.exe` in einen beschreibbaren Ordner legen und starten (SmartScreen: „Weitere Informationen" → „Trotzdem ausführen"; die Datei hat kein Authenticode-Zertifikat, der Update-Inhalt ist mit dem Updater-Key signiert). Die Daten sind sofort da. (c) Alte Version deinstallieren – **„Anwendungsdaten löschen" nicht ankreuzen.** Einstellungen → „App-Updates" zeigt die Version.
3. **Android installieren.** `Taschenmesser.apk` aufs Handy laden und öffnen. Beim ersten Mal „Installation aus unbekannten Quellen" für den Browser/Dateimanager erlauben, dann installieren. Öffnen → Einstellungen → „App-Updates" zeigt die Version. (Vorherige Debug-/anders signierte Version vorher deinstallieren.)
4. **Etwas Testdaten anlegen** (ein ToDo, eine Notiz, ein KI-Anbieter, optional ein Tresor-Eintrag), damit man nach dem Update sieht, dass nichts verloren geht.
5. **Nächstes Pre-Release erzeugen (der Update-Test).** Auf deinem Rechner im Repo: `cd web && npm run version:set -- 0.2.0-beta.3`, dann `git commit -am "chore(release): 0.2.0-beta.3"`, `git tag v0.2.0-beta.3`, `git push origin develop v0.2.0-beta.3`. Der Workflow *Release* baut, prüft (Secret-Scan + Artefakt-Audit), veröffentlicht und prüft danach alle Download-Links (~15 Min.; Fortschritt unter *Actions*). Oder sag mir Bescheid, dann mache ich das.
6. **In der portablen App aktualisieren.** Einstellungen → „App-Updates" → Kanal **Beta** wählen → „Jetzt prüfen" → Banner „Update verfügbar" mit Änderungsliste → „Jetzt aktualisieren".
   - *Windows:* Backup (`%APPDATA%\io.github.sgnemo.taschenmesser\backups\pre-update-…json`), Download, Signaturprüfung, die exe ersetzt sich selbst und startet neu. Version stimmt, Daten sind da. ☐
   - *Android:* Backup → Download → Android-Installer öffnet sich → „Aktualisieren". Beim ersten Mal ggf. „Installation aus dieser Quelle erlauben" aktivieren, zurück in die App und nochmal „Jetzt aktualisieren". Danach neue Version, Daten sind da. ☐
7. **Stabil-Kanal prüfen (optional).** Kanal „Stabil" zeigt die Beta nicht an; erst ein Tag `v0.2.0` (ohne Suffix) wird dort angeboten, und die README-Download-Badges gehen dann.
8. **Rückmeldung.** Klappt etwas nicht: Fehlermeldung/Screenshot und Gerät nennen. Die Update-Logik ist Unit-getestet, aber Austausch der laufenden exe, Installer-Übergabe (Android) und Signaturprüfung sind erst hier real geprüft. Danach die Checklisten oben („Manuelle Tests offen") durchgehen.

9. **Einrichtungsassistent prüfen.** Die Punkte E1–E5 unter „Manuelle Tests offen“ auf Windows-Portable und Android durchgehen (frische Installation und eine mit Daten).

### Google-Verbindung einrichten (einmalig, für Kalender/Gmail)
1. [console.cloud.google.com](https://console.cloud.google.com) → neues Projekt „Taschenmesser".
2. *APIs & Dienste → Bibliothek*: „Google Calendar API" und „Gmail API" aktivieren.
3. *OAuth-Zustimmungsbildschirm* → Typ „Extern"; Name „Taschenmesser", deine Adresse als Support-/Entwickler-Mail. *Bereiche*: `…/auth/calendar.readonly` und `…/auth/gmail.readonly` hinzufügen. **Veröffentlichungsstatus auf „In Produktion" stellen** (ohne Prüfung; beim Login erscheint eine Warnung „nicht überprüft", nur du selbst nutzt es). Im Status „Testing" laufen Refresh-Tokens nach 7 Tagen ab (dann „Neu anmelden").
4. *Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID* → Typ **Desktop-App**. Client-ID und Client-Secret kopieren und in der Windows-App unter Einstellungen → Verbindungen → Google eintragen (landen im Windows-Anmeldeinformationsspeicher, nicht im Repo).
5. **Ungetestet/prüfen:** ob `gmail.readonly` bei einer unverifizierten „In Produktion"-App wie erwartet funktioniert. Wenn nicht: Status auf „Testing" lassen und deine Adresse als Testnutzer eintragen.
6. Android: Google-Login gibt es dort noch nicht; auf dem Handy kommen Termine über die Synchronisierung (sie liegen in einer synchronisierten Sammlung) oder über ein Kalender-Abo (ICS) an.
