# Planner hub 2 – concept: the frame and the link contract (idea 10)

Ideas 4, 2, 5: [CONCEPT-ROWS](CONCEPT-ROWS.md). Ideas 1, 3, 6, 9, 11: [CONCEPT-INTAKE](CONCEPT-INTAKE.md). Struck 8 and 7: [CONCEPT-STRUCK](CONCEPT-STRUCK.md). Figures: [ANALYSIS](ANALYSIS.md). Sample day everywhere: Monday 2026-11-30, invented things only.

## 0. Seven sentences every package keeps

1. **One thing, one home, one „Erledigt“.** A thing lives in exactly one module. The plan row of an invoice is the invoice (`invoices:<id>`), never a ToDo about it. A carrier ToDo exists only for targets that have no „Erledigt“ of their own (mail thread, note, appointment, person). So no pair of rows ever needs two ticks, and nothing has to be kept in step between modules or devices.
2. **The planner writes only its own three collections** (plus the two new ones, §0.1). What changes another module's data is that module's code: its `PlannableSource` step, its bus handler, or its own panel mounted in the row (idea 4). Revises nothing in `decisions/plan-links.md` L7: `?do=pay` stays a route that writes nothing.
3. **The four rules of planner rethink** ([CONCEPT-MIGRATION §7](../planner-rethink/CONCEPT-MIGRATION.md)) hold for every new action: no row changes its day or disappears without an action that names it; midnight, start, focus, sync and edits elsewhere write nothing in the planner; every writing action is one undo entry; a closed preview changed nothing.
4. **A link carries two keys, a relation and a title** (`EntityLink`, ≤ 120 characters) – never an amount, a text, a sender address or a picture. What the row shows beyond the title is read live from the target module on this device.
5. **No new read path.** Planner: `dataApi: false`, no `aiSchema`, no search entry, no export other than „Plan als Text kopieren“. The two new collections inherit that. `accounts` is never a source, a target, a label, a pile, a step, a topic member or a share target. Nothing here calls a model or a network.
6. **Stimulus budget.** Every new control lives inside an expanded row, a ⋯ menu, a preview or the selection bar. The counts of `d1920--planner` and `p412--planner` in `web/e2e/stimulus-budget.json` do not rise; a package that cannot keep that says so in its PR and waits.
7. **Everything new can be switched off** in Planer → Einstellungen and is a proposal until he taps.

### 0.1 Data that is new (all in the planner module, synced like its other collections, written through `createRepo`)

| Collection / field | Shape | First package |
| --- | --- | --- |
| `planner_item.bundle`, `.step` | id of a bundle, order inside it (integer) | 5b |
| `planner_bundle` | `title`, `kind: 'steps' \| 'errand'` | 5b |
| `planner_topic` | `title` (≤ 60) | 11 |
| `planner_measure` | `key`, `minutes`, `on` – one row per measurement | 8 (struck, [ANALYSIS §4](ANALYSIS.md)) |
| settings `planner.piles` | `{ money?: boolean; mail?: boolean }` (synced scope) | 2 |

Everything else is derived or lives in the source module. Each new collection: `npm run db:bump`, previous stores into `core/db/schema-history.json`, `manifest.version` + empty migration step.

## 1. The link contract grows (idea 10)

What exists and stays: `_links` (one synced row per link, id = SHA-256 of `[fromKey, rel, toKey]`), `addLink` / `addLinksIfAbsent` / `removeLink`, `linkEntries` in both directions, `resolveLink`, `plannedDay`, `planRow.ts` („In den Plan“, „Im Plan · Di“) – `web/src/core/entitylinks/**`, [decisions/plan-links](../../decisions/plan-links.md).

### 1.1 Relations

`LinkRel` gets four values (`wait` only if the struck idea 7 is ever built). Older apps read an unknown value as `about` (`linkRel`), so a mixed fleet shows the link, only without its special place.

| `rel` | From → to | Written by (always inside an undoable action) | Read by |
| --- | --- | --- | --- |
| `origin`, `dunning`, `about` | as today | as today | as today |
| (`wait`) | carrier thing → mail thread or person | „Warte auf Antwort …“ (7, struck – not added by 10a) | – |
| `before`, `after` | new ToDo → appointment | „Vorbereiten“ / „Danach“ (9) | the appointment's panel, the calendar's „Vorbereitung“ |
| `topic` | `planner:t_<id>` → any thing | „Thema …“ (11) | topic filter, the mark in the module |
| `place` | a thing → `maps:<placeId>` | „Ort …“ in an errand (6) | the errand's stops |

Bundle membership is **not** a link: steps need an order, and a thing is in at most one bundle, so it is two fields on the thing's `planner_item` row (field LWW: two devices that bundle the same thing differently converge on the later tap).

### 1.2 Direction, writer, deletion, two devices

