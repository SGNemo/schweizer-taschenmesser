# Daten per KI importieren

Du musst vorhandene Daten nicht abtippen: Eine KI deiner Wahl (Claude Code, Claude Desktop, ChatGPT o. ä.) kann sie
für dich in die Module des Taschenmessers schreiben. Dafür gibt es zwei Wege:

| Weg | Wo | Wie |
|---|---|---|
| **A. Lokale Schnittstelle** | nur Windows-App | Die KI spricht direkt mit der App auf deinem PC (`http://127.0.0.1:47631`). |
| **B. JSON einfügen** | überall (Windows, Browser/PWA, Android) | Die KI erzeugt JSON-Text, du fügst ihn im Startdaten-Assistenten ein. |
| **C. MCP-Werkzeug** | Windows-App + Claude Desktop / Claude Code | wie A, aber Claude bekommt fertige Werkzeuge (`list_modules`, `import_items` …). |

In beiden Fällen gilt:

- **Nichts wird ohne dich gespeichert.** Jeder Import erscheint zuerst als Vorschau mit Häkchen, erkannten Duplikaten
  und Fehlern je Eintrag. Erst „Übernehmen“ speichert.
- **Jeder Import lässt sich rückgängig machen.** Einträge, die du inzwischen bearbeitet hast, bleiben stehen.
- **Gleiche Daten zweimal senden erzeugt keine Doppelten.**
- **Vorhandene Einträge werden nie still überschrieben oder gelöscht.** Änderungen erscheinen als „alt → neu“ und
  müssen einzeln angehakt werden. Löschen über die Schnittstelle gibt es nicht.
- Übernommene Daten laufen durch die normale Speicherung und den **Sync** – sie kommen also auch aufs Handy.
- **Der Passwort-Tresor („Accounts“), Einstellungen, Verbindungen und API-Schlüssel sind ausgeschlossen** – weder lesbar
  noch beschreibbar, auch nicht im Schema.

> **Datenschutz:** Was du deiner KI zeigst oder von ihr lesen lässt, verarbeitet der jeweilige KI-Anbieter.
> Gib Lese-Rechte nur für Module, die die KI wirklich braucht. Für einen reinen Import genügt „Schreiben“.

---

## A. Lokale Schnittstelle (Windows-App)

### 1. Einschalten

1. Windows-App öffnen → **Einstellungen → KI-Zugriff**.
2. **„Lokale Schnittstelle aktivieren“** einschalten. Der Status zeigt dann „Läuft auf http://127.0.0.1:47631“.
   - Die Schnittstelle ist nur von diesem PC aus erreichbar (127.0.0.1), nicht aus dem WLAN oder Internet.
   - Sie läuft nur, solange die App geöffnet ist. Standardmäßig ist sie aus.
   - Ist der Port belegt, trage einen anderen ein (1024–65535) und tippe auf „Port übernehmen“.

### 2. Zugang anlegen

1. **„Zugang anlegen“** → Name (z. B. „Claude Code“), Gültigkeit (Standard 90 Tage).
2. **Rechte pro Modul** ankreuzen – standardmäßig ist nichts erlaubt:
   - *Schreiben*: die KI darf Einträge **vorschlagen** (du bestätigst sie in der App).
   - *Lesen*: die KI darf vorhandene Einträge sehen (z. B. um Duplikate zu vermeiden oder etwas zu ändern).
3. *Automatisch übernehmen* nur, wenn du der Quelle voll vertraust: neue Einträge werden dann ohne Vorschau gespeichert
   (Rückgängig machen geht trotzdem; Änderungen vorhandener Einträge brauchen immer deine Bestätigung).
4. **„Anlegen“** → der Schlüssel (`tm_…`) wird **nur jetzt** angezeigt. „Kopieren“ legt ihn für eine Minute in die
   Zwischenablage. Die App speichert nur eine Prüfsumme – geht er verloren, lege einen neuen an („Neu erzeugen“).

Widerrufen wirkt sofort. Unter „Letzte Zugriffe“ siehst du, wann welcher Zugang was aufgerufen hat (ohne Inhalte).

### 3. In der KI eintragen

Tippe in „KI-Zugriff“ auf **„Anleitung für KI kopieren“** und füge den Text in dein KI-Werkzeug ein. Den Schlüssel gibst du
getrennt dazu, am besten als Umgebungsvariable statt im Chat:

- **Claude Code / Terminal (PowerShell):** `$env:TASCHENMESSER_TOKEN = "tm_…"` und im Prompt sagen, dass der Schlüssel in
  `TASCHENMESSER_TOKEN` steht.
