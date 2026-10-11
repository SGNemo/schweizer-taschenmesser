**English** | [Deutsch](AI-IMPORT.de.md)

# Importing data with AI

You do not have to type in existing data: an AI of your choice (Claude Code, Claude Desktop, ChatGPT or similar) can
write it into Nemo's modules for you. There are three ways:

| Way | Where | How |
|---|---|---|
| **A. Local interface** | Windows app only | The AI talks directly to the app on your PC (`http://127.0.0.1:47631`). |
| **B. Paste JSON** | everywhere (Windows, browser/PWA, Android) | The AI produces JSON text, you paste it into the starter-data assistant. |
| **C. MCP tool** | Windows app + Claude Desktop / Claude Code | like A, but Claude gets ready-made tools (`list_modules`, `import_items` …). |

In every case:

- **Nothing is saved without you.** Every import first appears as a preview with checkboxes, detected duplicates
  and errors per entry. Only "Apply" saves.
- **Every import can be undone.** Entries you have edited in the meantime stay.
- **Sending the same data twice creates no duplicates.**
- **Existing entries are never silently overwritten or deleted.** Changes appear as "old → new" and
  must be ticked one by one. There is no deleting through the interface.
- Imported data goes through normal storage and **sync**, so it also reaches your phone.
- **The password vault ("Accounts"), settings, connections and API keys are excluded**: neither readable
  nor writable, not even in the schema.

> **Privacy:** whatever you show your AI or let it read is processed by that AI provider.
> Only grant read access for modules the AI really needs. For a pure import, "write" is enough.

---

## A. Local interface (Windows app)

### 1. Turn it on

1. Open the Windows app → **Settings → AI access**.
2. Turn on **"Enable local interface"**. The status then shows "Running on http://127.0.0.1:47631".
   - The interface is only reachable from this PC (127.0.0.1), not from the Wi-Fi or the internet.
   - It only runs while the app is open. It is off by default.
   - If the port is taken, enter another one (1024–65535) and tap "Apply port".

### 2. Create an access

1. **"Create access"** → name (for example "Claude Code"), validity (default 90 days).
2. Tick **permissions per module**; by default nothing is allowed:
   - *Write*: the AI may **suggest** entries (you confirm them in the app).
   - *Read*: the AI may see existing entries (for example to avoid duplicates or to change something).
3. Use *Apply automatically* only if you fully trust the source: new entries are then saved without a preview
   (undo still works; changes to existing entries always need your confirmation).
4. **"Create"** → the key (`tm_…`) is shown **only now**. "Copy" puts it on the clipboard for one minute.
   The app only stores a hash; if you lose the key, create a new one ("Regenerate").

Revoking takes effect immediately. Under "Recent access" you see when which access called what (without content).

### 3. Hand it to the AI

In "AI access", tap **"Copy instructions for AI"** and paste the text into your AI tool. Give the key
separately, ideally as an environment variable rather than in the chat:

- **Claude Code / terminal (PowerShell):** `$env:TASCHENMESSER_TOKEN = "tm_…"` and say in the prompt that the key is in
  `TASCHENMESSER_TOKEN`.
