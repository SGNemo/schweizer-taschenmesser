# Planner hub 2 – concept: the frame and the link contract (idea 10)

Ideas 4, 2, 5, 8: [CONCEPT-ROWS](CONCEPT-ROWS.md). Ideas 1, 3, 6, 9, 11: [CONCEPT-INTAKE](CONCEPT-INTAKE.md). Struck 7: [CONCEPT-STRUCK](struck/CONCEPT-STRUCK.md). Figures: [ANALYSIS](ANALYSIS.md). Sample day everywhere: Monday 2026-11-30, invented things only.

## 0. Seven sentences every package keeps

1. **One thing, one home, one „Erledigt“.** A thing lives in exactly one module. The plan row of an invoice is the invoice (`invoices:<id>`), never a ToDo about it. A carrier ToDo exists only for targets that have no „Erledigt“ of their own (mail thread, note, appointment). So no pair of rows ever needs two ticks, and nothing has to be kept in step between modules or devices.
2. **The planner writes its own collections (§0.1), `_links` (through `addLink` / `removeLink`), its own settings record and its device-local `_meta` keys (as today: the topic filter, the last used topic, the offer's ✕, start points), and it may create a thing through a core capture target (`saveCapture`) – only on his tap and inside the planner's one undo entry. Nothing else.** Write-spy tests say exactly that (planner tables + `_links` + its `_meta` keys + exactly that target's collection). Everything else that changes another module's data is that module's code: its `PlannableSource` step, its bus handler, or its own panel mounted in the row (idea 4). Revises nothing in `decisions/plan-links.md` L7: `?do=pay` stays a route that writes nothing.
3. **The four rules of planner rethink** ([CONCEPT-MIGRATION §7](../planner-rethink/CONCEPT-MIGRATION.md)) hold for every new action: no row changes its day or disappears without an action that names it; midnight, start, focus, sync and edits elsewhere write nothing in the planner; every writing action is one undo entry; a closed preview changed nothing.
4. **A link carries two keys, a relation and a title** (`EntityLink`, ≤ 120 characters) – never an amount, a text, a sender address or a picture. What the row shows beyond the title is read live from the target module on this device.
5. **No new read path.** Planner: `dataApi: false`, no `aiSchema`, no search entry, no new automation event (it emits `planner.overloaded` as today), no export other than „Plan als Text kopieren“ (backups carry it as they carry every table); a partner share file holds planner tables only when he chooses them in the share preview, as today. The new collections inherit that and get canary rows in `core/entitylinks/exclusion.test.ts`; the new collections are planner tables like the others, so nothing changes there and no package adds a share exclusion. `accounts` is never a source, a target, a label, a pile, a step, a topic member or a share target. Nothing here calls a model or a network.
6. **Stimulus budget.** Every new control lives inside an expanded row, a ⋯ menu, a preview or the selection bar – except what is new and always visible, completely: the pile offer (until it is answered); the mark (one text link per planned row in ten modules); one chip in a row's existing chip line (S7, A4); the steps meta on ToDos with a checklist and on routines (text in the existing meta line); the pile lead glyph (and the bundle's, should 5b be built; in the lead slot that is always filled). Expected `check:stimulus` effect: text only, no new control – unchanged; each package still runs it. The counts of `d1920--planner` and `p412--planner` in `web/e2e/stimulus-budget.json` do not rise; a package that cannot keep that says so in its PR and waits.
7. **Everything new that changes what he sees without his doing can be switched off** in Planer → Einstellungen (piles, kinds in the field, expanding rows); what exists only when he makes it (bundles, topics) needs no switch. Everything is a proposal until he taps.

### 0.1 Data that is new (all in the planner module, synced like its other collections, written through `createRepo`)

| Collection / field | Shape | First package |
| --- | --- | --- |
| the planner as a plan source of itself | `planner/plannable.ts`, registered in its manifest: lists piles, later bundles (keys `planner:<id>`); no write-back steps | 2 |
| settings `pileMoney`, `pileMail` | two flat optional booleans in the synced planner settings (undefined = never asked; flat because settings merge per top-level field) | 2 |
| `planner_item.bundle`, `.step` | id of a bundle, order inside it (integer) | 5b (parked) |
| `planner_bundle` | `title`; record id `b_<uuid>` | 5b (parked) |
| `planner_topic` | `title` (≤ 60); record id `t_<uuid>`, so its link ref is `planner:t_<uuid>` and the purge sweep finds it | 11 |
| `planner_measure` | `key`, `minutes`, `on` – one row per measurement | 8 (built on the maintainer's decision, [ANALYSIS §4](ANALYSIS.md)) |

Everything else is derived or lives in the source module. Each new collection: `npm run db:bump`, previous stores into `core/db/schema-history.json`, `manifest.version` + empty migration step.

## 1. The link contract grows (idea 10)

What exists and stays: `_links` (one synced row per link, id = SHA-256 of `[fromKey, rel, toKey]`), `addLink` / `addLinksIfAbsent` / `removeLink`, `linkEntries` in both directions, `resolveLink`, `plannedDay`, `planRow.ts` („In den Plan“, „Im Plan · Di“) – `web/src/core/entitylinks/**`, [decisions/plan-links](../../decisions/plan-links.md).

### 1.1 Relations

`LinkRel` gets three values. Older apps read an unknown value as `about` (`linkRel`), so a mixed fleet shows the link, only without its special place.

| `rel` | From → to | Written by (always inside an undoable action) | Read by |
| --- | --- | --- | --- |
| `origin`, `dunning`, `about` | as today | as today | as today |
| `before`, `after` | new ToDo → appointment | „Vorbereiten“ / „Danach“ (9) | the appointment's panel, the calendar's „Vorbereitung“ |
| `topic` | `planner:t_<id>` → any thing | only the planner's own „Thema …“ (11) | topic filter, ⋯ „Verknüpft“ |

Not added: `wait` (idea 7, struck) and `place` (the errand's places, struck with the map – [ANALYSIS §4](ANALYSIS.md)). Bundle membership is **not** a link: steps need an order, and a thing is in at most one bundle, so it is two fields on the thing's `planner_item` row (field LWW: two devices that bundle the same thing differently converge on the later tap).

### 1.2 Direction, writer, deletion, two devices

- **Both directions** are one row: `linkEntries(ref)` already reads `fromKey` and `toKey`. No mirror row, so nothing can drift.
- **Writers** are taps only (`addLink` in the planner's own actions), except copies of data that arrived from elsewhere (`addLinksIfAbsent`, a tombstone wins).
- **Deleted target:** the row stays; `resolveLink` answers `gone` and the chip reads „Gibt es nicht mehr“ without an action (as today). A deleted *carrier* tombstones its outgoing rows (`removeLinksFromModule`, `sweepPurged`). New: a deleted topic tombstones its `topic` rows in the same undoable action.
- **Two devices:** adds commute (deterministic id), a removal is the tombstone of that one row; nothing new. `on` and `label` are plain LWW fields.
- **The request events get nothing new (10a).** `plan.requested` and `todo.requested` stay as they are – no `links`, no change to `day`, no note, no origin, no reply. Every writer of the new relations is the planner's own code calling `addLink` inside its own undoable action: `before` / `after` from `addFromField` (package 9), `topic` from „Thema …“ (package 11). Each end is checked with `toRow` before the action writes (a refused end – `accounts`, no link target, itself – is skipped, never thrown inside the action); a label for an Unterlagen target is that target's own `resolveLink` title. Nothing new goes into a ToDo's frozen `links[]`.
- **Occurrence keys.** The plan keys of subscriptions, routines and Unterlagen are per occurrence (subscriptions `<id>:<date>` / `<id>:trial:<date>`, Unterlagen `<id>:cancel:<date>` / `<id>:end:<date>`, routines `<id>:<due>`). Such a source also names the thing behind a row: `PlannableItem.entityId?` (10a), which is what a link from or to that row stores. The mark asks by entity: `planRowState`, `planFacts` (the lock, M2) and `plannedDay` match an item key that equals `<module>:<id>` **or starts with `<module>:<id>:`**. Requests from those modules keep using their occurrence key, as today.
- **Bookmarks and subscriptions keep their own fields** (`inPlan`, `plannedDeadline`) as their request to the plan – their sources read them, older apps read them, nothing is migrated and nothing is written at start. Only the *display* changes: their „im Plan“ text is replaced by the shared mark, which reads the planner (so a thing placed from the planner's side shows it too) or, while the planner has no row yet, the module's own field. „Nicht mehr planen“ in the module clears the field on that tap, as today.

### 1.3 What a module delivers

`T` = `contributions.linkTarget` (alive / gone, title, route, own `done`). `M` = the shared mark „Im Plan · Mi“ on its rows and detail. `P` = „In den Plan“ in its ⋯. ✓ = exists, **+** = package 10a (T) or 10b (M); planner: 11.

| Module (id) | T | M | P | Title a link may show | Notes |
| --- | --- | --- | --- | --- | --- |
| ToDos (`todos`) | ✓ | ✓ own `PlanMark` | ✓ | task title | own mark moves to the shared one |
| Rechnungen (`invoices`) | ✓ | ✓ | ✓ | invoice title | – |
| Listen (`lists`) | ✓ | **+** (menu only today) | ✓ | list name | one row per list stays |
| E-Mail (`mail`) | ✓ | ✓ | ✓ | subject, capped | desktop only; elsewhere `unavailable` |
| Notizen (`notes`) | ✓ | **+** | ✓ (makes a ToDo) | note title | – |
| Kalender (`calendar`) | ✓ | **+** (detail; the day of ToDos linking to it) | – (an appointment is a blocker of its day; „Als ToDo merken“ exists) | event title | – |
| Vorräte (`pantry`) | ✓ | – | – | item name | not a plan thing |
| Abos (`subscriptions`) | **+** | **+** (replaces its own text) | ✓ own field | subscription name | occurrence keys |
| Merkliste (`bookmarks`) | **+** | **+** (replaces its own text) | ✓ own field | bookmark title, never the URL | – |
| Unterlagen (`vault`) | **+** | **+** | ✓ | **category wording only** („Vertrag“, never the document's title or the source's `detail`, which is the document's name) | occurrence keys; `modules/vault/__tests__/vault.plannable.test.ts` grows to links |
| Routinen (`routines`) | **+** | **+** | ✓ | routine name | occurrence keys |
| Planer (`planner`) | **+** topics only (`t_`) | – | – | topic title | package 11 |
| Passwörter (`accounts`) | never | never | never | – | `NEVER_LINKED`, `exclusion.test.ts` |
| Personen, Karten & Orte, Budgets, Finanzen, Zeiterfassung, Fitness, Gewohnheiten, Feeds, Uhr, others | – | – | – | – | not linkable: nothing built here links to them (people came with the struck idea 7, places with the struck map); budgets speak through a pile (idea 2) |

### 1.4 The mark (the visible half of 10)

One component in `core/entitylinks` (`PlanMark`, replacing the ToDos-only one): a muted text link in the row's meta line, after the module's own meta.

- States: nothing (not in the plan: **no mark**, the entry is in ⋯) · „Im Plan · Mi“ · „Im Plan · Mi · fest“ · „Im Plan · noch ohne Tag“ · „Im Plan · war Mo“ (only a passed day: plain text, never a tone; `planRowState` gets this one new read – the latest live assignment before today when none lies from today on) · planner off: nothing.
- The day of a thing that is no plan row itself is the day of a ToDo that links to it with `origin` or `about` – never `before`, `after` or `topic` (a preparation the day before must not move the appointment's mark); a member of a bundle would have its bundle's day (5b, parked); a member folded into a pile has the pile's day (2).
- Tap → **the plan row it matched** (`rowKey` = the occurrence key, the carrier ToDo's key, the bundle's or the pile's key): M1 / M2 / M5 `/planner?day=<d>&item=<rowKey>`, M4 `/planner?tab=open&item=<rowKey>`, M3 `/planner?item=<rowKey>` – it stays on the „Plan“ tab and unfolds the group „Noch ohne Tag“ (the foot of the day's sheet) and focuses the row. Today the `?item` effect only scrolls and focuses while the group stays folded, so the unfold is a must-do of 10b with a test; `?tab=open` is only M4's route (exists today). `?item=` (since #1069) matches `data-row-key` exactly on the sheet shown and does not pick the day, so the day is in the URL, as `todos/planState.ts` does. One handle back and forth.
- A thing in a bundle would read „Im Plan · Mi · in „Haushalt““ (only with 5b, parked; it reads the bundle's title through the planner's rows, not a link). A member folded into a pile that lies on a day reads M5 with the pile's title („Im Plan · Mi · in „Finanzen checken““) and links to the pile's row (`?day=<d>&item=planner:pile-money`); the members of an unplaced pile read M3 and link to the pile row (from 2; 10b prepares the prop); a thing with a topic adds nothing here (the topic shows in its ⋯ „Verknüpft“).
- Colour: none. It is text with the planner glyph (16 px) in `--text-muted`.

### 1.5 Risk, target, not part of it

- **Risk:** Unterlagen leaking a document title through a link label → label and `resolve().title` come from the same category function as the plan row's title; the test that pins the row pins the link. A re-pull per device at the release (new rels need none; no new synced table in 10a/10b).
- **Target (script, flow D1):** five things placed from the planner – the day visible in the thing's own module for 1 → 5 of 5, agreeing with the plan for 2 → 5 of 5; module switches to find out from the module's side (`tripsToPlanner`) 8 → 0 (10b). From the planner's side the walk stays 11 handles, 5 per thing, 10 switches after 10b and becomes 15 / 9 / 10 after 4a (a named price: the jump into a module is expand + „Ganz öffnen“).
- **Not part of it:** no migration, no write at start, no new plan source (a note does not become a plan thing by itself), no link editor in every module (links are made where the action is: plan row ⋯, the panels of idea 4), no link from or to `accounts`, no label refresh job (a label is the title at the time of the tap; the live title comes from `resolveLink`).
