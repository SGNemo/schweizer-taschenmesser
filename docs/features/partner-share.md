# "Mit Partner teilen" without an own server

Finding V09 (`docs/qa/CONSOLIDATED.md`: Mia, Sofía, Lena; contradiction 6 "einfach koppeln vs. selbst hosten"). Today sharing needs the self-hosted sync server; Google Drive adapter is a stub. Goal: a non-technical user shares or copies data to a partner or second device with **no server and no provider account**. The server stays as "Erweitert → Eigener Server". Package P1 is built (below); P2–P4 are drafts.

## Principles
- Local-first, no new data holder: the transport is a **QR code or a file** that the users carry themselves (AirDrop, messenger, USB, cloud drive of their own choosing).
- End-to-end encrypted by a short **pairing code** shown on one device and typed on the other; the code never travels with the file.
- Uses the existing merge: field ops with HLC, **LWW rule unchanged** (`core/sync/ops.ts`, `server/src/store.ts`, `contract/lww-cases.json`). Import is a merge, never a replace.
- Opt-in per **list** (collection + filter), nothing is shared by default. `accounts` (vault) is never offered (`exclusion.test.ts`); no attachments (K3).
- Calm wording, no pressure, no nag; off switch = "Teilen beenden" per partner.

## Flows
1. **Zweites Gerät koppeln (whole data set):** Device A: Einstellungen → Koppeln → "Neues Gerät hinzufügen" → shows QR + 6-word code. Device B scans (or opens file) and enters the code → B receives a full snapshot (an encrypted backup, existing `encrypted.ts`, in chunked QR frames or a file) and a **share key**. Later changes travel as small **delta files** ("Änderungen senden" → file/QR; "Änderungen holen" → open file). Manual, so no background traffic.
2. **Liste teilen (Einkauf, Familienkalender):** pick a list, "Mit Partner teilen" → same pairing, but only the chosen collection/filter is in snapshot and deltas. Partner's copy lands in the matching module; ids are shared so merges are idempotent.
3. **Optional later:** same envelope over a self-chosen folder (Syncthing/Drive folder) as the carrier; still no provider integration.

## Format (sketch)
`taschenmesser-share` v1: `{ format, version, pairId, from, createdAt, since: <hlc>, checksum, blob }`. `blob` = `encryptWithPassword` (Argon2id) of `{ scope, ops: FieldOp[] }`, key from the pairing code. `checksum` = SHA-256 of `blob.data` (as in backup). Delta files carry `since`/`upto` HLC so a missed file is detected ("Es fehlt ein Stand") instead of silently skipped. QR: one frame for small deltas (< ~2 KB), animated multi-frame QR otherwise, file as fallback.

## Code placement (when built)
- New `core/share/` (envelope, pairing, scope filter); reuses `core/sync/ops` merge and `crypto.ts`; adds a `SyncAdapter`-like file transport **without touching** `core/sync/**` internals (own folder, own PR, announce to the Sync chat first).
- UI: Settings → "Koppeln" (basic), server under "Erweitert". No Settings.tsx growth beyond one entry; the screen lives in its own file.
- Platform: QR scan needs camera (Android/PWA), file path works everywhere; `getPlatform()` for share sheet / file save.

## Risks and open questions
- Key exchange by code is only as strong as the code: 6 random words ≈ 77 bits with the Argon2id cost; show a countdown/expiry for the *pairing* step.
- Revocation: a removed partner keeps what they already have; say so in the UI. New key = "Neu koppeln".
- Conflicts: LWW applies; the existing conflict log shows overwritten values.
- Deletion: tombstones travel in deltas; retention 90 days (`tombstones.ts`) means a partner offline longer must re-pair via snapshot.
- Scope of a "list" for modules with relations (e.g. shopping + recipes): start with single collections.
- Package plan: P1 envelope + file transport + pairing (one device pair, whole data); P2 per-list scope; P3 QR frames; P4 UI polish. One PR each.

## As built (P1, `feat/partner-share-p1`)
- `web/src/core/share/share.ts`: file `taschenmesser-share` v1 = checksum + `encryptWithPassword` (Argon2id, AES-GCM, own AAD `taschenmesser-share-payload`) of the backup rows (with stamps and tombstones) of the **chosen modules**. Code = 6 random words from the EFF list, normalised (lower case, single spaces), never stored in the file.
- Opening is always a **merge** through `applyBackup` (same LWW rule as sync, nothing deleted, changes queued for sync). `accounts` (vault) and `core` (settings) are never exported and ignored on import (tested with a hand-made file).
- UI: Settings → Verbindungen → "Mit Partner teilen" (`pages/settings/ShareSection.tsx`, texts `strings.share.ts`, 5 languages): choose modules (none preselected), code shown, save file; open file + code → preview (added/replaced per module) → merge.
- Tests: `core/share/share.test.ts` (round trip, LWW, deletions travel, wrong code, tampering, vault ignored), `e2e/share.spec.ts`.
- Not yet at P1: QR frames (P3), delta files (P2), per-list scope (module level only), revocation hints in the UI.

## As built (P2, `feat/partner-share-p2`, stacked on P1)
- **Standing connections** (`core/share/pairs.ts`): device-local `_meta` key `share.pairs` = `{ id, name, modules, sentUpto, receivedUpto, sentAt, receivedAt }`; the code is kept in `getPlatform().secrets` (`share.code.<id>`), never in data, backup, sync or diagnostics. Removing a connection deletes both.
- **Delta files** (`createPairFile`): the header carries the connection id in the clear (random, readable before a code is tried); `since`/`upto` (newest stamp of the shared rows) travel inside the encrypted payload. A file holds only rows with a field stamp newer than `since`; the first file has no `since` (full state). After saving, `sentUpto = upto`; "Alles neu senden" starts over.
- **Gap check** (`followsReceived`): a delta whose `since` is newer than what this device received is refused with "Es fehlt eine frühere Datei" instead of silently missing changes. Re-applying a file is harmless (LWW is idempotent).
- Opening: a file of a known connection uses the stored code (no code field); a file of an unknown connection asks for the code and a name and creates the connection on merge.
- UI: `pages/settings/SharePairs.tsx` (create, save changes, resend all, remove) inside the existing section; tests `core/share/pairs.test.ts`, `e2e/share.spec.ts`.

## As built (P3, `feat/partner-share-p3`, stacked on P2)
- **Frames** (`core/share/frames.ts`): the file text (already sealed by the code) is cut into `NSH1.<session>.<i>.<n>.<base64url chunk>` frames of 400 characters; the collector takes them in any order, with repeats, restarts on a new session, ignores foreign codes; a damaged stitch fails later at the file's checksum/AEAD. More than 150 frames: the screen says the file is easier.
- **Show** (`pages/settings/ShareQr.tsx` `QrPlayer`): one QR (the existing `tools/qr` generator, error correction M) every 450 ms, pause and "next picture"; starts paused when motion is reduced. "Fertig gezeigt" counts the changes as handed over (like saving the file does).
- **Read** (`QrScanner`): camera plus `BarcodeDetector` (Chromium; elsewhere the screen points to the file), progress "n von m Bildern", hands the text to the normal open flow, camera off on done, stop and unmount. Android needs the camera permission; hand tests Q1–Q5 in MANUAL-TESTS.
- Tests: `core/share/frames.test.ts`, `pages/settings/ShareQr.test.tsx` (fake detector and camera: shuffled, repeated frames, camera released), `e2e/share.spec.ts` (frames run, pause, count as handed over).
