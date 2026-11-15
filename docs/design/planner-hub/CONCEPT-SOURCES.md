# Planner hub – source plan, packages, risks (chat D)

§3, §5 and §6 of [CONCEPT-LINKS.md](CONCEPT-LINKS.md) (contract, dunning chain, decisions L1–L12), split off for the docs budget. Facts per module: [ANALYSIS-SOURCES.md](ANALYSIS-SOURCES.md) §1. Paths relative to `web/src/`. Every row is revisable.

## 3.1 Rules for every source

1. **Nothing undated enters by itself (L9).** A source lists a thing only when it carries a date inside the horizon, or the person tapped „In den Plan“ on it. Otherwise the plan would fill with permanent rows (a shopping list is never empty).
2. **One thing per occasion, not per entry:** a shopping trip is one row, a workout one block, a packing list one row.
3. **A tick only where ticking is the module's own „Erledigt“** (ToDos, routines, fitness). Money and deadlines get `action` (L7); collective things get „Zur Liste“.
4. Every source has `showInPlan` in its own settings (pattern: `modules/invoices/settings.ts:7`), and a fixed duration constant the person can override in the plan (the planner keeps overrides for sources without a field, `docs/decisions/plan-contract.md`, source contract).
5. Wording stays calm: a passed deadline reads „Frist war <Tag>“ (exists, `strings.ts` `planner.row.dueWas`), never „überfällig“ for chores.

## 3.2 Sources: benefit × effort

Benefit 3 = named by the maintainer or severity 3; effort S ≤ 1 day, M = one package.

| # | Module | Becomes | Default | Duration | Back channel | Focus rule | Benefit | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | invoices | plannable (exists) + links + `action` + dunned deadline | on | 10 min (`plannable.ts:15`) | `action` „Bezahlt …“ | one row per invoice, dunning is its detail | 3 | M |
| 2 | lists | plannable: a shopping list after „In den Plan“ → „Einkaufen · 7 Dinge“; a packing list with `tripDate` (`modules/lists/schema.ts:30`) → „Packen: <Name>“, hard due = the day before | shopping on request, packing on | 45 / 20 min | none for done: leaves when nothing is open; `action` „Zur Liste“ | ONE row per list, the count in the title, never an item row | 3 | M |
| 3 | fitness | plannable (exists) + the session's `time` (`modules/fitness/schema.ts:23`) as a fixed block | on | session minutes, else 45 (`plannable.ts:16`) | `onDone`, `onEstimate` (exist) | a block with its window, pinned to its day; never moved, never „missed“ | 3 | M |
| 4 | subscriptions | plannable (exists) + trial end (`schema.ts:50`) as kind `cancel` + `action` „Kündigen …“ | on | 15 min | `action` | only the next deadline per subscription (as today) | 2 | S |
| 5 | vault (documents) | plannable `list`: `endDate` minus notice (`modules/vault/schema.ts:27-30`) → „Vertrag kündigen“ / „Ausweis verlängern“ | on | 15 min | `action` „Zum Dokument“ | same family and wording as 4; the **title is the category wording, never the document's name**: plan titles travel into calendar chips, the agenda and the widget (`modules/planner/calendar.ts:40-46`), and the overview promises no document titles (`modules/vault/calendar.ts:9-13`). The name appears only as `detail` on the planner page. Test in S2 | 2 | S |
| 6 | timetrack | linkable: session keeps `ref` from `sourceRef` (`core/events/events.ts:89`, dropped in `modules/timetrack/services.ts:46-48`) – concept TT1 exists | on with the module | – | TT2 `actuals` | one ⋯ entry, no timer on rows | 2 | S |
| 7 | habits | blocks only (`PlannableSource.blocks`, concept H1): time is kept free, nothing to tick | off per goal („keine“) | per goal | none, by design | never tickable in the plan, never „offen“; the block label is the typed habit name only, no category | 2 | M |
| 8 | people | plannable: an open gift with a `date` (`modules/people/schema.ts:49`) → „Geschenk für <Name>“; birthdays stay all-day calendar items (an appointment, not a task) | on | 20 min | `action` „Zur Person“ | title never names the gift (surprise, `schema.ts:40-42`; a test pins it) | 1 | S |
| 9 | calendar | linkable only: event ↔ its preparation ToDo, both ways (falls out of K1/K2) | – | – | – | no new row | 2 | S |
| 10 | notes | linkable only; the checklist line sends its link too (P46) | – | – | – | – | 1 | S |
| 11 | pantry | linkable: `shopping.requested` gets an additive `ref`, the list item links back to the pantry entry; expiry stays `attention` | – | – | `pantry.restock` (exists) | no plan row for an expiry | 1 | M |
| 12 | routines, todos | complete | on | – | exist | – | – | – |
| – | mail, finance | link targets with a resolver, never sources (mail: device-local cache, desktop only) | – | – | – | – | – | – |
| – | budgets, weather, disk, downloads | nothing: context or no data | – | – | – | – | – | – |
| – | accounts | **never** source, target or label | – | – | – | – | – | – |

