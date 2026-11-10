# Decisions in full – Core: data, sync, AI

Full text (decision, reason, source). One-line summary table: [DECISIONS](../DECISIONS.md).

New decisions go into the matching topic file as one bullet (not into this index).

- [core-data-ai](core-data-ai.md) – Product & data (local-first, envelope, cents/dates, `now()`, manifest isolation, local-only collections); AI (no user data to the model, three tiers, Zod intents, router, `accounts` invisible and its one widget, AI writes)
- [core-sync](core-sync.md) – Sync: field LWW by HLC, `SyncAdapter`, E2E values, single-tenant server, no tombstone GC, failed-login limit, batched storage adapter, `syncSettled()`, encrypted-server detection, vault server holds ciphertext only
- [core-lan-sync-hub](core-lan-sync-hub.md) – LAN sync: PC as server, hub store (b), Noise channel and pairing (2a), hub core (2b-1), hub network (2b-2)
- [core-lan-sync-devices](core-lan-sync-devices.md) – LAN sync: hub PC syncs (3a), phone pairs (3b), in-app QR scanner, stable port, switch from server, Wi-Fi trigger (4 rest B), second PC
- [core-remote-control-1](core-remote-control-1.md) – Remote control: concept, package 1a (input session, grant), 1b part 1 (PC side in Rust), 1b part 2 (settings, chip, web seam)
- [core-remote-control-2](core-remote-control-2.md) – Remote control: package 2 (phone client, module „Fernbedienung“), package 3 (pointer sink, PC notice)
- [core-seeds](core-seeds.md) – Test data / seeds (2026-10-02): seeds required, `seed.ts`, mulberry32, `_seeds`, demo vault, `seed-dev` E2E
- [core-app](core-app.md) – Diagnostics, bilingual texts, empty-state link, calendar/quick capture/focus steps/home (QA P4), backup checksum, connection log, partner share, „Für“, „Zuletzt gelöscht“, editors save only changes, backlog harvest 2026-11
- [core-runtime](core-runtime.md) – Precache split (tool views, zxcvbn), lazy command palette, shared live queries, in-memory search index, indexed data reads, awaited `module.disabling`, undo scope
