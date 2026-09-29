# Taschenmesser

[![Neueste Version](https://img.shields.io/github/v/release/SGNemo/schweizer-taschenmesser?include_prereleases&label=Version)](https://github.com/SGNemo/schweizer-taschenmesser/releases)
[![CI](https://github.com/SGNemo/schweizer-taschenmesser/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/SGNemo/schweizer-taschenmesser/actions/workflows/ci.yml)

Modulare, local-first Alltags-App – Kalender, ToDos, Erinnerungen, Finanzen, Rechnungen, Abos und weitere
aktivierbare Module. Die Daten liegen lokal auf dem Gerät; ein eigener Sync-Server (optional, auch Ende-zu-Ende
verschlüsselt) gleicht mehrere Geräte ab. Als **portables Windows-Programm** (eine einzelne `.exe`), **Android-App** oder **PWA** nutzbar.

## Herunterladen

[![Windows (portabel) herunterladen](https://img.shields.io/badge/Windows-herunterladen-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Taschenmesser-Portable.exe)
[![Android-APK herunterladen](https://img.shields.io/badge/Android-APK_herunterladen-3DDC84?style=for-the-badge&logo=android&logoColor=white)](https://github.com/SGNemo/schweizer-taschenmesser/releases/latest/download/Taschenmesser.apk)

Die Links zeigen immer auf die **neueste stabile Version**. Alle Versionen (auch Beta) und die Änderungsliste:
[Releases](https://github.com/SGNemo/schweizer-taschenmesser/releases).

### Windows: eine einzelne Datei, keine Installation

1. `Taschenmesser-Portable.exe` herunterladen und an einen beliebigen Ort legen, an dem du schreiben darfst
   (z. B. in einen Ordner unter deinem Benutzerverzeichnis; **nicht** nach `C:\Programme`), und doppelklicken.
2. Windows zeigt eventuell „Der Computer wurde durch Windows geschützt“ (SmartScreen), weil unbekannte
   `.exe`-Dateien ohne gekauftes Code-Signing-Zertifikat immer so behandelt werden: **„Weitere Informationen“ →
   „Trotzdem ausführen“**. Der Update-Inhalt ist mit dem Update-Schlüssel des Projekts signiert; die App prüft
   die Signatur vor jedem Update selbst (und verweigert unsignierte oder fremd signierte Dateien).
3. **Voraussetzung: Microsoft WebView2.** Unter Windows 10/11 ist die Komponente in der Regel schon da (sie gehört zu
   Edge). Fehlt sie, erklärt die App das in einem Fenster und öffnet auf Wunsch die
   [Download-Seite](https://developer.microsoft.com/microsoft-edge/webview2/) („Evergreen Bootstrapper“).
4. **Updates:** Einstellungen → App-Updates. Die App legt zuerst eine Sicherungskopie an, lädt die neue `.exe`,
   prüft die Signatur, ersetzt sich selbst und startet neu (bei einem Fehler bleibt die alte Version erhalten).
   Dafür braucht der Ordner der `.exe` Schreibrechte.
5. **Wo liegen meine Daten?** Standardmäßig im Benutzerprofil (`%LOCALAPPDATA%\io.github.sgnemo.taschenmesser`), nicht
   neben der `.exe`; du kannst die Datei also jederzeit austauschen oder verschieben. **Portabler Modus (z. B. USB-Stick):**
   Lege einen leeren Ordner `data` neben die `.exe` – dann liegen die App-Daten dort statt im Benutzerprofil (die
   automatischen Update-Sicherungen bleiben in `%APPDATA%`).

**Von der installierten Version (Setup/MSI, bis `0.2.0-beta.1`) umsteigen:** Die portable App nutzt dieselbe
App-Kennung und findet deine Daten im Benutzerprofil deshalb sofort wieder.
1. In der alten App: Einstellungen → Backup → exportieren (Sicherheitskopie).
2. `Taschenmesser-Portable.exe` starten und prüfen, dass alles da ist (nicht gleichzeitig mit der alten App laufen lassen).
3. Die alte Version über „Apps & Features“ deinstallieren – im Deinstallationsfenster **„Anwendungsdaten löschen“ NICHT
   ankreuzen**. Falls doch etwas fehlt: Backup in der neuen App importieren.
Die alte installierte Version kann sich nicht selbst auf die portable Datei aktualisieren; der Umstieg ist einmalig manuell.

### Installation unter Android

1. `Taschenmesser.apk` auf dem Handy herunterladen (z. B. im Chrome-Browser) und öffnen.
2. Android fragt beim ersten Mal, ob die **Installation aus unbekannten Quellen** erlaubt ist: **„Einstellungen“ →
   „Aus dieser Quelle zulassen“** für den Browser bzw. die Dateien-App, dann zurück und „Installieren“. Play Protect
   kann eine zusätzliche Prüfung anbieten („Trotzdem installieren“ bzw. „App scannen“).
3. Für spätere Updates fragt die App selbst nach der Erlaubnis („Update installieren“); die neue APK muss mit demselben
   Schlüssel signiert sein, sonst lehnt Android sie ab.

> **Daten aus der PWA übernehmen:** Die installierte App hat einen eigenen Speicher. Umzug über *Einstellungen → Backup*
> (Export in der PWA, Import in der App) oder einfach über den Sync-Server.

Architektur, Konventionen, Releases und der Ablauf „neues Modul anlegen“: siehe [CLAUDE.md](CLAUDE.md).

```
web/            die App (Vite, React 19, TypeScript) – als PWA und als Tauri-Shell
web/src-tauri/  native Hülle (Tauri 2, Rust) für Windows und Android
server/         der Sync-Server (Fastify + SQLite), liefert auf Wunsch auch die PWA aus
contract/       gemeinsame Testfälle für die Sync-Regel (Server und App prüfen dieselben Fälle)
```

## App (`web/`)

Voraussetzung: Node.js ≥ 22.

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

| Befehl | Zweck |
|---|---|
| `npm run build && npm run preview` | Produktionsbuild auf http://localhost:4173 |
| `npm run lint` / `npm run typecheck` | Statische Prüfungen |
| `npm test` | Unit- und Komponententests (Vitest) |
| `npm run e2e` | Alle Ende-zu-Ende-Tests (inkl. Barrierefreiheits-Prüfung mit axe-core) (Playwright, Desktop + „Pixel 7“, danach die Multi-Geräte-Sync-Tests mit echtem Server) |
| `npm run e2e:app` / `npm run e2e:sync` | Nur App-Tests / nur Sync-Tests |
| `npm run gen:module -- <id> "<Name>"` | Neues Modul aus dem Template erzeugen |

Für die E2E-Tests braucht Playwright einen Chromium (`npx playwright install chromium`, oder `PW_CHROMIUM_PATH` setzen).
Die Sync-Tests starten den Server aus `../server` selbst (Abhängigkeiten dort vorher mit `npm install` installieren).

### Module

In der **Modul-Bibliothek** schaltest du Module ein und aus (beim Ausschalten: Daten behalten oder löschen).

| Standardmäßig an | Optional (aus, in der Bibliothek aktivieren) |
|---|---|
| Kalender, ToDos, Erinnerungen, Finanzen, Rechnungen, Abos | **Merkliste** (Links, Lesen, Ansehen, Orte, Ideen mit Tags; auf dem Handy per „Teilen“), **Notizen**, **Einkaufsliste**, **Geburtstage**, **Habit-Tracker**, **Verträge & Garantien** (Kündigungsfristen im Kalender + Erinnerung), **Budgets & Sparziele** (Monatslimits je Finanz-Kategorie, Sparziele mit Einzahlungen), **Packlisten** (als Vorlage kopieren), **Dokumente** (Ablaufdatum + Datei) |

- **Dokumente:** Titel, Kategorie, Ablaufdatum und Notiz werden wie alles andere synchronisiert; die **Dateien bleiben nur auf dem
  Gerät**, auf dem sie hinzugefügt wurden (nicht synchronisiert, nicht im Backup, max. 10 MB je Datei).
- **Teilen → Merkliste (Android):** Nach der Installation als PWA erscheint „Taschenmesser“ im Teilen-Menü; ein geteilter Link öffnet
  „Merken“ mit ausgefülltem Link (Modul „Merkliste“ muss aktiv sein).

### Suche und KI-Assistent

Strg+K (Handy: das Suchfeld oben) öffnet die Befehlspalette: springen, in allen Modulen suchen und Fragen stellen.

- **Lokal, ohne Kosten:** einfache Fragen versteht die App selbst – „Was steht heute an?“, „Termine morgen“, „offene Rechnungen“,
  „überfällige Aufgaben“, „Kontostand“, „Was kosten meine Abos?“, „Wie viel muss ich noch bezahlen?“, „suche Zahnarzt“.
  Kurze Stichworte starten die Volltextsuche.
- **Mit KI (optional):** komplexere Fragen („Wie viel habe ich im September für Lebensmittel ausgegeben?“) und Sätze wie
  „Erinnere mich jeden 1. an Miete“ kann die App an KI-Anbieter geben. *Einstellungen → KI-Assistent*: Anbieter hinzufügen –
  **Claude**, **OpenAI**, **Google Gemini**, **Groq**, **OpenRouter** (auch kostenlose Modelle), **Mistral**, **Ollama** (lokal) oder ein
  eigener OpenAI-kompatibler Server. Mehrere Anbieter werden **der Reihe nach** gefragt (lokal → kostenlos → bezahlt, per Pfeiltasten
  änderbar); ist einer erschöpft, gestört oder abgelehnt, springt der nächste ein. Pro Anbieter lassen sich Limits (Anfragen pro Tag, Kosten
  pro Monat) und Preise einstellen; die Einstellungen zeigen Anfragen, Fehler, Ersatz-Einsätze und geschätzte Kosten. „Verbindung testen“
  prüft einen Anbieter mit einer Minimal-Anfrage. Kostenlose Anbieter nutzen Eingaben teils für Training – die App weist darauf hin.
  In der installierten App (Windows/Android) gibt es keine CORS-Einschränkung; im Browser hängt die Erreichbarkeit vom Anbieter ab.
- **Datenschutz:** an die Anbieter gehen nur deine Frage, das heutige Datum und eine kurze Beschreibung der aktiven Module – **niemals deine
  Daten** (und nie der Passwort-Tresor „Accounts“). Das Modell wählt nur eine strukturierte Abfrage; sie wird lokal geprüft und ausgeführt.
  API-Schlüssel bleiben verschlüsselt in der Datenbank dieses Geräts (nicht synchronisiert, nicht im Backup).
- **Kosten im Blick:** identische Fragen am selben Tag kommen aus dem Cache (0 Token); Verbrauch pro Antwort und insgesamt steht in der Antwort
  bzw. den Einstellungen.
- **Anlegen nur mit Bestätigung:** schlägt die KI einen neuen Eintrag vor, zeigt die App ihn erst an; gespeichert wird nach „Anlegen“.

### Als PWA installieren
Chrome/Edge (Windows) bzw. Chrome (Android) öffnen → „App installieren“. Service Worker und Installation brauchen
HTTPS (oder `localhost`).

## Sync-Server (`server/`)

Ein kleiner Node-Server (Fastify + SQLite) mit Token-Authentifizierung. Er speichert pro Feld nur den Wert mit dem
größten Zeitstempel („letzte Änderung gewinnt“); das Zusammenführen passiert in der App. Betrieb im LAN oder über
Tailscale.

### Mit Docker (empfohlen, auch für NAS)

```bash
cd server
cp .env.example .env            # SYNC_TOKEN setzen (mind. 16 Zeichen)
docker compose up -d --build
```

Das Image baut auch die PWA und liefert sie mit aus: die App ist danach unter `http://<host>:8787` erreichbar. Die
Daten liegen im Volume `sync-data`.

Ein Token erzeugen:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

### Ohne Docker (z. B. Windows-PC)

```bash
cd web && npm install && npm run build          # optional: PWA mit ausliefern
cd ../server && npm install && npm run build
# PowerShell:
$env:SYNC_TOKEN = "<dein-token>"; $env:WEB_DIR = "../web/dist"; npm start
# bash:
SYNC_TOKEN=<dein-token> WEB_DIR=../web/dist npm start
```

### Konfiguration (Umgebungsvariablen)

| Variable | Bedeutung | Standard |
|---|---|---|
| `SYNC_TOKEN` / `SYNC_TOKENS` | Zugangstoken(s), mind. 16 Zeichen, mehrere kommagetrennt. **Pflicht** | – |
| `PORT`, `HOST` | Adresse des Servers | `8787`, `0.0.0.0` |
| `DB_PATH` | SQLite-Datei | `./data/sync.db` (Docker: `/data/sync.db`) |
| `WEB_DIR` | gebaute PWA (`web/dist`), wird mit SPA-Fallback ausgeliefert | aus |
| `CORS_ORIGINS` | erlaubte Origins, kommagetrennt (`*` = alle) | `*` |
| `RATE_LIMIT` | Anfragen pro Minute und Adresse | `600` |

### Von unterwegs: Tailscale und HTTPS

Eine über **HTTPS** geöffnete PWA darf einen reinen `http://`-Server nicht ansprechen (Mixed Content), und Service
Worker/Installation brauchen HTTPS. Am einfachsten: den Server (der die PWA gleich mit ausliefert) per Tailscale
freigeben, damit Handy und PC dieselbe HTTPS-Adresse nutzen:

```bash
tailscale serve --bg 8787       # je nach Tailscale-Version; HTTPS-Zertifikate im Tailnet aktivieren
# → https://<gerät>.<tailnet>.ts.net
```

Diese Adresse auf dem Handy und am PC öffnen, die PWA von dort installieren und in den Einstellungen unter
**Synchronisation** verbinden (die Adresse wird automatisch vorgeschlagen). Im LAN ohne HTTPS funktioniert der Sync,
wenn die App selbst per `http://` (oder `localhost`) geöffnet wurde.

### Push-Benachrichtigungen (optional)

Ohne Push erscheinen Erinnerungen nur, solange die App geöffnet ist. Mit **Web Push** schickt dein Sync-Server sie auch bei geschlossener
App (Windows/Android Chrome/Edge; braucht HTTPS, z. B. über Tailscale, und einen Browser mit Push-Dienst). Aktivieren:
*Einstellungen → Benachrichtigungen → Push aktivieren* (die App muss mit dem Sync-Server verbunden sein).

- Die App lädt die anstehenden Benachrichtigungen der nächsten 14 Tage (Zeitpunkt, Titel, Text) zum Server hoch und hält sie aktuell;
  der Server sendet sie zum Zeitpunkt über den Push-Dienst des Browsers (Google/Mozilla/Microsoft sehen nur verschlüsselte Nachrichten).
- Mit **Ende-zu-Ende-Verschlüsselung** sind Titel und Text auch für den Server verschlüsselt (der Service Worker entschlüsselt sie).
- Die VAPID-Schlüssel erzeugt der Server beim ersten Start und speichert sie in der Datenbank; optional `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (siehe `server/.env.example`). Der Button „Test über den Server senden“ prüft die ganze Kette.
- Ein Gerät, das die App gerade offen hat, zeigt die Benachrichtigung nur einmal (gleicher Tag wie die lokale Erinnerung).

### In der App verbinden

*Einstellungen → Synchronisation*: Server-Adresse und Token eingeben, optional **Ende-zu-Ende-Verschlüsselung** mit
einer Passphrase (mind. 8 Zeichen) einschalten. Danach synchronisiert die App beim Start, jede Minute, nach lokalen
Änderungen und wenn sie wieder online/sichtbar wird; der Status steht in den Einstellungen und als Symbol oben.

- **Verschlüsselung:** Werte werden auf dem Gerät mit AES-GCM verschlüsselt (Schlüssel aus der Passphrase, PBKDF2-
  SHA-256, 600 000 Runden). Der Server sieht Sammlung, Datensatz-ID, Feldname und Zeitstempel – **nicht** die Inhalte.
  Weitere Geräte treten mit derselben Passphrase bei. Ohne Passphrase sind die Daten **nicht** wiederherstellbar.
  Verschlüsselung lässt sich nur auf einem leeren Server einschalten; enthält der Server schon Klartext-Daten, bietet
  die App an, ihn zurückzusetzen (das löscht alle Serverdaten; die Geräte laden ihre Daten danach erneut hoch).
- **Zugangsdaten** (Token, Schlüssel) bleiben lokal in der Datenbank des Browsers, werden nie synchronisiert und nie
  in ein Backup geschrieben.
- **Neuer oder zurückgesetzter Server:** die App erkennt das und lädt alle lokalen Daten hoch.
- **Trennen** beendet nur den Sync auf diesem Gerät, lokale Daten bleiben.

### Backup

*Einstellungen → Backup* lädt alle Daten als JSON-Datei herunter (inkl. gelöschter Einträge für korrektes Mergen, aber
ohne Zugangsdaten). Beim Import: **Zusammenführen** (Konflikte entscheidet die neuere Änderung, nichts geht verloren)
oder **Ersetzen** (das Backup wird zum Stand; auch andere Geräte übernehmen ihn beim nächsten Sync).

### Sicherheit

- Das Token schützt den Server; über reines HTTP im LAN läuft es unverschlüsselt – nutze HTTPS (Tailscale) oder ein
  vertrauenswürdiges Netz. Die Ende-zu-Ende-Verschlüsselung schützt die *Inhalte*, nicht das Token.
- Keine Secrets im Repository: `.env` ist ignoriert, nur `.env.example` ist eingecheckt.
- `CORS_ORIGINS` auf deine Adresse beschränken, wenn du die PWA nicht vom Server selbst auslieferst.
- Der Server-Test-Stand: `cd server && npm test` (Auth, Rate-Limit, Konfliktregel, Persistenz, Auslieferung der PWA).