**Top 5 to build first:** invoices, lists, fitness, subscriptions, vault documents – the three the maintainer named („Einkauf, Gym, Rechnungen“) plus the deadline family that costs a day each.

## 3.3 Generic row action „In den Plan“ (T1, S05, P70)

One helper in core (`core/entitylinks/planRow.ts`, new – not under `core/plan/**`, which stays free of db and registry imports; it is the first cross read that lives in core itself, so K2 adds a decision bullet): `planRowAction(target)` returns a row-menu entry or nothing. It shows only while the planner is on (the bus has no reply, so the helper reads the module state itself). Label „In den Plan“; once placed it reads „Im Plan · Di“ (`plannedDay`) and opens the planner on that day.

- **The thing is a plan item itself** (invoice, session, routine, list): `plan.requested` with the additive `ref: EntityRef`. The planner creates **no ToDo**; it writes only its own item row for `<module>:<id>` (`excluded` off, optionally `pinned`), as `itemPatch` does (`modules/planner/actions.ts:179-200`), runs, and answers with the existing toast „Im Plan: … · Di · Rückgängig“. For a list this request is also what switches the list on as a source (rule 1). A source cannot read the planner's rows (`list(ctx: { today; until })`, `core/modules/types.ts:626`), so K1 adds `ctx.requested?: string[]` – the ids of this module the person asked into the plan; the flag stays the planner's item row, not a field on the list.
- **The thing is no plan item** (note, bookmark, person, pantry entry): `plan.requested` with `link`, as notes do today (`modules/notes/routes/NotesPage.tsx:471`) → a ToDo plus, from K2 on, its `_links` row (`addRequested`, `modules/planner/actions.ts:113`).
- With the planner off the event does nothing (`core/events/events.ts:70`); the row offers „Als ToDo“ where the module has it.

## 3.4 Packages

Order: K1a ∥ redesign foundation → K1b → K2 → S1, S2, S3, S5 in parallel → S4. K1 is split because its planner part edits the redesign's file (`modules/planner/routes/PlannerPage.tsx:580-603`). The contract packages are the only ones that touch the hotspot `core/modules/types.ts` (`docs/CHATS.md:53`); K2 alone bumps the Dexie version.

