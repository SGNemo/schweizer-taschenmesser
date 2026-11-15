# Planner hub – source matrix and friction (chat A)

As of `develop` `6ef3a2cb4`, 2026-11-15. Paths are relative to `web/src/`; a bare `:<line>` in column 2 is `modules/<id>/schema.ts`. Everything was read in the code unless marked _(inferred)_. Link mechanics, the chain Mail → invoice → dunning → planner and the contract constraints (§2, §3): [ANALYSIS-LINKS.md](ANALYSIS-LINKS.md), split off for the docs budget.

## 1 Source matrix

Planner today: **P** = `contributions.plannable`, **B** = calendar blocker only, **A** = `attention` / `calendarItems` only, **–** = nothing. Back channel = callbacks of `PlannableSource` (`core/modules/types.ts:624-651`). Every route below is read by `ui/useOpenParam.ts:12` unless noted.

| Module | Plannable facts | Planner today | Back channel | Entity route | Gap |
| --- | --- | --- | --- | --- | --- |
| todos | `dueDate` :55, `recurrence` :57, `plannedFor` :61, `estimateMin` :65, `startDate` :66, `links` :71 | P (`todos/plannable.ts:59`) | all five: `onAssign`, `onRelease`, `onDone`, `onEstimate`, `onRemove` | `/todos?open=<id>` | hands over only `links[0]` (:76) |
| invoices | `dueDate` :32, `repeat` :39, `dunningLevel`, `dunnedAt` :45-46 | P, `list` only (`invoices/plannable.ts:42`); dunning = `detail` text (:24-35); also A | none, by design (:4) | `/invoices?open=<id>` (:56) | no `link`, no link field in the schema; hard due stays the old `dueDate` (:59) |
| subscriptions | `recurrence` :39, `cancelNoticeDays` :43, `cancelNoticeMonths` :45, `trialEndsOn` :50 | P, kind `cancel`, `list` only (`subscriptions/plannable.ts:83`); also A | none (:4) | `/subscriptions?open=<subId>` | trial end not offered; cannot be ticked in the plan |
| routines | `repeat` :13, `dueDate` :17, `minutes` :25 | P (`routines/plannable.ts`) | `onDone`, `onEstimate` | `/routines?open=<id>` | – |
| fitness | session `date` :22, `time` :23, `durationMin` :27, `planned` :34 | P, pinned to its day (`fitness/plannable.ts`); also A | `onDone`, `onEstimate` | `/fitness?open=<id>` | `time` not handed over; a workout cannot be planned from the planner |
| calendar | event `startDate`…`endTime` :27-31, `recurrence` :36, kind `reminder` :18 | B: timed `event` / `external` only (`core/plan/capacity.ts:20-30`); reminders never | none | `/calendar?open=<id>` | preparation becomes a ToDo with an `event` link (`calendar/components/EventEditor.tsx:443`) the planner never shows |
| mail | none (thread `sortKey` :36 only) | – as a source; „In den Plan“ writes a ToDo with a `mail` link (`mail/planMail.ts:76`) | `todo.doneRequested` (`core/events/events.ts:65`) | `/mail?open=<threadId>` (`mail/routes/MailPage.tsx:300`); desktop only | LINKS §2 |
| notes | no date field | – ; emits `plan.requested` with a link (`notes/routes/NotesPage.tsx:471`), `todo.requested` without one (:278) | none | `/notes?open=<id>` | P46 |
| people | `birthday` :23, `remindDaysBefore` :30, gift `date` :49 | A (all-day calendar items, `people/calendar.ts:21`: a blocker only with `allDayBlocks`) | none | `?open=` → `?person=` | "gift until" is not plannable |
| pantry | `expires` :23 | A (`pantry/manifest.ts:68,79`) | none; `shopping.requested` = name + quantity (`events.ts:46`) | `/pantry?open=<id>` | expiry → shopping → plan carries no id |
| lists | list `tripDate` :30; item `done`, `recurring` | – (no contribution) | – | `/lists?open=<id>` | a shopping trip or packing date cannot be planned |
| budgets | goal `deadline` :37 | A (`budgets/manifest.ts:66`) | none | `/budgets?open=<id>` | context only _(inferred)_ |
| habits | goal `reminder` :39 (times), entry `date` :49 | – (notifications only, `habits/manifest.ts:71`) | none | `/habits?open=<id>` | daily habits take time the planner does not see |
| timetrack | session `date`, `startTime`, `endTime` :36-41 | – | none; `timetrack.start.requested` drops its `sourceRef` (`timetrack/services.ts:46-48`) | `/timetrack?open=<id>` | time spent never reaches an estimate |
| vault (documents) | `endDate` :27, notice :28, `expiresOn` :34 | A (`vault/manifest.ts:61,72`) | none | `/vault?open=<id>` | same deadline kind as subscriptions, not plannable |
| finance | transaction `date` :45, `sourceRef` :49 | A | none | `/finance?open=inv-<invoiceId>` (`invoices/components/InvoiceDetail.tsx:69`) | no source; the one link-by-id-convention that exists |
| weather | nothing stored | A | – | – | context only (a hint on a day), never a source |
| disk, downloads | none; desktop only, `dataApi: false` | – | – | – | no source: Disk "never holds data" (root rule), nothing dated; a clean-up is a plain ToDo |
| accounts | – | **never** | – | – | no `aiSchema`, `searchable`, widget with entries, calendar item, data API (`docs/RULES.md:17`, `modules/CLAUDE.md`, `accounts/__tests__/exclusion.test.ts`); a link label or plan row would be a new exposure |

