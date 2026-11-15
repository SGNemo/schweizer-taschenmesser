# Planner hub – link contract and dunning chain (chat D)

As of `develop` `9881b9144`, 2026-11-15. Input: [ANALYSIS-SOURCES.md](ANALYSIS-SOURCES.md), [ANALYSIS-LINKS.md](ANALYSIS-LINKS.md), [ANALYSIS-RESEARCH.md](ANALYSIS-RESEARCH.md). Source plan, packages, UI texts, risks and resolved friction (§3, §5, §6): [CONCEPT-SOURCES.md](CONCEPT-SOURCES.md). Paths relative to `web/src/`. Every decision is revisable (§4). Council round 1 (Architect, Guardian; 2026-11-15) is folded in: §7.

## 1 Link model „one thing, many places“

| Variant | What | Benefit | Cost |
| --- | --- | --- | --- |
| **Small** | `PlannableItem.links[]` instead of `link` (`core/modules/types.ts:608`); the planner renders every kind | fixes P43, P52, P57 in a day; no stored shape changes | one direction only; invoices still know no mail (P40–P42, P45, P47 stay) |
| **Medium** | one `EntityLink` type, a `linkTarget` resolver per module, one synced link table with a reverse read in core | both directions on every device; a module becomes linkable without a schema bump; one place pins the vault ban | new synced table, orphan handling, one data-flow paragraph |
| **Large** | the planner stores a copy of every module's things (inbox) | one list of everything | a second truth for title / done / due; contradicts „the source owns what it has“ (`docs/decisions/plan-contract.md`, source contract) |

**Recommended: medium, cut so that small ships first (L1).** K1 = small (types, resolver, planner rendering; no storage). K2 = table, reverse read, copy of the ToDo links. Large is rejected: the hub links, it never owns.

### 1.1 Shapes

New folder `core/entitylinks/` (`core/links.ts:1` already exists for outgoing web links, so not `core/links/`).

```ts
// core/entitylinks/types.ts
export interface EntityRef { module: string; id: string } // key `<module>:<id>`, as the planner's itemKey
export type LinkRel = 'origin' | 'dunning' | 'about';       // stored as a plain string: unknown values read as 'about'
export interface EntityLink {
  from: EntityRef;   // the thing that carries the link (ToDo, invoice)
  to: EntityRef;     // where it leads (mail thread, note, event, invoice)
  rel: LinkRel;
  label: string;     // target's title when the link was made; the fallback where the target cannot be read
  on?: string;       // 'YYYY-MM-DD' of the occasion (the mail's day) → „Mahnung aus Mail vom 3. Nov.“
}
/** The four literal unions of today (P50) become this one alias; the stored ToDo shape stays. */
export type LegacyLink = { kind: 'note' | 'mail' | 'invoice' | 'event'; id: string; label: string };
export const refOfKind = { note: 'notes', mail: 'mail', invoice: 'invoices', event: 'calendar' } as const;

// core/modules/types.ts (additive)
export type LinkState =
  | { state: 'alive'; title: string; to: string; done?: boolean } // `to` = the entity route
  | { state: 'gone' }                                             // soft-deleted or never synced here
  | { state: 'elsewhere'; url?: string };                          // cannot be told on this device (mail cache)
export interface LinkTarget { resolve(id: string): Promise<LinkState> } // reads only the module's own data
// ModuleContributions.linkTarget?: () => Promise<{ default: LinkTarget }>;
// PlannableItem.links?: Omit<EntityLink, 'from'>[];   `link` stays, deprecated, read as links[0]
// PlannableItem.action?: { label: string; to: string } // §2: main action of a row without a tick

// core/entitylinks/index.ts – the only writer and reader
addLink(link: EntityLink): Promise<() => Promise<void>>; // idempotent; returns its undo
removeLink(id: string): Promise<void>;
linksOf(ref: EntityRef): Promise<ResolvedLink[]>;        // both directions, the other end resolved
useLinks(ref: EntityRef): ResolvedLink[] | undefined;    // live
plannedDay(ref: EntityRef): Promise<string | undefined>; // „Im Plan · Di“ (P47)
```

