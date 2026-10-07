**English** | [Deutsch](sync.de.md)

# Sync server

A small Node server (Fastify + SQLite) with token authentication. Per field it only stores the value with the
greatest timestamp ("last change wins"); merging happens in the app. Run it in your LAN or via
Tailscale.

## With Docker (recommended, also for a NAS)

```bash
cd server
cp .env.example .env            # set SYNC_TOKEN (at least 16 characters)
docker compose up -d --build
```

The image also builds the PWA and serves it: the app is then reachable at `http://<host>:8787`. The
data lives in the volume `sync-data`.

Generate a token:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

## Without Docker (for example on a Windows PC)

```bash
cd web && npm install && npm run build          # optional: serve the PWA as well
cd ../server && npm install && npm run build
# PowerShell:
$env:SYNC_TOKEN = "<your-token>"; $env:WEB_DIR = "../web/dist"; npm start
# bash:
SYNC_TOKEN=<your-token> WEB_DIR=../web/dist npm start
```

## Configuration (environment variables)

| Variable | Meaning | Default |
|---|---|---|
| `SYNC_TOKEN` / `SYNC_TOKENS` | access token(s), at least 16 characters, several comma-separated. **Required** | – |
| `PORT`, `HOST` | server address | `8787`, `0.0.0.0` |
| `DB_PATH` | SQLite file | `./data/sync.db` (Docker: `/data/sync.db`) |
| `WEB_DIR` | built PWA (`web/dist`), served with SPA fallback | off |
| `CORS_ORIGINS` | allowed origins, comma-separated (`*` = all) | `*` |
| `RATE_LIMIT` | requests per minute and address | `600` |

## On the go: Tailscale and HTTPS

A PWA opened via **HTTPS** may not talk to a plain `http://` server (mixed content), and service
worker/installation need HTTPS. Easiest: share the server (which serves the PWA too) via Tailscale,
so phone and PC use the same HTTPS address:

```bash
tailscale serve --bg 8787       # depending on your Tailscale version; enable HTTPS certificates in the tailnet
# → https://<device>.<tailnet>.ts.net
```

Open this address on your phone and PC, install the PWA from there and connect in the settings under
**Sync** (the address is suggested automatically). In the LAN without HTTPS, sync works
if the app itself was opened via `http://` (or `localhost`).

## Push notifications (optional)

Without push, reminders only appear while the app is open. With **Web Push** your sync server sends them even when the app
is closed (Windows/Android Chrome/Edge; needs HTTPS, for example via Tailscale, and a browser with a push service). Turn it on:
*Settings → Notifications → Enable push* (the app must be connected to the sync server).

- The app uploads the upcoming notifications of the next 14 days (time, title, text) to the server and keeps them current;
  the server sends them on time through the browser's push service (Google/Mozilla/Microsoft only see encrypted messages).
- With **end-to-end encryption**, title and text are encrypted for the server as well (the service worker decrypts them).
- The server generates the VAPID keys on first start and stores them in the database; optionally `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (see `server/.env.example`). The button "Send test via server" checks the whole chain.
- A device that has the app open shows the notification only once (same day as the local reminder).

## Connecting in the app

*Settings → Sync*: enter server address and token, optionally turn on **end-to-end encryption** with
a passphrase (at least 12 characters, ideally several words); encryption is preselected on the first
connection. The app then syncs on start, every minute, after local
changes and when it comes back online/visible; the status is shown in the settings and as an icon at the top.

- **Encryption:** values are encrypted on the device with AES-256-GCM (key derived from the passphrase with
  Argon2id, 64 MiB memory, 3 passes; the parameters are stored with the salt on the server). The server sees collection, record ID, field name and timestamp, **not** the content.
  Further devices join with the same passphrase. Without the passphrase the data **cannot** be recovered.
  Encryption can only be turned on for an empty server; if the server already holds plain-text data,
  the app offers to reset it (this deletes all server data; the devices then upload their data again).
- **Credentials** (token, keys) stay local in the browser's database, are never synced and never
  written into a backup.
- **New or reset server:** the app detects this and uploads all local data.
- **Disconnect** only stops sync on this device; local data stays.

Backups (file, encrypted, automatic): [Backup](backup.md).
