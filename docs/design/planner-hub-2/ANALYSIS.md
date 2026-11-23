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
| 10 | Back reference | partly | `_links`, `resolveLink`, `plannedDay`, `planRow.ts`; seven link targets; marks in ToDos, invoices, mail | five link targets; a mark in lists, notes, calendar, people, vault, routines; bookmarks and subscriptions read their own field |
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

| Flow | Figure | Now | Target | By package |
| --- | --- | --- | --- | --- |
| A1 twelve things into the field | right kind | 4 of 12 | 12 of 12 | 3 |
| | rows afterwards | 11 | 7 | 3 |
| | module switches · forms | 0 · 0 (A2: 3 / 5 · 2) | 0 · 0, A2 no longer needed | 3 |
| B finances and mail | rows before | 5 (for 10 things) | 2 / 1 | 2 |
| | module switches | 5 | 0 | 4b, 4c, 2 |
| | handles · per thing | 27 · 17 / 14 · 9 | 13 · 11 / 8 · 7 | 4b, 4c, 2 |
| | finished in the planner | 1 of 10 | 10 / 6 (no mail on the phone) | 4b, 4c, 2 |
| C1 household round | rows | 1 (as a routine) | 1 | 5a |
| | module switches | 4 / 5 | 0 | 5a (3 for creating in the field) |
| | create · work handles | 12 · 7 | 1 · 6 | 3 · 5a |
| | only the next step | no | yes | 5a |
| C2 errand | rows | 2 (list not in the plan) | 1 | 5b |
| | module switches | 2 | 0 | 4a, 5b |
| | work handles | 9 / 8 | 6 | 5b |
| | handles to bundle (the one figure that rises, by his choice) | 0 | 6 | 5b |
| D1 is it in the plan | mark visible · agrees | 1 · 2 of 5 | 5 · 5 | 10b |
| | module switches to find out from the module's side (`tripsToPlanner`) | 8 | 0 | 10b |
| D2 shared link | handles · switches · way back | 5 · 2 / 3 · no | 2 · 1 · yes | 1 |
| D3 before an appointment | handles · switches | 14 · 4 | 3 · 0 | 9 |
| D4 one topic | rows · handles · switches | 20 · 27 / 22 · 2 | 7 · 11 · 0 | 11 |
| D5 waiting | handles · switches · rows off the sheet | 7 · 0 · 3 | unchanged | – |

## 4. The gate (principle 1: what lowers neither rows nor module switches is not built)

| Idea | Rows | Switches | Verdict |
| --- | --- | --- | --- |
| 10 | – | D1 `tripsToPlanner` → 0 (measured from the module's side); 10a itself moves no figure – it is the base of 10b, 4, 9, 11, 1, 3 | built |
| 4 | – | 5 → 0 (B), 2 → 0 (C2) | built |
| 2 | 5 → 2 (B) | – | built |
| 5 | bundle: 2 → 1 (C2); steps: one row as today (C1 – today's routine is one row too) | 4 / 5 → 0 (C1) | built |
| 1 | – | 2 → 1 (D2) | built – **without pictures** (no figure beyond the text path; the one truly new entry surface) |
| 3 | 11 → 7 (A1) | 3 / 5 → 0 (A2) | built |
| 6 | 2 → 1 (C2) – but that is the bundle of 5b | 2 → 0 – but that is the lists panel of 4a inside the bundle | **shrunk:** what the script rewards is built in 5b (a list member is ticked inside the bundle). **Struck:** a place per stop, the map jump, a map in the planner – `mapShown` stays „nicht möglich“, no figure moves. |
| 9 | – | 4 → 0 (D3) | built |
| 11 | 20 → 7 (D4) | 2 → 0 | built |
| **8** | none | none | **struck.** It lowers per-thing handles („Dauer …“) and booked minutes only. Concept, hand-off and prompt are kept so one „ja“ starts it. My recommendation is to say that „ja“ after 5a: wrong 30-minute rows make days look full, which the script cannot count. |
| **7** | none (today's move takes the three rows off the sheet as well) | none (0 today) | **struck.** Today: 7 handles, no switch, comes back by itself (H15). What it would add is the reason on the row („Antwort da? · von Vermieter“), not fewer rows. It was also the one idea the maintainer had not confirmed. Concept, hand-off and prompt are kept. |

## 5. Critique of today's planner in the three flows

- **First impression:** the page is calm and one field invites; what it does with a line is invisible (H01) – the field is trusted more than it deserves.
- **Unloading (A):** strong: twelve lines, twelve Enter, no form. Weak: it is a ToDo funnel; the knowledge of kinds exists one click away in another field. Two fields that read the same sentence differently is the largest inconsistency of the page.
- **Working off (B):** the planner lists money well (action glyph, „Frist vorbei“), then sends him away for every single thing and brings him back each time; mail and budgets do not appear at all. The hierarchy is right, the path is five round trips.
- **Bundles (C):** the planner knows parts of a duration but not steps of a thing; the one tool with steps (routines) lives elsewhere and shows everything at once. The start line of „Tag kippt“ is the right idea for one thing and has nothing to hold on to for five.
- **What works and stays:** one field; rows of one grammar; „fest“; previews before anything moves; the undo on every action; counts as text.
- **Research:** the material behind the eleven ideas is the maintainer's own use (`../planner-hub/ANALYSIS-RESEARCH.md`, the three use cases); ideas 6, 9 and 11 have no earlier evidence beyond his order – their target figures are the only argument, which is why the script got flows D3 and D4 and why 6 shrank to what C2 shows.