- **Both directions** are one row: `linkEntries(ref)` already reads `fromKey` and `toKey`. No mirror row, so nothing can drift.
- **Writers** are taps only (`addLink`), except copies of data that arrived from elsewhere (`addLinksIfAbsent`, a tombstone wins).
- **Deleted target:** the row stays; `resolveLink` answers `gone` and the chip reads „Gibt es nicht mehr“ without an action (as today). A deleted *carrier* tombstones its outgoing rows (`removeLinksFromModule`, `sweepPurged`). New: a deleted topic tombstones its `topic` rows in the same undoable action.
- **Two devices:** adds commute (deterministic id), a removal is the tombstone of that one row; nothing new. `on` and `label` are plain LWW fields.
- **Migration of the old form:** none needed. ToDo `links[]` stays frozen and copied (`migrate.ts`). What changes is the request path: `plan.requested` and `todo.requested` get `links?: { to: EntityRef; rel: LinkRel; label: string }[]` beside the deprecated `link` (four kinds). The handler writes `_links` rows for `links` and never puts a non-legacy kind into a ToDo's `links[]`. No loop: the copy only reads `links[]`.
- **Bookmarks and subscriptions** show „im Plan“ from their own fields today (`inPlan`, `plannedDeadline`) and can disagree with the plan. From 10b they read `planRowState` like everyone else; the fields stay stored (older apps), are no longer written, and a one-time step per device turns a `true` / set field into a planner request row (`requestIntoPlan`, if absent). That step is the only write without a tap; it runs once, like `migrateModel.ts`.

### 1.3 What a module delivers

`T` = `contributions.linkTarget` (alive / gone, title, route, own `done`). `M` = the shared mark „Im Plan · Mi“ on its rows and detail. `P` = „In den Plan“ in its ⋯ (via `usePlanRowEntries`). ✓ = exists, **+** = package 10a (T) or 10b (M, P).

| Module (id) | T | M | P | Title a link may show | Notes |
| --- | --- | --- | --- | --- | --- |
| ToDos (`todos`) | ✓ | ✓ own `PlanMark` | ✓ | task title | own mark moves to the shared one |
| Rechnungen (`invoices`) | ✓ | ✓ | ✓ | invoice title | – |
| Listen (`lists`) | ✓ | **+** (menu only today) | ✓ | list name | one row per list stays |
| E-Mail (`mail`) | ✓ | ✓ | ✓ | subject, capped | desktop only; elsewhere `unavailable` |
| Notizen (`notes`) | ✓ | **+** | ✓ | note title | – |
| Kalender (`calendar`) | ✓ | **+** | **+** | event title | – |
| Vorräte (`pantry`) | ✓ | – | – | item name | not a plan thing |
| Abos (`subscriptions`) | **+** | **+** (replaces own field) | ✓ | subscription name | – |
| Merkliste (`bookmarks`) | **+** | **+** (replaces own field) | ✓ | bookmark title, never the URL | – |
| Personen (`people`) | **+** | **+** | – | display name | a gift's title never names the gift (`people/plannable.ts`) |
| Unterlagen (`vault`) | **+** | **+** | ✓ | **category wording only** („Vertrag“, never the document's title) | `vaultPlanPrivacy.test` grows to links |
| Routinen (`routines`) | **+** | **+** | ✓ | routine name | – |
| Karten & Orte (`maps`) | **+** (place only) | – | – | place name | package 6, not 10a |
| Planer (`planner`) | **+** (topic `t_`, bundle `b_`) | – | – | topic / bundle title | packages 11 and 5b |
| Passwörter (`accounts`) | never | never | never | – | `NEVER_LINKED`, `exclusion.test.ts` |
| Budgets, Finanzen, Zeiterfassung, Fitness, Gewohnheiten, Feeds, Uhr, others | – | – | – | – | not linkable: no single thing a plan row would point to (budgets and finance speak through a pile, idea 2) |

### 1.4 The mark (the visible half of 10)

One component in `core/entitylinks` (`PlanMark`, replacing the ToDos-only one): a muted text link in the row's meta line, after the module's own meta.

- States: nothing (not in the plan: **no mark**, the entry is in ⋯) · „Im Plan · Mi“ · „Im Plan · Mi · fest“ · „Im Plan · noch ohne Tag“ · „Im Plan · war Mo“ (day passed, plain text, never a tone) · planner off: nothing.
- Tap → `/planner?item=<key>` (exists since #1069): the planner opens on that day with the row focused. One handle back and forth.
- A thing in a bundle reads „Im Plan · Mi · in „Haushalt““; a thing with a topic adds nothing here (the topic shows in its ⋯ „Verknüpft“).
- Colour: none. It is text with the planner glyph (16 px) in `--text-muted`.

### 1.5 Risk, target, not part of it

- **Risk:** Unterlagen leaking a document title through a link label → label and `resolve().title` come from the same category function as the plan row; test pins it. A re-pull per device at the release (new rels need none; no new synced table in 10a/10b).
- **Target (script, flow D1):** five things placed from the planner – the day visible in the thing's own module for 1 → 5 of 5, agreeing with the plan for 2 → 5 of 5; trips to the planner just to find out: 8 → 0; back to the row in the plan: 1 handle.
- **Not part of it:** no new plan source (a note or a person does not become a plan thing by itself), no link editor in every module (links are made where the action is: plan row ⋯, the panels of idea 4), no link from or to `accounts`, no label refresh job (a label is the title at the time of the tap; the live title comes from `resolveLink`).