`ResolvedLink` = the link, its direction and the other end's `LinkState`; core itself answers `{ state: 'unavailable'; url? }`, without calling the module, when the target module is off or not on this platform (`availableManifests()`).

`plannedDay` is a core read through the generic manifest repo – the sanctioned cross read (`modules/mail/planMail.ts:171-177`, `quickCapture/targets/lookup.ts:76`): the earliest live `planner_assignment` of `itemKey`; for a thing that is no plan item itself, the day of a ToDo linking to it. `undefined` while the planner is off.

### 1.2 Where a link is stored (L2): one row per link, in a core table

Decision: synced system table **`_links`**, one row per link – not an array on the entity.

- **LWW:** merge is per field by greatest HLC (`core/sync/ops.ts:2-3`). An array `links` is one field: the desktop adds „dunning mail“, the phone adds a note link offline → one is lost; remove vs. add likewise. One row per link with a deterministic id makes adds commute, the same add on two devices converge, and a removal a tombstone of that one link.
- **Reverse read** is one indexed query on `toKey` (arrays: a scan of every collection). No module schema change to become linkable; the vault ban sits in one function.
- **Why a core table is allowed:** the `<moduleId>_<collection>` rule covers module collections; synced system tables exist beside them (`_settings`, `_modules`, `core/db/schema.ts:22-23`) and already travel through sync and backup (`syncedTableNames`, `core/db/schema.ts:54-68`; `core/backup/backup.ts:69`). A link belongs to two modules, so to neither. Server and LAN hub key ops by a free collection name (repo root: `server/src/app.ts:91`, `web/src-tauri/crates/lan-sync/src/store.rs:78`) – no change there, the LWW contract is untouched.
- Stores `'id, updatedAt, fromKey, toKey'`; `npm run db:bump` + previous stores into `core/db/schema-history.json`. Row = `EntityLink` + `fromKey`, `toKey`. **Id = a SHA-256 hex of `[fromKey, rel, toKey]`** (the helper behind `captureId`, `quickCapture/targets/index.ts:45`, moved to core): a record id travels in clear and is capped at 128 characters (`core/sync/crypto.ts:105-108`, `server/src/app.ts:92`, `web/src-tauri/crates/lan-sync/src/hub/validate.rs:96`), so no ref, module name or `rel` may appear in it; `fromKey`, `toKey`, `rel`, `label`, `on` are encrypted fields. Written through `createRepo`, like `_settings` (`core/settings/settings.ts:9`).
- **Add and remove:** `addLink` by a tap restores a tombstoned row; every other writer (migration copy, a repeated add of a live row) creates only when absent, and a tombstone counts as present – so a removal wins over a stale re-add and nothing is resurrected.
- **Sync / backup:** like `_settings`: synced, values E2E, in the backup. **Data API, MCP, local API, search, share, automation, `aiSchema`:** none – every one of these surfaces enumerates manifests only (`core/dataapi/scope.ts:13-19`, `core/localapi/handler.ts:151`, `core/ai/scope.ts:13`, `core/ai/search/index.ts:86-94`, `core/share/share.ts:36`, `core/automation/ingest.ts:13`); a `_links` row never reaches an assistant (the frozen ToDo `links[]` stays where it is today). K2 pins this in `core/entitylinks/exclusion.test.ts`: a recognisable label in `_links` appears in no data-API/OpenAPI output, AI prompt, search index, share file, automation event or diagnostics report. Answer to Q3: the invoice's import format does not widen.
- Rejected: links on both entities (two writes that diverge); `planner_link` (links must work with the planner off).

### 1.3 Delimitation and migration

