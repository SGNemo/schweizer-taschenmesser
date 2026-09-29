# Taschenmesser

Modulare, local-first Alltags-App (PWA) – Kalender, ToDos, Erinnerungen, Finanzen, Rechnungen, Abos und mehr als
aktivierbare Module. Die Daten liegen lokal in IndexedDB; ein eigener Sync-Server (optional, auch Ende-zu-Ende
verschlüsselt) gleicht mehrere Geräte ab.

Architektur, Konventionen und der Ablauf „neues Modul anlegen“: siehe [CLAUDE.md](CLAUDE.md).

```
web/       die PWA (Vite, React 19, TypeScript)
server/    der Sync-Server (Fastify + SQLite), liefert auf Wunsch auch die PWA aus
contract/  gemeinsame Testfälle für die Sync-Regel (Server und App prüfen dieselben Fälle)
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
| `npm run e2e` | Alle Ende-zu-Ende-Tests (Playwright, Desktop + „Pixel 7“, danach die Multi-Geräte-Sync-Tests mit echtem Server) |
| `npm run e2e:app` / `npm run e2e:sync` | Nur App-Tests / nur Sync-Tests |
| `npm run gen:module -- <id> "<Name>"` | Neues Modul aus dem Template erzeugen |

Für die E2E-Tests braucht Playwright einen Chromium (`npx playwright install chromium`, oder `PW_CHROMIUM_PATH` setzen).
Die Sync-Tests starten den Server aus `../server` selbst (Abhängigkeiten dort vorher mit `npm install` installieren).

### Suche und KI-Assistent

Strg+K (Handy: das Suchfeld oben) öffnet die Befehlspalette: springen, in allen Modulen suchen und Fragen stellen.

- **Lokal, ohne Kosten:** einfache Fragen versteht die App selbst – „Was steht heute an?“, „Termine morgen“, „offene Rechnungen“,
  „überfällige Aufgaben“, „Kontostand“, „Was kosten meine Abos?“, „Wie viel muss ich noch bezahlen?“, „suche Zahnarzt“.
  Kurze Stichworte starten die Volltextsuche.
- **Mit KI (optional):** komplexere Fragen („Wie viel habe ich im September für Lebensmittel ausgegeben?“) und Sätze wie
  „Erinnere mich jeden 1. an Miete“ kann die App an ein Modell geben. *Einstellungen → KI-Assistent*: **Claude** (API-Schlüssel von
  console.anthropic.com, Standard: Claude Haiku 4.5) oder **Ollama** (lokal; Ollama mit `OLLAMA_ORIGINS=*` bzw. der Adresse der App starten,
  das Modell muss Tool-Aufrufe können, z. B. `qwen2.5:7b`).
- **Datenschutz:** an das Modell gehen nur deine Frage, das heutige Datum und eine kurze Beschreibung der aktiven Module – **niemals deine
  Daten**. Das Modell wählt nur eine strukturierte Abfrage; sie wird lokal geprüft und ausgeführt. Der API-Schlüssel bleibt in der Datenbank
  dieses Browsers (nicht synchronisiert, nicht im Backup) und wird direkt von hier an Anthropic gesendet.
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
