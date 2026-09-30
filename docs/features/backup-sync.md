# Backup and sync hardening

Feature notes for the encrypted backups, the backup check, the restore flow, automatic backups
and the sync-server database backup. Security background: `docs/security/AUDIT-2026-09-30.md`.
All data in examples is invented.

## Backup formats

| File | Format | Notes |
|---|---|---|
| `taschenmesser-backup-YYYY-MM-DD.json` | `taschenmesser-backup`, `version: 1` | Plain JSON, unchanged. Old files stay importable (test fixture: `web/src/core/backup/fixtures/backup-v1.json`). |
| `taschenmesser-backup-YYYY-MM-DD.enc.json` | `taschenmesser-backup-encrypted`, `version: 1` | The plain backup sealed with a passphrase. |

Encrypted layout: `{ format, version, createdAt, checksum, blob }`. `blob` is the existing
`encryptWithPassword` payload of the crypto service (Argon2id, 64 MiB / t=3 / p=1 stored in the
header, AES-256-GCM, random 96-bit nonce, AAD `taschenmesser/password-blob/v1/taschenmesser-backup-payload`).
`checksum` is the SHA-256 of `blob.data`: it detects damage or truncation before a passphrase is
needed; the AEAD tag additionally detects deliberate manipulation (a forged checksum still fails to
decrypt). A wrong passphrase and a modified file are indistinguishable by design.

Never included in any backup: sync token and key, API keys, connector tokens, the automatic-backup
passphrase (`_secrets`, `_meta`, `_outbox`, local-only collections).

Code: `web/src/core/backup/{encrypted,verify,restore,apply,safety,auto}.ts`. `backup.ts`
(`createBackup`, `parseBackup`, `importBackup`, …) keeps its public API.

## Check a backup ("Backup prüfen")

`verifyBackup(text, passphrase)` runs six steps and reports each one: format, checksum, decryption,
structure (same validation as an import), dry-run restore into a temporary IndexedDB that is deleted
again, and record counts per module (live records and tombstones). Live data is never touched.

## Restore

1. Preview (`planRestore`): per module how many records are added, replaced and (replace mode) removed.
2. Safety copy (`createSafetyBackup`): native app writes `backups/pre-restore-<stamp>.enc.json` (or
   `.json` without a passphrase) into the app data folder and keeps the newest 3; the browser
   offers a download. If no copy can be made or the user cancels, nothing is restored.
3. `applyBackup` writes everything in **one Dexie transaction** over all affected tables and the
   outbox. A crash or error rolls back completely; there is no half-restored state.

`importBackup(backup, mode, database?, tableNames?)` still exists and now uses the same atomic core
(the former `storage` argument is accepted but ignored).

## Automatic local backups (native app only)

Settings → Backup → Automatische Backups. Rhythm daily or weekly, keep 1–30 copies (default 7),
folder `backups/auto/` in the app data folder, files `auto-YYYYMMDD-HHMMSS.enc.json`. The passphrase
is stored in the platform secret store (OS keystore); config and last result are device-local rows in
`_meta` (`backup.auto.config`, `backup.auto.last`), so no schema change. Each file is
read back and checksum-verified before older copies are rotated away. The PWA has no writable
folder, so it offers manual encrypted export only.

Public API for the setup wizard: `loadAutoConfig`, `saveAutoConfig`, `setAutoPassphrase`,
`hasAutoPassphrase`, `runAutoBackup({ force })`, `startAutoBackup` (already started in `main.tsx`).

## Sync-server database backup

The server keeps everything in one SQLite file (`DB_PATH`, in Docker `/data/sync.db` on the volume
`sync-data`). Do **not** copy the file while the server runs; use the built-in online backup, which is
consistent and verified:

```bash
# Docker (compose service "sync"): writes /data/backups/sync-<UTC stamp>.db, keeps the newest 7
docker compose exec sync node dist/backup-cli.js /data/backups 7

# Without Docker (from server/, after `npm run build`)
DB_PATH=./data/sync.db node dist/backup-cli.js ./data/backups 7
```

Schedule it, for example with cron on the host (nightly at 03:10):

```cron
10 3 * * * cd /path/to/schweizer-taschenmesser/server && docker compose exec -T sync node dist/backup-cli.js /data/backups 7
```

Copy `/data/backups` off the machine, e.g. `docker cp <container>:/data/backups ./sync-backups`. To
restore: stop the server, replace `sync.db` in the volume with a backup file (delete leftover
`sync.db-wal`/`sync.db-shm`), start it. Clients notice nothing unless the data set changed; if the
restored copy is older, devices upload their newer changes again.

What the copy contains: exactly what the server holds. With end-to-end encryption on, values are
ciphertext; without it they are readable. Ids, field names and HLC stamps are readable in both
cases. Treat the folder like the live volume (permissions 0700 are set on creation).

## Sync (protocol 2, additive)

Servers announce protocol 2 on `GET /v1/info` (`features: devices, stats, vault-v2`). Older servers
keep working with the shared token; the app then shows that device management is unavailable.

**Devices.** Connecting with the shared token registers this device (`POST /v1/devices`, id = the
local device id) and stores the returned per-device token instead; the shared token is not kept.
Only SHA-256 hashes are stored on the server. `GET /v1/devices` lists devices with last seen/push/pull;
`DELETE /v1/devices/:id` locks a device out (any authenticated device may do it, so a lost phone can
be locked from the laptop); `POST /v1/devices/:id/rotate` issues a new token (admin, or the device
itself). A locked device gets `401 {"error":"revoked"}`, shows "gesperrt" and stops retrying; its
data stays on the server. Registering devices and `POST /v1/reset` need the shared token.

**Vault v2.** `PUT /v1/vault` accepts `v: 2` with `kdf: {alg: 'argon2id', m, t, p}`; the client derives
the key with the crypto service (Argon2id, same parameters as the password vault). Legacy PBKDF2
vaults are refused (`vault-outdated`); reset the server data to create a v2 vault.

**Conflicts.** When a remote edit meets a local edit of the same field that was not synced yet
(record still in the outbox), last-write-wins keeps the newer value and the other one is logged in the
local table `_conflicts` (schema v13; never synced or exported). Ops written by this device itself
(echoes) are ignored. Settings → Synchronisation → Konflikte shows the overwritten value and can restore
it as a fresh edit (syncs to the other devices) or dismiss it. Values above 20 000 characters are not kept.
Entries expire after 30 days (resolved) or 90 days (open); at most 500 rows.

**Robustness.** Push requests are split to at most 2000 ops / 3 MB; an outbox entry is cleared only
after all its chunks were accepted, so an interrupted first upload resumes and the server ignores
duplicates. Pull advances the cursor page by page. Failed cycles retry with exponential backoff
(5 s doubling to 5 min, ±20 % jitter); locked device, wrong key and similar errors are not retried in
the background. Server: `TRUST_PROXY=true` behind a reverse proxy, `AUTH_FAILURE_LIMIT` (default 20 per
minute and address, then `429`).

**Tombstones.** Synced deletions older than 90 days are removed locally once a day, only after a
successful sync and never while unsynced.

## Proposals (not built)

- **Backup target in a user-chosen folder** (for example a cloud-synced folder): write only the
  encrypted `.enc.json` file there, reusing `encryptBackup`; never the plain JSON.
- **LAN sync without a server:** device-to-device transfer of field ops on the local network,
  authenticated with a pairing code.