Totals: 5 of 31 modules are `plannable` (todos, invoices, subscriptions, routines, fitness), 3 of them with a back channel, 1 (todos) with a link.

## 4 Friction (P40–P69)

Sev 3 = breaks the hub promise, 1 = cosmetic. Effort: S ≤ 1 day, M = one package, L = several.

| # | Where | Is | Expected | Kind | Sev | File:line | Fix idea | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P40 | invoice from a mail | mail reference only as a web URL in `note`; the invoice target ignores `f.link` | the invoice knows its mail(s) as data | gap | 3 | `quickCapture/targets/adapters.ts:160-176`, `invoices/schema.ts:22-51` | synced links on the invoice, filled by the target | M |
| P41 | dunning noted on an invoice | level, day, one note line; the dunning mail's id reaches no synced field | the reminder links to its mail | gap | 3 | `adapters.ts:194-220`, `mail/invoiceRow.ts:419-421` | amend appends a `mail` link | S after P40 |
| P42 | plan row of an invoice | no `link`: the menu has „Öffnen“ only | „Zur Mail“ / „Zur Mahnung“ | gap | 3 | `invoices/plannable.ts:51-61` | pass the links through | S after P40 |
| P43 | planner row menu | renders `note` and `mail`; `invoice` and `event` are dropped; one link per item | every kind, several links | inconsistency | 2 | `planner/routes/PlannerPage.tsx:584-603`, `core/modules/types.ts:608` | `links[]` + one resolver in core | M |
| P44 | mail thread „Angelegt“ | opens the module page (`routes[0].path`), not the entry | `?open=<entryId>` | bug | 2 | `mail/links.ts:67`, `mail/components/LinkedEntries.tsx:30` | build the entity route | S |
| P45 | mail → entry back links | `mail_link` is `local: true`: a second device shows nothing | the same answer on every device | gap | 2 | `mail/manifest.ts:48-53` | derive from the synced link on the entry | M |
| P46 | note checklist line → ToDo | `todo.requested` with a title only | a link back, like „In den Plan“ | inconsistency | 2 | `notes/routes/NotesPage.tsx:278` vs `:471` | add `link` | S |
| P47 | source pages | invoice, subscription, session, routine never say „im Plan · Di“ | the source → planner direction | gap | 3 | `core/modules/types.ts:624-651` (no reverse read) | core read "where is `<module>:<id>` planned" | M |
| P48 | invoice / cancellation in the plan | cannot be ticked from the plan (no callbacks) | the tick opens the source's own pay / cancel step | gap | 2 | `invoices/plannable.ts:4`, `subscriptions/plannable.ts:4` | guarded `onDone` → route | M |
| P49 | dunned invoice in the plan | hard due = the original, past `dueDate`; the new deadline is prose, parsed back out of the note | the planner knows the new deadline | inconsistency | 2 | `invoices/plannable.ts:24-35,59` | store the reminder's deadline as a field | M |
| P50 | link kind union | the same literal union five times, closed to 4 kinds | one open type in core | inconsistency | 2 | `types.ts:608`, `events.ts:57,80`, `quickCapture/parser/types.ts:88`, `todos/schema.ts:23` | one `EntityLink` in `core/` | S |
| P51 | ToDo link to a deleted entry | lands on the module page without a word; the link stays for ever | "no longer there" + remove | gap | 1 | `ui/useOpenParam.ts:9-10`, `todos/components/TaskEditor.tsx:301-321` | resolver answers alive / gone | S |
| P52 | calendar event | blocks time only; its ToDo's `event` link is invisible in the plan | event ↔ preparation, both ways | gap | 2 | `EventEditor.tsx:443-448`, `PlannerPage.tsx:584` | falls out of P43 | S |
| P53 | timetrack | `sourceRef` of the start request is thrown away | clock started on a plan row, minutes flow back | gap | 2 | `timetrack/services.ts:46-48`, `events.ts:89` | keep `sourceRef` on the session | M |
| P54 | pantry → shopping | name only; lists are no source | "Einkaufen" as one plannable thing | gap | 2 | `events.ts:46`, `lists/schema.ts:30` | list-level plannable on `tripDate` | M |
| P55 | vault documents, trial ends | deadlines like a cancellation, attention only | treated like subscriptions | inconsistency | 2 | `vault/schema.ts:27-34`, `subscriptions/schema.ts:50` | plannable `list` | S each |
| P56 | invoice note with the mail URL | plain text in the detail panel | a button „Zur Mail“ | gap | 1 | `invoices/components/InvoiceDetail.tsx:52` | superseded by P40 | – |
| P57 | mail link without the mail module | planner hides „Zur Mail“; the ToDo editor opens the web URL | the same fallback in both | inconsistency | 1 | `PlannerPage.tsx:595`, `TaskEditor.tsx:312-316` | shared resolver | S |

P58–P69 unused.

## 5 Open questions for the concept chat

1. Where does a link live: on both entities (two synced writes that can diverge), on one with a derived reverse index, or in one core link collection (new table, `db:bump`, deletes to follow)?
2. An array `links` is one LWW field: two devices adding a link offline lose one. Accept, or one row per link?
3. May a synced invoice carry mail thread / message ids and the subject as a label? ToDos already do (`docs/legal/data-flows-hinweise.md:5`); it widens data API, MCP and backup for invoices.
4. Is a dunning notice a thing of its own (own row, mail, deadline) or a state of the invoice (today)? "Shows in the planner AND on the invoice" reads like the first.
5. Should sources without a back channel get a guarded `onDone` that routes into the module's own confirmation, or stay read-only in the plan?
6. Which undated sources (lists, habits, notes) become `plannable`, and which are only linkable from a ToDo?
