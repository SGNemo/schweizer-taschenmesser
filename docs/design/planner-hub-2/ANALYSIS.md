# Planner hub 2 – analysis: what exists, what the flows cost, what principle 1 strikes

Measured 2026-11-23 on `develop` (69b217cf) by `web/e2e/usecases/planner-hub-2.spec.ts` (invented seed, Monday 2026-11-30 09:00; desktop-chrome / pixel-7; the best path the app offers; `MEASURE=1` only measures). Counted: **rows** (things visible in the planner), **module switches** (route changes between modules), **taps** (a tap, a typed line, a paste), **per thing** (handles on one single thing). Paths per figure: the script's `*-facts.json`.

## 1. Idea × what exists

| # | Idea | State | Exists (file) | Missing |
| --- | --- | --- | --- | --- |
| 1 | Share → planner | partly | Android `ACTION_SEND` text ≤ 20 000 (`web/src-tauri/plugins/share-intent`), PWA `share_target`, page `/share` with the capture form (`web/src/pages/ShareTarget.tsx`) | planner as a target; the URL survives; pictures (not accepted on purpose) |
| 2 | Collective rows | partly | one row per list (`modules/lists/plannable.ts`), group „Frist vorbei“, `AttentionItem.foldSummary` | a pile contract; mail, budgets, finance are no plan sources; filtered routes (`?view=`) |
| 3 | Kinds in the field | partly | the capture parser knows invoice, list, event, note, bookmark (`web/src/quickCapture/parser`) | the planner's field always makes a ToDo (`planner/actions.ts` `addFromField`) |
| 4 | Expand | partly | tick or action glyph, ≤ 2 link chips, „Öffnen“ (`planner/components/ThingRow.tsx`, `RowLinks.tsx`) | any inline panel; a cancel step in subscriptions |
| 5 | Bundles | partly | parts, „Kleiner machen …“, start line, focus round (`planner/routes/FocusPage.tsx`), routines with steps, `routine.requested` | steps in the plan contract; a bundle; „Los“ |
| 6 | Errand round | missing | maps places, shopping lists | a place on a thing; maps as link target |
| 7 | Waiting | partly | ToDo `startDate`, moving a selection to a day | a reason and a person on the row |
| 8 | Real duration | missing | `DEFAULT_MIN = 30` (`core/plan/types.ts`), focus `startedAt` (device-local), `actuals` (types only) | any record of elapsed time |
| 9 | Before / after | partly | calendar is a link target, „Vorbereitung“ reads reverse links, „Als ToDo merken“ | the offer in the planner; relations `before` / `after` |
| 10 | Back reference | partly | `_links`, `resolveLink`, `plannedDay`, `planRow.ts`; seven link targets; marks in ToDos, invoices, mail | four link targets; a mark in lists, notes, calendar, subscriptions, bookmarks, vault, routines |
| 11 | Topic | missing | per-module tags, lists, notebooks, categories | anything across modules; any planner filter |

## 2. Friction (ids for the packages)

| Id | What happens | Flow | Answered by |
| --- | --- | --- | --- |
| H01 | The field turns „Rechnung Stadtwerke 80 € bis Fr“ into the ToDo „Stadtwerke“ with a deadline: „Rechnung“ and the amount vanish without a word. 4 of 12 things end as the right kind. | A1 | 3 |
| H02 | The right kinds need the global capture: 33 handles, 13 per thing, 3 / 5 module switches, 2 forms; a plain link can never be planned. | A2 | 3, 10 |
| H03 | Ten waiting money and mail things are 5 rows the planner knows and 5 it does not (budget, four mails). | B | 2 |
| H04 | Working them off: 5 module switches, 27 handles; 1 of 10 can be finished in the planner. | B | 4, 2 |
| H05 | Subscriptions have no cancel step: „Kündigen …“ only opens the entry; the decision is typed into a date field. | B | 4b |
| H06 | Rows under „Noch ohne Tag“ have no tick; „Nicht planen“ leaves the row there. | B | 4 (panel tick); the second half: reported, not designed here |
| H07 | Mail is a desktop module: nothing of it can be done on the phone. | B | stays (said on the row, COPY X6) |
| H08 | A household round is a routine made in another module (4 / 5 switches, 12 handles); its run shows all steps at once. | C1 | 5a, 3 |
| H09 | A new thing is 30 minutes, also after it was done in 12. | C1 | 8 (struck) |
| H10 | An errand is two rows plus a list that is not in the plan; nothing bundles, no place, no map. | C2 | 5b (places and map: struck) |
| H11 | Placed from the planner, a thing shows nothing in its module: 1 of 5 marks visible, 2 of 5 agree (subscription and bookmark read their own field). | D1 | 10 |
| H12 | Share → ToDo drops the URL; the thing lands in ToDos, the planner is two stops away. | D2 | 1 |
| H13 | A thing prepared for an appointment: 14 handles through calendar and ToDos. | D3 | 9 |
| H14 | 20 things, 7 of one topic: no filter; a ToDo list per topic costs 27 handles and misses the invoice and the appointment. | D4 | 11 |
| H15 | Waiting things: select, move to the day – 7 handles, no switch, they come back by themselves. **Already short.** | D5 | – (7 struck) |

