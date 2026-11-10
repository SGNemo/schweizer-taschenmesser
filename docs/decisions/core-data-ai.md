# Decisions in full – Core – product & data, AI

Part of [core](core.md). Index of areas: [DECISIONS](../DECISIONS.md).

## Product & data

- **Local-first, IndexedDB as source of truth; sync is a separate optional layer.** Data stays on the device; a self-hosted server only relays field operations. Source: CLAUDE.md intro; architecture.md "Sync & backup".
- **One Dexie table per collection, every synced record has an envelope (`id, createdAt, updatedAt, deviceId, deletedAt, _f`); writes only via `createRepo`.** Validation, HLC stamping, tombstones and outbox in one place. Source: architecture.md "Data".
- **Money = integer cents; dates `YYYY-MM-DD`, times `HH:mm` (local wall clock).** Calendar/reminders stay put across time zones and recurrence works on plain dates. Source: architecture.md "Data".
- **`now()` / `today()` instead of `Date.now()`.** Injectable clock makes date logic testable. Source: architecture.md "Data".
- **German-only UI, all texts in `web/src/strings.ts`; code/comments/commits English.** Source: CLAUDE.md.
- **Modules are manifest-driven and isolated (event bus + manifest contributions; only read-only `public.ts` exceptions).** Modules can be switched on/off and stay independent; enforced by ESLint and `registry.test.ts`. Source: architecture.md "Isolation".
- **Subscriptions are forecasts, never auto-booked transactions.** Source: architecture.md "Money & finance".
- **Local-only collections (`CollectionDef.local`, `_blobs`)**: news articles, feed state, vault files never enter outbox/sync/backup. Source: architecture.md "News module", "Extra modules".
## AI

- **Never send user data to the model.** Only instructions, compact `aiSchema` of enabled modules, the date and the question; results are computed locally, no second call. Guarded by `privacy.test.ts` for every adapter. Source: architecture.md "AI assistant"; CLAUDE.md rules.
- **Three tiers, cheapest first:** local German parser (0 tokens) → full text → intent cache → model. Goal: as few tokens as possible. Cache key excludes provider/model so fallbacks share hits. Source: architecture.md "AI assistant".
- **Model output is never evaluated; it is a Zod-validated `Intent` executed against a field whitelist.** Creating entries needs an explicit confirmation card. Source: architecture.md.
- **Multi-provider router with fallback, cooldowns and local limits;** presets are only editable defaults (names/prices unverified). API keys live in `PlatformService.secrets`, never in the config list. Source: architecture.md "Multi-provider AI".
- **`accounts` (password vault) is invisible to AI, search, dataapi and local API** (no `aiSchema`, `dataApi: false`, id block; `exclusion.test.ts`). Source: architecture.md "Password vault"; CLAUDE.md.
- **`accounts` has exactly one widget, and it shows vault status only (2026-11-10, maintainer's yes 2026-11-09):** `docs/RULES.md` "AI privacy" reads "a widget with entries" like root `CLAUDE.md`. "Entries" means anything derived from `accounts_entry`: contents, titles, counts, categories, strength/breach results, attachment names; the status widget shows only not set up (vault header) / locked / unlocked (session state), a fixed hint and one link. Pinned by `modules/accounts/__tests__/exclusion.test.ts`: `widgets` equals `['status']` (a second widget fails), and the source of `StatusWidget.tsx` must not contain `entryRepo`, `useEntries`, `decryptRow`, `saveEntry`, `password` (that file only, not its imports – the rule covers the rest, a transitive check is an open follow-up). Source: [ui-audit-2026-11/LEDGER.md](../design/ui-audit-2026-11/LEDGER.md) Guardian F4.
- **Connectors must not import `core/ai`; news has no `aiSchema`.** Mail/feed text can never reach a model except via the explicit news-brief button (headlines only). Source: architecture.md "Connectors", "News".

- **AI writes (2026-10-05): stage order rules → local model → cloud, every write only after the preview.** Reason: tokens and privacy – most sentences are fully determined by the module words and the extractors (stage 0 handles 94 % of the 154 entries of the eval set exactly, 0 wrong module, 0 false positives on 30 searches/questions; run `npm run ai:eval`); the cloud is the last resort and only with the sentence, the date and field schemas. Actions are declared per module (`aiSchema.actions`, validated by `validateAiActions`), so a new module needs no core change. Deletes and changes show before/after, are one undoable group, and skip entries edited since the preview. Update/delete/mark targets are the user's own words matched on the device, so no candidate list is sent. Modules without actions and the vault stay read-only/invisible. Claude subscriptions cannot be used by third-party apps (Anthropic terms); the supported path for a subscription is Claude Code on the PC driving the local API / MCP ([AI-IMPORT](../AI-IMPORT.md)). Source: `core/ai/write/`, `docs/architecture/ai.md`.