- **Claude Desktop / Claude Code as a tool:** with the small MCP server from this repo (see
  ["C. As a tool in Claude (MCP)"](#c-as-a-tool-in-claude-mcp)); the AI then calls the interface itself.
- **ChatGPT & co.:** these programs usually cannot call `127.0.0.1`. Use way B (paste JSON) there.

#### The ready-made prompt

The app copies this text in German today (it matches the app's interface language):

```text
Du hilfst mir, Daten in meine App „Nemo“ zu übertragen. Sie hat eine lokale Schnittstelle:
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

In short: read `GET /v1/modules`, check with `dryRun=true`, fix only the invalid entries, send with an
`Idempotency-Key`, then you confirm the preview in the app. Amounts in euros as numbers, dates `YYYY-MM-DD`, times `HH:mm`,
at most 500 entries per request, no deleting.

### 4. Examples (made-up data)

**PowerShell**

```powershell
$base = "http://127.0.0.1:47631"
$h = @{ Authorization = "Bearer $env:TASCHENMESSER_TOKEN" }

# What am I allowed to do? Which fields exist?
Invoke-RestMethod "$base/v1/modules" -Headers $h

# Dry run: saves nothing, reports ok / duplicate / invalid per entry
$body = @{ items = @(
  @{ collection = "task"; title = "Change winter tyres"; dueDate = "2026-10-20"; priority = 2 },
  @{ collection = "task"; title = "Read the electricity meter" }
) } | ConvertTo-Json -Depth 5
Invoke-RestMethod "$base/v1/todos/import?dryRun=true" -Method Post -Headers $h `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))

# Really send (waits for confirmation in the app)
$h2 = $h + @{ "Idempotency-Key" = [guid]::NewGuid().ToString() }
$r = Invoke-RestMethod "$base/v1/todos/import" -Method Post -Headers $h2 `
  -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body))
$r.status   # pending

# Query status / undo
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
    {"collection": "account", "key": "giro", "name": "Checking account Example Bank"},
    {"collection": "category", "name": "Groceries", "kind": "expense"},
    {"collection": "transaction", "accountId": "@giro", "categoryId": "Groceries",
     "kind": "expense", "amount": 23.45, "date": "2026-09-12", "payee": "Sample Bakery"}
  ]}'

curl -s -H "$AUTH" "$BASE/v1/todos/items?collection=task&limit=50"
```

### 5. Endpoints

All requests need `Authorization: Bearer <key>` and answer with JSON.

| Method and path | Permission | Purpose |
|---|---|---|
| `GET /v1/modules` | – | allowed modules, collections, fields, examples, hints |
| `GET /v1/openapi.json` | – | OpenAPI 3.1 schema (only allowed, enabled modules) |
| `GET /v1/{module}/items?collection=&limit=&cursor=&q=` | Read | entries page by page (at most 200, `nextCursor` for the next page) |
| `POST /v1/{module}/import[?dryRun=true]` | Write | send entries; header `Idempotency-Key` recommended |
| `GET /v1/batches` · `GET /v1/batches/{id}` | – | your own imports and their status |
| `POST /v1/batches/{id}/commit` | Write | apply; only for accesses with "Apply automatically" |
| `DELETE /v1/batches/{id}` | Write | reject a waiting import or undo an applied one |

Answers to an import:

| Status | Meaning |
|---|---|
| `200` + `dryRun: true` | dry run, nothing saved |
| `200` + `status: "nothing"` | nothing new (everything already there or invalid) |
| `202` + `status: "pending"` | waiting for your confirmation in the app |
| `201` + `status: "committed"` | applied automatically |
| `200` (same `Idempotency-Key`) | repetition: the same import as the first time |

Per entry, `items[]` has a `status`: `ok`, `duplicate` (already there), `invalid` (with `errors`), `update`
(change of an existing entry, with `changes`) or `unchanged`.

### 6. Entry format

- Every entry names its collection: `"collection": "task"`. The fields are listed in `/v1/modules`.
- Amounts as numbers in euros (`12.5`), optionally `"currency": "EUR"`; other currencies are rejected.
- Dates `YYYY-MM-DD`, times `HH:mm`.
- New entries **without** `id` and without timestamps; the app assigns them.
- References (for example `listId`, `accountId`): title of an existing entry, its `id`, or `"@name"` if an entry
  of the same request carries `"key": "name"`.
- If the list or account is missing, the app uses the default list or the main account.
- **Changing:** `"id"` of an existing entry plus only the changed fields; `null` clears a field.
- At most 500 entries and 1 MB per request.

### 7. Errors

| Code | Meaning | What to do |
|---|---|---|
| `401 token-missing / token-invalid / token-expired` | key missing, wrong, revoked or expired | create a new access |
| `403 forbidden` | permission missing (for example read) | add permissions or use another access |
| `403 origin-not-allowed` | request came from a browser | call it from a program/terminal |
| `403 confirmation-required` | applying only works in the app | confirm in the app |
| `404 unknown-module` | module off, not granted or does not exist | enable the module / grant permission |
| `409 idempotency-conflict` | same key, different content | use a new key |
| `413 body-too-large` | more than 1 MB | split into several requests |
| `421 bad-host` | wrong address | use exactly `127.0.0.1:<port>` or `localhost:<port>` |
| `429 too-many-requests` | too many requests or failed attempts | wait a minute |
| `429 too-many-pending` | 20 imports are already waiting for confirmation | confirm or reject them in the app |
| `503 app-not-ready` / `504 timeout` | app busy or closed | open the app, try again |

---

## B. Paste JSON (no interface, everywhere)

1. Open a module → **"Set up starter data"** (or *Settings → Starter data*) → **"Paste JSON"**.
2. **"Copy schema for AI"** → paste it into the AI, together with something like: *"Turn my tasks from the
   attached list into JSON in this format."* The copied text only describes the format and a made-up example, none of your data.
3. Paste the AI's answer (`{"items": [ … ]}`) into the field or pick it as a `.json` file → **"Show preview"**.
4. Invalid entries are listed with a reason in the preview ("Cannot be imported"); hand them back to the AI for correction.
5. Check the ticks → import. "Undo import" is in the same assistant under "Recently imported".

---

## C. As a tool in Claude (MCP)

The folder [`mcp/`](../mcp) contains a small MCP server (stdio), a thin wrapper around the same interface as in A.
It has no data access of its own: permissions, checks, preview and undo are still handled by the app. It only sends the key
to `127.0.0.1`/`localhost`; it refuses any other address.

**Requirements:** Windows app with the interface turned on and an access (see A), [Node.js](https://nodejs.org)
version 22 or later, and a copy of this repo.

1. Build (once, in PowerShell in the repo folder):

   ```powershell
   cd mcp
   npm ci
   npm run build
   ```

2. **Claude Code:**

   ```powershell
   claude mcp add --env TASCHENMESSER_TOKEN=tm_… --transport stdio taschenmesser -- node C:\path\to\repo\mcp\dist\index.js
   ```

   **Claude Desktop:** *Settings → Developer → Edit config* (`claude_desktop_config.json`), then restart Claude
   Desktop:

   ```json
   {
     "mcpServers": {
       "taschenmesser": {
         "command": "node",
         "args": ["C:\\path\\to\\repo\\mcp\\dist\\index.js"],
         "env": { "TASCHENMESSER_TOKEN": "tm_…" }
       }
     }
   }
   ```

   Different port: also set `TASCHENMESSER_URL`, for example `http://127.0.0.1:50000`.

