# AI actions for a module, eval set

The assistant can add, change, delete or mark entries of a module once the module declares **actions**. Every write ends in the preview; nothing is stored before the user confirms. Design: [architecture/ai.md](../architecture/ai.md) "AI writes".

## Define actions (`web/src/modules/<id>/ai.ts`)
1. Add `actions` next to `collections` (commented template: `web/templates/module/ai.ts`). Keys are short English ids (`create`, `update`, `delete`, `markPaid`, `cancel` …).
2. Per action: `kind` (`create|update|delete|transition`), `collection` (a key of `aiSchema.collections`), German `label`/`description` (one short sentence, it costs tokens in the cloud), `fields` (+ `required`) for create/update, `set` for a transition (`{ status: 'paid' }`), `examples` (invented German sentence → field values, money in cents, dates for 2026-09-29).
3. `parse` hints feed the free rule parser: `keywords` (module nouns for `create`, state words for transitions: `bezahlt`, `erledigt`), `roles` (field per `title|amount|date|startDate|recurrence|time|note|url|quantity`; defaults come from the field types), `defaults` (`'@today'` allowed), `values` (enum chosen by words), `splitItems`, `fallback` (`url|dateTime|amount|date`: default module for a sentence without any module word), `pastDates`.
4. update/delete/transition examples need a `target` – the title the collection's `create` example produces (the registry test creates it first).
5. Side effects (events, other tables): `contributions.aiActionHandlers` with `apply` and an optional `revert` (see `modules/invoices/aiActionHandlers.ts`); otherwise the value change goes through the module's `createRepo`.
6. Never for `accounts` or other secret data (no `aiSchema` at all). Run `npm run check:modules` and `npx vitest run src/core/ai/write`: the registry test runs every example through rules → preview → commit → undo.

## Extend the eval set (`web/tests/ai/eval-set.json`)
- Add **5 inputs per new module** to `cases` (create, change, delete or mark, a typo or slang variant, one negative). `expect` lists the ops (`module`, `action`, `data` subset, `target` = stored title); no ops = must not become an entry. New stored entries needed as targets go into `fixtures`.
- `npm run ai:eval` prints exact / fields off / wrong / passed on, per kind, and every case that is not exact. CI (`npm test`) only guards the numbers (≥ 50 % exact, ≤ 3 % wrong, ≤ 5 % false positives).