## 3. Figures: now → target (desktop / phone where they differ)

Target = the script's `TARGET` (the designed path after the last package of the flow, counted as the script counts); intermediate figures are what the script reads after the named package. „a / b“ = desktop / phone where they differ. Handle by handle, per package, with the acceptance figures: [FIGURES](FIGURES.md).

| Flow | Figure | Now | Target (after package) |
| --- | --- | --- | --- |
| A1 twelve things into the field | right kind · linked to the plan | 4 · 4 of 12 | 12 · 10 (3; the pantry knows the three shopping names, as in the script's seed) |
| | rows afterwards | 11 | 7 (3) |
| | handles · per thing · switches | 12 · 0 · 0 | unchanged |
| A2 each as the right kind | handles | 33 / 34 | no longer needed (A1 does it); stays as measured |
| | per thing · switches · forms | 13 / 14 · 3 / 5 · 2 | stays as measured |
| B finances and mail (10 things) | rows before | 5 | 5 (4b) → 2 / 1 (2) |
| | module switches | 5 | 3 (4b; budgets and mail stay trips) → 0 (2) |
| | handles | 27 / 14 | 28 / 16 (4b, price) → 17 / 10 (2) |
| | per thing | 17 / 9 | 21 / 13 (4b, price) → 12 / 8 (2) |
| | finished in the planner | 1 | 5 (4b) → 9 / 5 (2; the budget is read only and never counts, no mail on the phone) |
| | rows after | 1 | 0 (4b; stays 0 with 2: a pile holding only budgets is no row) |
| | `replySwitches` (desktop: switches until the reply to one planned mail is open) | 1 | 0 (4c: „Antworten“ in the row opens mail's compose dialog over the planner; 2 keeps 0) |
| C1 household round | create handles | 12 | 12 (4a) → 11 / 10 (5a) → 1 (3) |
| | work handles | 7 | 8 (4a, price) → 7 (5a) |
| | all handles | 19 | 20 (4a, price) → 18 / 17 (5a) → 8 (3) |
| | per thing | 6 | 7 (from 4a, lasting price) |
| | module switches | 4 / 5 | 4 / 5 (4a) → 2 (5a: the ToDo with its checklist is made in ToDos) → 0 (3) |
| | only the next step · rows | no · 1 | yes (5a) · 1 |
| C2 errand round | rows · one row | 2 · no | 1 · yes (5b) |
| | create handles | 0 | 14 / 13 (5b, price) |
| | work handles | 9 / 8 | 6 (5b) |
| | per thing · switches | 5 · 2 | 7 (price) · 2 (5b: the list is asked into the plan in Listen) |
| D1 is it in the plan | mark visible · agrees | 1 · 2 of 5 | 5 · 5 (10b) |
| | `tripsToPlanner` (from the module's side) | 8 | 0 (10b) |
| | handles · per thing (from the planner's side) | 11 · 5 | 11 · 5 (10b) → 15 · 9 (4a, price) |
| | module switches (from the planner's side) | 10 | 10 |
| D2 shared link | handles · way back | 5 · no | 2 · yes (1) |
| | module switches | 2 / 3 | 1 (1) |
| D3 before an appointment | handles · per thing · switches | 14 · 0 · 4 | 4 · 0 · 0 (9) |
| D4 one topic | rows · switches · filter | 20 · 2 · no | 7 · 0 · yes (11) |
| | handles | 27 / 22 | 22 / 23 (11; the phone's a price) |
| | per thing | 20 / 15 | 15 (11) |
| D5 waiting | handles · switches · rows off the sheet | 7 · 0 · 3 | unchanged (7 struck) |

**What gets dearer, said plainly.** After 4a the title of a row expands it, so jumping from a row into its module is expand + „Ganz öffnen“: D1 from the planner's side 11 → 15 handles, 5 → 9 per thing, for good; C1 per thing 6 → 7 for good and 7 → 8 work handles until 5a. After 4b every invoice and cancellation is expand + its step while budgets and mail are still trips: B handles 27 / 14 → 28 / 16, per thing 17 / 9 → 21 / 13 until 2. Bundling an errand round with a shopping list (5b) costs 14 handles (phone 13) once and per thing 5 → 7, because the list has to be asked into the plan in Listen; it buys one row less (2 → 1) and 9 / 8 → 6 working handles, and no module switch fewer. On the phone, giving five things a topic costs one handle more than today (22 → 23: Thursday's invoice waits under the folded „Danach“).

### Named prices (above `IST` on purpose; the script's header)

| Figure | From → to | From package | Until |
| --- | --- | --- | --- |
| B taps | 27 / 14 → 28 / 16 | 4b (4c) | 2 (`PRICE`, while `rowsBefore` reads 5) |
| B perThing | 17 / 9 → 21 / 13 | 4b (4c) | 2 (`PRICE`) |
| C1 workTaps · taps | 7 → 8 · 19 → 20 | 4a | 5a (`PRICE`, while `nextStepOnly` reads nein) |
| C1 perThing | 6 → 7 | 4a | lasting (`TARGET`) |
| C2 createTaps · perThing | 0 → 14 / 13 · 5 → 7 | 5b | lasting |
| D1 taps · perThing | 11 → 15 · 5 → 9 | 4a | lasting |
| D4 taps (phone only) | 22 → 23 | 11 | lasting |

## 4. The gate (principle 1: what lowers neither rows nor module switches is not built)

| Idea | Rows | Switches | Verdict |
| --- | --- | --- | --- |
| 10 | – | D1 `tripsToPlanner` 8 → 0 (10b, measured from the module's side); 10a itself moves no figure – it is the base of 10b, 9, 11 | built |
| 4 | – | B 5 → 3 (4b), → 0 with 2; 4a moves no figure of its own (it is the frame, and it carries the prices of D1 and C1); 4c: B `replySwitches` 1 → 0 (the reply opens over the planner; B's other figures wait for 2) | built |
| 2 | B 5 → 2 / 1 before; after stays 0 | B 3 → 0 | built |
| 5 | 5a: one row as today (C1 – today's routine is one row too); 5b: C2 2 → 1 | 5a: C1 4 / 5 → 2 (→ 0 with 3); 5b: C2 stays 2 | built – 5b is thin by the figures: one row less for 14 / 13 handles once and per thing 5 → 7 |
| 1 | – | D2 2 / 3 → 1 | built – **without pictures** (no figure beyond the text path; the one truly new entry surface) |
| 3 | A1 11 → 7 (right kind 4 → 12) | C1 2 → 0 | built |
| 6 | C2 2 → 1 – but that is the bundle of 5b | C2 stays 2 | **shrunk:** what the script rewards is built in 5b (a list member is ticked inside the bundle). **Struck:** a place per stop, the map jump, a map in the planner – `mapShown` stays „nicht möglich“, no figure moves. |
| 9 | – | D3 4 → 0 | built |
| 11 | D4 20 → 7 | D4 2 → 0 | built |
| **8** | none | none | **struck.** It lowers per-thing handles („Dauer …“) and booked minutes only. Concept, hand-off and prompt are kept so one „ja“ starts it. My recommendation is to say that „ja“ after 5a: wrong 30-minute rows make days look full, which the script cannot count. |
| **7** | none (today's move takes the three rows off the sheet as well) | none (0 today) | **struck.** Today: 7 handles, no switch, comes back by itself (H15). What it would add is the reason on the row („Antwort da? · von Vermieter“), not fewer rows. It was also the one idea the maintainer had not confirmed. Concept, hand-off and prompt are kept. |

## 5. Critique of today's planner in the three flows

- **First impression:** the page is calm and one field invites; what it does with a line is invisible (H01) – the field is trusted more than it deserves.
- **Unloading (A):** strong: twelve lines, twelve Enter, no form. Weak: it is a ToDo funnel; the knowledge of kinds exists one click away in another field. Two fields that read the same sentence differently is the largest inconsistency of the page.
- **Working off (B):** the planner lists money well (action glyph, „Frist vorbei“), then sends him away for every single thing and brings him back each time; mail and budgets do not appear at all. The hierarchy is right, the path is five round trips.
- **Bundles (C):** the planner knows parts of a duration but not steps of a thing; the one tool with steps (routines) lives elsewhere and shows everything at once. The start line of „Tag kippt“ is the right idea for one thing and has nothing to hold on to for five.
- **What works and stays:** one field; rows of one grammar; „fest“; previews before anything moves; the undo on every action; counts as text.
- **Research:** the material behind the eleven ideas is the maintainer's own use (`../planner-hub/ANALYSIS-RESEARCH.md`, the three use cases); ideas 6, 9 and 11 have no earlier evidence beyond his order – their target figures are the only argument, which is why the script got flows D3 and D4 and why 6 shrank to what C2 shows.