| Existing | Stays? | Rule |
| --- | --- | --- |
| ToDo `links[]` (`modules/todos/schema.ts:71`) | field stays, frozen | K2 copies each entry once into `_links` (deterministic ids, so two migrating devices write the same row; create only when absent, a tombstone counts as present); new code writes rows only; readers show rows ∪ array, deduplicated; removing drops both. Shape unchanged → **no** `manifest.version` step for ToDos; import format keeps `links`. An older app keeps showing its array links and misses new ones – nothing breaks. |
| `PlannableItem.link` | deprecated | read as `links[0]`; `links[]` stays for links a source computes and never stores (finance booking `inv-<id>`, `modules/invoices/components/InvoiceDetail.tsx:69`) |
| `mail_link` (`modules/mail/manifest.ts:48-53`) | stays device-local | it holds account key and message id, which never sync; it keeps answering „did this device file this message“. The visible list „Angelegt“ reads `_links` by `toKey = mail:<threadId>` ∪ `mail_link` (P45) and links to `?open=<entryId>` (P44). No back-fill of old invoices. |
| `planMark`, planner `source` | untouched | not links: ownership of a date, and the planner's key. `plannedDay` reads them. |

Mixed versions: an older app never writes `_links`, and it **drops** pulled ops of a table it does not know while its cursor moves on (`core/storage/dexie.ts:107-110`, `core/sync/engine.ts:129-132`; known: `docs/decisions/modules-retired-notes.md:7`) – after its update the rows would be missing for good. **K2 therefore ships a generic repair first:** the set of synced tables is kept in `_meta`; when it grows, the pull cursor restarts at 0 (re-applying is idempotent, `core/sync/engine.ts:70`). Test: a device that pulled `_links` ops before updating holds them afterwards. Server and LAN hub accept any collection name of the pattern (`server/src/app.ts:91`, `validate.rs:75-80`); the contract fixtures are untouched.

### 1.4 Privacy

- A mail link holds the provider thread id, the subject as label and the mail's day. Never an address, account key, message id or body; the mail cache stays `local: true`. The label is the subject as received minus reply prefixes (`core/mail/prefill.ts:39-40`; it falls back to the sender name, `:82`), capped at 120 characters – it may contain anything the sender wrote. New: this now also applies to invoices, and the day is new for ToDos too → K2 rewrites both paragraphs (Mail → ToDo, Mail → Rechnung) of `docs/legal/data-flows-hinweise.md` in the same PR: Thread-Id, Betreff, Tag der Mail; values are unreadable for the server only with E2E on (L3).
- **Resolver rules:** ids are untrusted (the mail resolver passes them through `safeThreadId`); a resolver does no network; an external URL opens only on a tap; `label` renders as a text node; `on` must match `YYYY-MM-DD`.
- **Mail on the phone / on a desktop without the thread:** `unavailable` / `elsewhere` → the chip shows the label and „Im Browser öffnen“ / „Open in browser“ (`mailThreadUrl`, `core/mail/service.ts:84`, no address). One rule for planner and ToDo editor (P57).
- **Gone:** the resolver tells soft-deleted from alive. The chip reads „<Label> · Gibt es nicht mehr.“ / „… · No longer exists.“ with „Entfernen“ / „Remove“; nothing is removed by itself except rows whose `from` entity's tombstone is purged on this device: those link rows are soft-deleted (a tombstone that syncs), then purged like any row; wiping a module tombstones its `from` rows. The sweep touches link rows only, never an entity; a row or module that is merely missing on this device is never a reason. A foreign or malformed id resolves to `gone`, never to a request.
- **`accounts`:** never `from`, never `to`. Pinned twice: `addLink` throws for it (`core/entitylinks/exclusion.test.ts`, new), and the vault's contribution keys stay exactly `['onboarding', 'services']` (`modules/accounts/__tests__/exclusion.test.ts:56`), so a `linkTarget` there fails today's test. Rows that arrive by sync, restore or the migration copy bypass `addLink`: `linksOf` / `useLinks` and the copy drop every row whose `from` or `to` module is `accounts` or has no `linkTarget`; the exclusion test covers write, read and migration.

