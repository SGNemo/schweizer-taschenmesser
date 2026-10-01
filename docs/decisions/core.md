# Decisions in full – Core: data, sync, AI

Full text (decision, reason, source). One-line summary table: [DECISIONS](../DECISIONS.md).

## Product & data
- **Local-first, IndexedDB as source of truth; sync is a separate optional layer.** Data stays on the device; a self-hosted server only relays field operations. Source: CLAUDE.md intro; architecture.md "Sync & backup".
- **One Dexie table per collection, every synced record has an envelope (`id, createdAt, updatedAt, deviceId, deletedAt, _f`); writes only via `createRepo`.** Validation, HLC stamping, tombstones and outbox in one place. Source: architecture.md "Data".
- **Money = integer cents; dates `YYYY-MM-DD`, times `HH:mm` (local wall clock).** Calendar/reminders stay put across time zones and recurrence works on plain dates. Source: architecture.md "Data".
- **`now()` / `today()` instead of `Date.now()`.** Injectable clock makes date logic testable. Source: architecture.md "Data".
- **German-only UI, all texts in `web/src/strings.ts`; code/comments/commits English.** Source: CLAUDE.md.
- **Modules are manifest-driven and isolated (event bus + manifest contributions; only read-only `public.ts` exceptions).** Modules can be switched on/off and stay independent; enforced by ESLint and `registry.test.ts`. Source: architecture.md "Isolation".
- **Subscriptions are forecasts, never auto-booked transactions.** Source: architecture.md "Money & finance".
- **Local-only collections (`CollectionDef.local`, `_blobs`)**: news articles, feed state, vault files never enter outbox/sync/backup. Source: architecture.md "News module", "Extra modules".

## Sync
- **Field-level last-write-wins by greatest HLC; rule implemented twice on purpose** (`core/sync/ops.ts`, `server/src/store.ts`), pinned by `contract/lww-cases.json`. The server never merges values, only assigns a monotonic `seq`. Change both or neither. Source: architecture.md "Sync & backup".
- **`SyncAdapter` abstraction** (`selfHosted` built; `googleDrive.stub.ts` documents the unbuilt second backend). Source: architecture.md "Layers".
- **Optional E2E encryption of each op value (PBKDF2 → AES-GCM, AAD = `collection/id/field`)**; ids/fields/HLC stay readable because the server needs them. Source: architecture.md "Encryption".
- **Server is single-tenant, no tombstone GC** – accepted known limits. Source: architecture.md "Not built / known limits".

## AI
- **Never send user data to the model.** Only instructions, compact `aiSchema` of enabled modules, the date and the question; results are computed locally, no second call. Guarded by `privacy.test.ts` for every adapter. Source: architecture.md "AI assistant"; CLAUDE.md rules.
- **Three tiers, cheapest first:** local German parser (0 tokens) → full text → intent cache → model. Goal: as few tokens as possible. Cache key excludes provider/model so fallbacks share hits. Source: architecture.md "AI assistant".
- **Model output is never evaluated; it is a Zod-validated `Intent` executed against a field whitelist.** Creating entries needs an explicit confirmation card. Source: architecture.md.
- **Multi-provider router with fallback, cooldowns and local limits;** presets are only editable defaults (names/prices unverified). API keys live in `PlatformService.secrets`, never in the config list. Source: architecture.md "Multi-provider AI".
- **`accounts` (password vault) is invisible to AI, search, dataapi and local API** (no `aiSchema`, `dataApi: false`, id block; `exclusion.test.ts`). Source: architecture.md "Password vault"; CLAUDE.md.
- **Connectors must not import `core/ai`; news has no `aiSchema`.** Mail/feed text can never reach a model except via the explicit news-brief button (headlines only). Source: architecture.md "Connectors", "News".
