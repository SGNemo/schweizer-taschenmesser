# Sync-Server

Ein kleiner Node-Server (Fastify + SQLite) mit Token-Authentifizierung. Er speichert pro Feld nur den Wert mit dem
größten Zeitstempel („letzte Änderung gewinnt“); das Zusammenführen passiert in der App. Betrieb im LAN oder über
Tailscale.

## Mit Docker (empfohlen, auch für NAS)

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

## Ohne Docker (z. B. Windows-PC)

```bash
cd web && npm install && npm run build          # optional: PWA mit ausliefern
cd ../server && npm install && npm run build
# PowerShell:
$env:SYNC_TOKEN = "<dein-token>"; $env:WEB_DIR = "../web/dist"; npm start
# bash:
SYNC_TOKEN=<dein-token> WEB_DIR=../web/dist npm start
```

## Konfiguration (Umgebungsvariablen)

| Variable | Bedeutung | Standard |
|---|---|---|
| `SYNC_TOKEN` / `SYNC_TOKENS` | Zugangstoken(s), mind. 16 Zeichen, mehrere kommagetrennt. **Pflicht** | – |
| `PORT`, `HOST` | Adresse des Servers | `8787`, `0.0.0.0` |
| `DB_PATH` | SQLite-Datei | `./data/sync.db` (Docker: `/data/sync.db`) |
| `WEB_DIR` | gebaute PWA (`web/dist`), wird mit SPA-Fallback ausgeliefert | aus |
| `CORS_ORIGINS` | erlaubte Origins, kommagetrennt (`*` = alle) | `*` |
| `RATE_LIMIT` | Anfragen pro Minute und Adresse | `600` |

## Von unterwegs: Tailscale und HTTPS

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

## Push-Benachrichtigungen (optional)

Ohne Push erscheinen Erinnerungen nur, solange die App geöffnet ist. Mit **Web Push** schickt dein Sync-Server sie auch bei geschlossener
App (Windows/Android Chrome/Edge; braucht HTTPS, z. B. über Tailscale, und einen Browser mit Push-Dienst). Aktivieren:
*Einstellungen → Benachrichtigungen → Push aktivieren* (die App muss mit dem Sync-Server verbunden sein).

- Die App lädt die anstehenden Benachrichtigungen der nächsten 14 Tage (Zeitpunkt, Titel, Text) zum Server hoch und hält sie aktuell;
  der Server sendet sie zum Zeitpunkt über den Push-Dienst des Browsers (Google/Mozilla/Microsoft sehen nur verschlüsselte Nachrichten).
- Mit **Ende-zu-Ende-Verschlüsselung** sind Titel und Text auch für den Server verschlüsselt (der Service Worker entschlüsselt sie).
- Die VAPID-Schlüssel erzeugt der Server beim ersten Start und speichert sie in der Datenbank; optional `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (siehe `server/.env.example`). Der Button „Test über den Server senden“ prüft die ganze Kette.
- Ein Gerät, das die App gerade offen hat, zeigt die Benachrichtigung nur einmal (gleicher Tag wie die lokale Erinnerung).

## In der App verbinden

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

## Backup

*Einstellungen → Backup* lädt alle Daten als JSON-Datei herunter (inkl. gelöschter Einträge für korrektes Mergen, aber
ohne Zugangsdaten). Beim Import: **Zusammenführen** (Konflikte entscheidet die neuere Änderung, nichts geht verloren)
oder **Ersetzen** (das Backup wird zum Stand; auch andere Geräte übernehmen ihn beim nächsten Sync).
