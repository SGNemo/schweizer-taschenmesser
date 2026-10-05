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

- **AI writes (2026-10-05): stage order rules → local model → cloud, every write only after the preview.** Reason: tokens and privacy – most sentences are fully determined by the module words and the extractors (stage 0 handles 94 % of the 154 entries of the eval set exactly, 0 wrong module, 0 false positives on 30 searches/questions; run `npm run ai:eval`); the cloud is the last resort and only with the sentence, the date and field schemas. Actions are declared per module (`aiSchema.actions`, validated by `validateAiActions`), so a new module needs no core change. Deletes and changes show before/after, are one undoable group, and skip entries edited since the preview. Update/delete/mark targets are the user's own words matched on the device, so no candidate list is sent. Modules without actions and the vault stay read-only/invisible. Claude subscriptions cannot be used by third-party apps (Anthropic terms); the supported path for a subscription is Claude Code on the PC driving the local API / MCP ([AI-IMPORT](../AI-IMPORT.md)). Source: `core/ai/write/`, `docs/architecture/ai.md`.

## Test data / seeds (2026-10-02)

- **Seeds are part of every module (`seed` in the manifest is required by the type).** New modules cannot be merged without test data, because the Dev-Preview, E2E tests and screenshots depend on it; `core/seed/registry.test.ts` and `check:modules` fail otherwise. Alternative (optional field + warning) rejected: parallel chats would skip it.
- **Metadata in the manifest, code in `modules/<id>/seed.ts` loaded by glob.** A function in the manifest would end up in the stable bundle; the glob is only reachable through `loadSeed`, which the build replaces with `undefined` unless `VITE_RELEASE_CHANNEL=dev` (`devFlag.test.ts` builds both flavours and greps the output).
- **Own mulberry32 generator instead of faker.** No new dependency or supply-chain surface, tiny bundle, output cannot change with a library update. One stream per module (`hash("42:<module>")`), so adding a module never shifts the others.
- **Seed rows go through `createCollectionRepo` (valid envelope, HLC) but are registered in the local table `_seeds` first.** Outbox, "upload everything" and backup skip registered rows (also in stable builds, so a stable app opening a dev database cannot leak them); the dev switch "Seed-Sync erlauben" (default off) queues them once, and removal then writes tombstones. Modules switched on for the seed are registered too.
- **Demo vault: fixed visible passphrase `nemo-demo-tresor` (10+ characters, `createVault` requires it), dev build only, never overwrites a vault.** Crypto unchanged; the entries use placeholder passwords.
- **E2E for the dev flavour is a separate Playwright project (`seed-dev`, build mode `e2e-seed`, :4174).** The regular specs stay on the stable build so the stable path stays covered.