### 1.5 One truth for „done“ (L4)

A link never writes state. The owner of „done“ is always the entity; every other place reads it (`LinkState.done`) or asks the owner through what exists: `PlannableSource.onDone` (`core/modules/types.ts:638`), `todo.doneRequested` (`core/events/events.ts:65`), the module's own action. No copy of the state exists, so there is nothing to write twice; the undo is the owner's one undo. A ToDo linking to a paid invoice shows „Rechnung · bezahlt“ and stays the person's to tick.

### 1.6 Engine

Links, `action` and `detail` are display only: they stay out of `inputHash` (built from explicit `PlanItem` fields, `modules/planner/run.ts:198-212`) and out of `core/plan/**`; K1 adds the test „same plan with and without links“. `fixed` and `blocks` do move things: they enter the hash in the package that first reads them (S4), with a decision bullet, because `blocks` widens „blockers come from calendar items only“ (`docs/decisions/plan-contract.md`). What moves a thing is a source fact (§2: the dunned deadline), never a link.

## 2 Dunning chain

**L5 A dunning is a state of the invoice, not a thing of its own** (answer to Q4). One thing shown in three places: the plan row keeps its key `invoices:<id>` (pins and the day survive), so there is no second row and no second „done“. **L6 The reminder's claims become fields** (P49): `dunnedDueDate?` and `dunnedAmountMinor?` beside `dunningLevel` / `dunnedAt` (`modules/invoices/schema.ts:45-46`) – flat, each its own LWW field; `manifest.version` + an empty migration step. Amount and `dueDate` of the invoice stay untouched, as today (`quickCapture/targets/adapters.ts:186-191`). `planDetail` reads the fields and keeps the note-line parse (`modules/invoices/plannable.ts:24-35`) for reminders noted before.

| Step | Tap | Writes | Seen |
| --- | --- | --- | --- |
| 1 Invoice mail | „Anlegen“ | invoice `mail-<hash>` (as today); `_links` row invoice → mail, `origin`; `mail_link` (local) | invoice: „Aus Mail“ |
| 2 Dunning mail | „Mahnung vermerken“ (one tap) | `amend`: level, day, note line (as today) + `dunnedDueDate`, `dunnedAmountMinor`; `_links` row invoice → mail, `dunning`, `on` = mail day. One `undoable`. | toast „Mahnung vermerkt · Im Plan · Di“ |
| 3 Planner | – (no write: the source lists it) | – | row „Stadtwerke bezahlen“, detail „Mahnung · 92,40 € bis 13.10.“, hard due = `dunnedDueDate ?? dueDate`, priority 3 while dunned; a hard deadline the person set on the plan row still wins today (`modules/planner/run.ts:164`) – with a dunned date the **earlier** of the two counts; row links „Zur Rechnung“, „Zur Mahnung“, „Zur Mail“ |
| 4 Invoice page | – | – | „Aus Mail“ · „Mahnung aus Mail vom 3. Nov.“ · „Im Plan · Di“ |
| 5 Mail thread | – | – | „Angelegt: Rechnung Stadtwerke“ → `/invoices?open=<id>` |
| 6 Paid | „Bezahlt“ in invoices | `markPaid` (`modules/invoices/actions.ts:68`), `invoice.paid` → finance | row leaves the plan; mail and links stay; chips read „bezahlt“ |

Noting the same reminder twice writes nothing (`adapters.ts:207-208`); the link id is deterministic, so neither does the link. No planner module → steps 1, 2, 4–6 work unchanged.