3. In Claude, write for example: *"Use the taschenmesser tool. Read with list_modules what is allowed, and transfer the
   tasks from the attached list to To-dos. Check with dryRun first, then send."* Then confirm in the app.

| Tool | Interface call |
|---|---|
| `list_modules` | `GET /v1/modules` |
| `get_schema` | `GET /v1/openapi.json` |
| `read_items` | `GET /v1/{module}/items` |
| `import_items` (`dryRun` is required) | `POST /v1/{module}/import`; without dryRun with an automatic `Idempotency-Key` |
| `list_batches` · `get_batch` | `GET /v1/batches[/{id}]` |
| `commit_batch` | `POST /v1/batches/{id}/commit` (only with "Apply automatically") |
| `undo_batch` | `DELETE /v1/batches/{id}` |

The key sits in plain text in your AI program's config file, so give the access only the permissions it needs and a
limited validity. The MCP server is not (yet) part of the release downloads.

---

## Security

| Threat | Protection |
|---|---|
| Access from the network | The interface only listens on `127.0.0.1`; there is no setting to change that. |
| Web pages in the browser that call the port | Requests with `Origin`/`Sec-Fetch-Site` are rejected, there is no CORS, the `Host` must match (protection against DNS rebinding). |
| Guessing the key | 256-bit random key, constant-time comparison, at most 20 failed attempts per minute. |
| Stolen key | only the ticked modules and permissions, expiry date, immediate revocation, preview before every save. |
| Overload | 120 requests per minute and access, at most 1 MB per request, 20 waiting imports per access, 8 concurrent connections, time limits. |
| Data leaks | Keys, content and personal data are not logged; error messages repeat no values. |
| Vault and secrets | "Accounts", settings, connections and API keys do not exist for the interface. |
| Malware on the same PC | cannot be prevented; it could also read the app's database directly. Keep Windows up to date. |

More on the technology: [`docs/architecture.md`](architecture.md) → "Local AI import API".
