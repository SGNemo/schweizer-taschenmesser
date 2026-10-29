# "Mit Partner teilen" without an own server (draft, no implementation)

Finding V09 (`docs/qa/CONSOLIDATED.md`: Mia, Sofía, Lena; contradiction 6 "einfach koppeln vs. selbst hosten"). Today sharing needs the self-hosted sync server; Google Drive adapter is a stub. Goal: a non-technical user shares or copies data to a partner or second device with **no server and no provider account**. The server stays as "Erweitert → Eigener Server". Not part of this PR's code.

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