**L7 Tick on a money row.** The decision „no tick, paying stays a money action“ (`docs/decisions/plan-packages-2-5.md`, „More sources without write-back“) stands. Minimal honest change: the row gets `action` in the tick's slot (P76) – „Bezahlt …“ → `/invoices?open=<id>&do=pay`, which opens the invoice's own pay step (date, part payment, its undo toast). The planner writes nothing (answer to Q5: no guarded `onDone`, a declared route). `open` and `do` are untrusted input (the PWA is URL-addressable, `markPaid` books into finance, `modules/invoices/actions.ts:68-72`): the id is checked, `do=pay` only **opens** the pay step and never calls `markPaid`, both params are stripped after reading, unknown values are ignored. Test: the route with `do=pay` causes zero writes. Subscriptions: „Kündigen …“.

**Second device:** all of steps 1–2 is synced data, so the invoice, its plan row and both links appear. A desktop without the thread in its cache gets `notHere` today (`modules/mail/routes/MailPage.tsx:309-311`) → `elsewhere`. **Phone:** the mail module does not exist (`modules/mail/manifest.ts:64`): chips show the subject and „Im Browser öffnen“; „Bezahlt …“ works. A dunning cannot be *noted* on the phone – accepted, mail is desktop only (WE W15).

UI texts (German + English): [CONCEPT-SOURCES.md](CONCEPT-SOURCES.md) §3.5.

## 4 Decisions

| Id | Decision | Why | Revisable how |
| --- | --- | --- | --- |
| L1 | medium model, small step first | both directions need a reverse read; small alone leaves P40–P47 | stop after K1 |
| L2 | one row per link in `_links` | LWW per field; reverse index; no module bump | rows can be folded back into fields by a migration |
| L3 | invoices may carry thread id + subject (Q3) | same class as ToDos; not in the data API | drop rel `origin`/`dunning` to `mail` |
| L4 | „done“ only at the owner, links read it | no double write, one undo | – |
| L5 | dunning = state of the invoice (Q4) | one thing, one „done“, stable plan key | an own collection later, the link rel stays |
| L6 | `dunnedDueDate`, `dunnedAmountMinor` as fields | the engine needs a date, not prose | fields are optional |
| L7 | money rows: `action`, no tick (Q5) | keeps the decision of 2026-11-06 | `onDone` can be added per source |
| L8 | Q1/Q2: one place, rows (= L2) | see 1.2 | – |
| L9 | Q6: an undated thing never enters the plan by itself; only via „In den Plan“ or a ToDo link ([CONCEPT-SOURCES.md](CONCEPT-SOURCES.md)) | stimulus load | per-source switch |
| L10 | research Q2: a late invoice stays a plan thing with its action, shown in the design chat's group „Frist vorbei“ | it is still to do | design chat E |
| L11 | research Q1: planner stays off by default and in no profile (F3, 2026-11-08, `docs/qa/round-5/a/FOLLOWUP.md:25`); „In den Plan“ shows only while it is on; links and „Aus Mail“ work without it | the hub must not force a module on first-contact users | **Wartet auf Sven** only if he wants it in a profile – recommendation: after the redesign, not now |
| L12 | no back-fill of links for invoices filed before K2 | no synced write without a tap | a one-tap „Verknüpfen“ later |

## 7 Council round 1 (2026-11-15)

Verdicts: Architect and Guardian „ready with changes“, all folded in. Blockers: the row id was plaintext with refs in it (now a hash, §1.2); an older app drops `_links` ops for good (cursor repair first, §1.3). Should: no resurrection by the migration copy (§1.2, §1.3); orphans as tombstones (§1.4); vault ban also on read and migration (§1.4); untrusted `?do=pay` (§2); the earlier deadline wins (§2); legal text for invoices and the mail day (§1.4); exclusion test over every surface (§1.2); document titles stay off the overview, `planRowAction` outside `core/plan/**`, the list request channel and the split of K1 ([CONCEPT-SOURCES.md](CONCEPT-SOURCES.md) §3.2–3.4).

## 5, 6 Risks, scope, friction resolved

In [CONCEPT-SOURCES.md](CONCEPT-SOURCES.md) §5 and §6.