- **Claude Desktop / Claude Code als Werkzeug:** mit dem kleinen MCP-Server aus diesem Repo (siehe
  [„C. Als Werkzeug in Claude (MCP)“](#c-als-werkzeug-in-claude-mcp)) – die KI ruft die Schnittstelle dann selbst auf.
- **ChatGPT & Co.:** Diese Programme können `127.0.0.1` meist nicht aufrufen. Nutze dort Weg B (JSON einfügen).

#### Der fertige Prompt

```text
Du hilfst mir, Daten in meine App „Taschenmesser“ zu übertragen. Sie hat eine lokale Schnittstelle:
- Adresse: http://127.0.0.1:47631
- Jede Anfrage braucht den Header "Authorization: Bearer <TOKEN>" (den Schlüssel gebe ich dir getrennt).
- Sende keine Header "Origin" (die App lehnt Anfragen aus dem Browser ab).

So gehst du vor:
1. Lies GET http://127.0.0.1:47631/v1/modules: welche Module du lesen/schreiben darfst, ihre Felder, Beispiele und Hinweise. Das genaue Schema steht unter GET http://127.0.0.1:47631/v1/openapi.json.
2. Sammle meine Daten aus <Quelle, z. B. „meine Excel-Liste im Anhang“>. Erfinde nichts; was du nicht sicher weißt, lässt du weg oder fragst mich.
3. Prüfe zuerst mit POST http://127.0.0.1:47631/v1/<modul>/import?dryRun=true, Body {"items":[…]}, Content-Type application/json.
4. Lies die Antwort: jeder Eintrag hat "status" (ok, duplicate, invalid, update, unchanged) und bei Fehlern "errors". Korrigiere nur die fehlerhaften Einträge und prüfe erneut.
5. Sende dann ohne dryRun, mit einem Header "Idempotency-Key" (z. B. eine zufällige ID pro Sendung). Bei einem Netzwerkfehler denselben Key wiederverwenden – so entstehen keine Doppelten.
6. Die App zeigt mir eine Vorschau; ich bestätige dort. Den Stand siehst du unter GET /v1/batches/<batchId>.

Regeln:
- Beträge als Zahl in Euro (12.5), Datum JJJJ-MM-TT, Uhrzeit HH:mm. Keine Zeitstempel senden.
- Neue Einträge ohne "id". Verweise: Titel eines vorhandenen Eintrags oder "@key" auf einen Eintrag derselben Sendung (mit "key").
- Vorhandene Einträge nur ändern, wenn ich es ausdrücklich will: "id" plus die geänderten Felder. Löschen geht nicht.
- Höchstens 500 Einträge pro Sendung; größere Mengen in mehreren Sendungen.
- Texte sind reiner Text. Zeig mir am Ende eine kurze Zusammenfassung (wie viele Einträge, welche Fehler übrig blieben).
```

### 4. Beispiele (erfundene Daten)

**PowerShell**

```powershell
$base = "http://127.0.0.1:47631"
$h = @{ Authorization = "Bearer $env:TASCHENMESSER_TOKEN" }

# Was darf ich? Welche Felder gibt es?
Invoke-RestMethod "$base/v1/modules" -Headers $h

# Probelauf: speichert nichts, meldet je Eintrag ok / duplicate / invalid
$body = @{ items = @(
  @{ collection = "task"; title = "Winterreifen wechseln"; dueDate = "2026-10-20"; priority = 2 },
  @{ collection = "task"; title = "Stromzähler ablesen" }
) } | ConvertTo-Json -Depth 5
Invoke-RestMethod "$base/v1/todos/import?dryRun=true" -Method Post -Headers $h `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Wirklich senden (wartet auf Bestätigung in der App)
$h2 = $h + @{ "Idempotency-Key" = [guid]::NewGuid().ToString() }
$r = Invoke-RestMethod "$base/v1/todos/import" -Method Post -Headers $h2 `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$r.status   # pending

# Stand abfragen / rückgängig machen
Invoke-RestMethod "$base/v1/batches/$($r.batchId)" -Headers $h
Invoke-RestMethod "$base/v1/batches/$($r.batchId)" -Method Delete -Headers $h
```

**curl** (Git Bash, WSL, macOS/Linux)

```bash
BASE=http://127.0.0.1:47631
AUTH="Authorization: Bearer $TASCHENMESSER_TOKEN"

curl -s -H "$AUTH" "$BASE/v1/modules"

curl -s -H "$AUTH" -H "Content-Type: application/json" \
  "$BASE/v1/finance/import?dryRun=true" -d '{
  "items": [
    {"collection": "account", "key": "giro", "name": "Girokonto Beispielbank"},
    {"collection": "category", "name": "Lebensmittel", "kind": "expense"},
    {"collection": "transaction", "accountId": "@giro", "categoryId": "Lebensmittel",
     "kind": "expense", "amount": 23.45, "date": "2026-09-12", "payee": "Bäckerei Muster"}
  ]}'

curl -s -H "$AUTH" "$BASE/v1/todos/items?collection=task&limit=50"
```

### 5. Endpunkte

Alle Anfragen brauchen `Authorization: Bearer <Schlüssel>` und antworten mit JSON.

| Methode und Pfad | Recht | Zweck |
|---|---|---|
| `GET /v1/modules` | – | erlaubte Module, Sammlungen, Felder, Beispiele, Hinweise |
| `GET /v1/openapi.json` | – | OpenAPI-3.1-Schema (nur erlaubte, eingeschaltete Module) |
| `GET /v1/{modul}/items?collection=&limit=&cursor=&q=` | Lesen | Einträge seitenweise (höchstens 200, `nextCursor` für die nächste Seite) |
| `POST /v1/{modul}/import[?dryRun=true]` | Schreiben | Einträge senden; Header `Idempotency-Key` empfohlen |
| `GET /v1/batches` · `GET /v1/batches/{id}` | – | eigene Importe und ihr Stand |
| `POST /v1/batches/{id}/commit` | Schreiben | übernehmen – nur Zugänge mit „Automatisch übernehmen“ |
| `DELETE /v1/batches/{id}` | Schreiben | wartenden Import ablehnen bzw. übernommenen rückgängig machen |

Antworten auf einen Import:

| Status | Bedeutung |
|---|---|
| `200` + `dryRun: true` | Probelauf, nichts gespeichert |
| `200` + `status: "nothing"` | nichts Neues (alles schon vorhanden oder fehlerhaft) |
| `202` + `status: "pending"` | wartet auf deine Bestätigung in der App |
| `201` + `status: "committed"` | automatisch übernommen |
| `200` (gleicher `Idempotency-Key`) | Wiederholung: derselbe Import wie beim ersten Mal |

Je Eintrag steht in `items[]` ein `status`: `ok`, `duplicate` (schon vorhanden), `invalid` (mit `errors`), `update`
(Änderung eines vorhandenen Eintrags, mit `changes`) oder `unchanged`.

### 6. Format der Einträge

- Jeder Eintrag nennt seine Sammlung: `"collection": "task"`. Die Felder stehen in `/v1/modules`.
- Beträge als Zahl in Euro (`12.5`), optional `"currency": "EUR"`; andere Währungen werden abgelehnt.
- Datum `JJJJ-MM-TT`, Uhrzeit `HH:mm`.
- Neue Einträge **ohne** `id` und ohne Zeitstempel – die App vergibt sie.
- Verweise (z. B. `listId`, `accountId`): Titel eines vorhandenen Eintrags, dessen `id`, oder `"@name"`, wenn ein Eintrag
  derselben Sendung `"key": "name"` trägt.
- Fehlt die Liste bzw. das Konto, nimmt die App die Standardliste bzw. das Hauptkonto.
- **Ändern:** `"id"` eines vorhandenen Eintrags plus nur die geänderten Felder; `null` leert ein Feld.
- Höchstens 500 Einträge und 1 MB pro Sendung.

### 7. Fehler

| Code | Bedeutung | Was tun |
|---|---|---|
| `401 token-missing / token-invalid / token-expired` | Schlüssel fehlt, falsch, widerrufen oder abgelaufen | neuen Zugang anlegen |
| `403 forbidden` | Recht fehlt (z. B. Lesen) | Rechte ergänzen oder anderen Zugang nutzen |
| `403 origin-not-allowed` | Anfrage kam aus einem Browser | aus einem Programm/Terminal aufrufen |
| `403 confirmation-required` | Übernehmen geht nur in der App | in der App bestätigen |
| `404 unknown-module` | Modul aus, nicht freigegeben oder gibt es nicht | Modul einschalten / Recht vergeben |
| `409 idempotency-conflict` | gleicher Key, anderer Inhalt | neuen Key verwenden |
| `413 body-too-large` | mehr als 1 MB | in mehrere Sendungen teilen |
| `421 bad-host` | falsche Adresse | genau `127.0.0.1:<Port>` oder `localhost:<Port>` verwenden |
| `429 too-many-requests` | zu viele Anfragen oder Fehlversuche | eine Minute warten |
| `503 app-not-ready` / `504 timeout` | App beschäftigt oder geschlossen | App öffnen, erneut versuchen |

---

## B. JSON einfügen (ohne Schnittstelle, überall)

1. Modul öffnen → **„Startdaten einrichten“** (oder *Einstellungen → Startdaten*) → **„JSON einfügen“**.
2. **„Schema für KI kopieren“** → in die KI einfügen, dazu z. B.: *„Erzeuge daraus JSON mit meinen Aufgaben aus der
   angehängten Liste.“* Der kopierte Text beschreibt nur das Format und ein erfundenes Beispiel – keine deiner Daten.
3. Die Antwort der KI (`{"items": [ … ]}`) ins Feld einfügen oder als `.json`-Datei wählen → **„Vorschau anzeigen“**.
4. Fehlerhafte Einträge stehen mit Grund in der Vorschau („Nicht importierbar“); gib sie der KI zur Korrektur zurück.
5. Häkchen prüfen → importieren. „Import rückgängig machen“ findest du im selben Assistenten unter „Zuletzt importiert“.

---

## C. Als Werkzeug in Claude (MCP)

Der Ordner [`mcp/`](../mcp) enthält einen kleinen MCP-Server (stdio) – eine dünne Hülle um dieselbe Schnittstelle wie in A.
Er hat keinen eigenen Datenzugriff: Rechte, Prüfung, Vorschau und Rückgängig macht weiterhin die App. Den Schlüssel sendet er
nur an `127.0.0.1`/`localhost`; jede andere Adresse lehnt er ab.

**Voraussetzungen:** Windows-App mit eingeschalteter Schnittstelle und einem Zugang (siehe A), [Node.js](https://nodejs.org) ab
Version 22 und eine Kopie dieses Repos.

1. Bauen (einmalig, in PowerShell im Repo-Ordner):

   ```powershell
   cd mcp
   npm ci
   npm run build
   ```

2. **Claude Code:**

   ```powershell
   claude mcp add --env TASCHENMESSER_TOKEN=tm_… --transport stdio taschenmesser -- node C:\Pfad\zum\Repo\mcp\dist\index.js
   ```

   **Claude Desktop:** *Einstellungen → Entwickler → Konfiguration bearbeiten* (`claude_desktop_config.json`), dann Claude
   Desktop neu starten:

   ```json
   {
     "mcpServers": {
       "taschenmesser": {
         "command": "node",
         "args": ["C:\\Pfad\\zum\\Repo\\mcp\\dist\\index.js"],
         "env": { "TASCHENMESSER_TOKEN": "tm_…" }
       }
     }
   }
   ```

   Anderer Port: zusätzlich `TASCHENMESSER_URL` setzen, z. B. `http://127.0.0.1:50000`.

3. In Claude z. B. schreiben: *„Nutze das Werkzeug taschenmesser. Lies mit list_modules, was erlaubt ist, und übertrage die
   Aufgaben aus der angehängten Liste nach ToDos – erst mit dryRun prüfen, dann senden.“* Danach in der App bestätigen.

| Werkzeug | Aufruf der Schnittstelle |
|---|---|
| `list_modules` | `GET /v1/modules` |
| `get_schema` | `GET /v1/openapi.json` |
| `read_items` | `GET /v1/{modul}/items` |
| `import_items` (`dryRun` ist Pflicht) | `POST /v1/{modul}/import` – ohne dryRun mit automatischem `Idempotency-Key` |
| `list_batches` · `get_batch` | `GET /v1/batches[/{id}]` |
| `commit_batch` | `POST /v1/batches/{id}/commit` (nur mit „Automatisch übernehmen“) |
| `undo_batch` | `DELETE /v1/batches/{id}` |

Der Schlüssel steht in der Konfigurationsdatei deines KI-Programms im Klartext – gib dem Zugang deshalb nur die nötigen
Rechte und eine begrenzte Gültigkeit. Der MCP-Server ist (noch) nicht Teil der Release-Downloads.

---

## Sicherheit

| Bedrohung | Schutz |
|---|---|
| Zugriff aus dem Netz | Die Schnittstelle hört nur auf `127.0.0.1`; es gibt keine Einstellung, das zu ändern. |
| Webseiten im Browser, die den Port ansprechen | Anfragen mit `Origin`/`Sec-Fetch-Site` werden abgelehnt, es gibt kein CORS, der `Host` muss stimmen (Schutz vor DNS-Rebinding). |
| Erraten des Schlüssels | 256-Bit-Zufallsschlüssel, Vergleich in konstanter Zeit, höchstens 20 Fehlversuche pro Minute. |
| Gestohlener Schlüssel | nur die angekreuzten Module und Rechte, Ablaufdatum, sofortiger Widerruf, Vorschau vor jedem Speichern. |
| Überlastung | 120 Anfragen pro Minute und Zugang, höchstens 1 MB pro Anfrage, 8 gleichzeitige Verbindungen, Zeitlimits. |
| Datenlecks | Schlüssel, Inhalte und Personendaten werden nicht protokolliert; Fehlermeldungen wiederholen keine Werte. |
| Tresor und Geheimnisse | „Accounts“, Einstellungen, Verbindungen und API-Schlüssel sind für die Schnittstelle nicht vorhanden. |
| Schadsoftware auf demselben PC | nicht abwehrbar – sie könnte auch die Datenbank der App direkt lesen. Halte Windows aktuell. |

Mehr zur Technik: [`docs/architecture.md`](architecture.md) → „Local AI import API“.