| Package | Content | Hotspots / shared files |
| --- | --- | --- |
| **K1a Contract (types, resolvers)** – K1b = the planner row renders links and `action` through the resolver, after the redesign foundation | `core/entitylinks/types.ts`; **every additive field at once** in `core/modules/types.ts`: `linkTarget`, `PlannableItem.links` / `action` / `fixed?: { from; to? }`, `PlannableSource.blocks?` (H1), `actuals` (TT2), `list` ctx `requested?`; `plan.requested.ref`, `shopping.requested.ref` in `core/events/events.ts`; the four unions → `LegacyLink` (`events.ts:57,80`, `quickCapture/parser/types.ts:88`, `types.ts:608`); `LINK_KINDS` from core; resolvers for notes, mail, invoices, calendar, todos; ToDos hand over all links; the planner row and the ToDo editor render through the resolver; hash test (1.6) | `core/modules/types.ts`, `core/events/events.ts`, `strings.ts`, `modules/planner/routes/PlannerPage.tsx` (also the redesign's file: agree the order with chat G) |
| **K2 Link table** | `_links` in `core/db/schema.ts`, `db:bump`, schema history; `addLink` / `linksOf` / `useLinks` / `plannedDay`; old-client test first; copy of ToDo links; `planRowAction` + the planner's `ref` handler; `exclusion.test.ts`; `docs/legal/data-flows-hinweise.md`; decision bullets | `core/db/schema.snapshot.json` (Dexie version), `modules/planner/actions.ts` |
| **S1 Geld & Mail** | invoices (fields L6, version + migration, „Aus Mail“, `action`, `?do=pay`), mail (`invoiceRow.ts` writes links, „Angelegt“ from `_links`, P44), `quickCapture/targets/adapters.ts` (invoice target, amend) | `strings.ts` (own blocks), `adapters.ts` |
| **S2 Fristen** | subscriptions (trial end, `action`), vault documents (plannable, `showInPlan`) | `strings.ts` |
| **S3 Einkauf** | lists (plannable, „In den Plan“, „Zur Liste“), pantry (`ref`) | `strings.ts`, `adapters.ts` only if the list target changes |
| **S4 Training & Blöcke** | fitness `fixed`, habits H1; both add a timed / fixed block next to `core/plan/capacity.ts:20-30` | `core/plan/**`, planner `DaySheet` – **after** the redesign package that touches them, not parallel to it |
| **S5 Kleinkram** | timetrack TT1, people gifts, notes P46, calendar back-link | `strings.ts` |

S1, S2, S3 and S5 share no file but `strings.ts` (append in the own block). S1 and S3 may both touch `adapters.ts`: different targets, small edits. Each package ends with the focus checklist (`docs/design/FOCUS-GUIDELINES.md:5-17`) and names what it removes: S1 removes the mail URL note line from new invoices (P56), K1 the two hard-coded menu entries (`PlannerPage.tsx:584-603`).

## 3.5 UI texts of the link model and the chain

| German | English |
| --- | --- |
| Aus Mail | From a mail |
| Mahnung aus Mail vom 3. Nov. | Reminder from mail of 3 Nov |
| Zur Mail · Zur Mahnung · Zur Rechnung | Go to mail · Go to reminder · Go to invoice |
| Im Plan · Di | In plan · Tue |
| In den Plan | Add to plan |
| Bezahlt … · Kündigen … | Paid … · Cancel … |
| Gibt es nicht mehr. · Entfernen | No longer exists. · Remove |
| Nicht auf diesem Gerät. · Im Browser öffnen | Not on this device. · Open in browser |
| Einkaufen · 7 Dinge | Shopping · 7 items |

## 5 Risks, not in scope

- Orphan rows grow: bounded by the sweep with the `from` end; a count only goes into the diagnostics health check (never a label or id; the negative-list test gets a link label and a thread id), not the UI.
- Row furniture (P81): at most one chip line per row, the rest behind „Verknüpft“ in ⋯; design chat E decides the look (`docs/design/FOCUS-GUIDELINES.md:6`).
- A label is the title of the time; alive targets show the resolver's title.
- An older app that rewrites an invoice drops the two new fields from its own row (known limit, as `part`: `docs/decisions/plan-contract.md`, last bullet).
- Not in scope: telemetry, an AI reading links or user data, a new listener or port, anything from or into `accounts`, auto-closing of siblings, back-links inside the mail cache, a graph view.

## 6 Friction resolved

| Part | Ids |
| --- | --- |
| K1 small step (types, resolver, planner renders all) | P43, P50, P51, P52, P57 |
| K2 table, reverse read, „Im Plan“ | P44, P45, P47, P71 |
| Dunning chain (LINKS §2) | P40, P41, P42, P48, P49, P56, P76 |
| Source plan (§3) | P46, P53, P54, P55, P70, P79, P86 |
| Left to design chat E / other packages | P72–P75, P77, P78, P80–P85 |
