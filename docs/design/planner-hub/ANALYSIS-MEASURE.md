# Planner hub – measurement and critique (chat C)

2026-11-15 · `develop` @ `6ef3a2cb` · script `web/e2e/usecases/planner-hub.spec.ts` (method in its head comment) · design-system audit: [ANALYSIS-DESIGN-SYSTEM.md](ANALYSIS-DESIGN-SYSTEM.md) (split off for size).

Re-run in `web/`: `npm run build:e2e && npm run preview`, then `E2E_SEED=0 npx playwright test e2e/usecases/planner-hub.spec.ts --trace off` (`PLANNER_HUB_SHOTS=1`: pictures in `.screens/planner-hub/`; `USECASE_SEED_URL=http://localhost:4174`: seeded screen S). Output: `test-results/usecase-planner-hub.md`, facts beside it.

**Scene** (made up): Sunday 2026-11-15, three ToDos (35/30/30 min), six open invoices due 8., 10., 12. Nov. Default times put all nine on Monday, as on the maintainer's screenshot: „Heute ist frei.“ · „0 Dinge · 0 Min geplant · KW 46“ · „Mo. 16. · 37 Min frei von 3 h 12 · 9 Dinge“.

## Design measures (first screen; content area = `main` below the head, above the phone's bottom bar)

Light and dark give the same geometry; only colours differ.

| Measure | 1920 opens | 1920 Monday | 1920 empty | 1920 seed | 412 opens | 412 Monday | 412 empty |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ink (text, controls) | 7 % | 12 % | 8 % | 9 % | 18 % | 31 % | 23 % |
| Painted (ink + surfaces) | 29 % | 44 % | 31 % | 37 % | 33 % | 90 % | 41 % |
| **Empty** | **71 %** | **56 %** | 69 % | 63 % | 67 % | 10 % | 59 % |
| Ink in the right half | 3 % | 12 % | 4 % | 7 % | 16 % | 19 % | 21 % |
| Empty band under the last content (px) | 447 | 403 | 197 | 382 | 335 | 14 | 85 |
| Width used (px, of window) | 1228 · 64 % | 1578 · 82 % | 1228 | 1578 | 396 · 96 % | 388 | 396 |
| First thing row at y | none | 236 | none | 236 | none | 328 | none |
| Things on screen / of the day | 0 / 0 | 9 / 9 | – | 4 / 4 | 0 / 0 | 9 / 9 | – |
| Thing row height (px) | – | 48 | – | 48 | – | 56 | – |
| Capture field y · size | 567 · 924 × 44 | 567 | 817 | 567 | 356 · 380 × 44 | **900 (fold 851)** | 606 |
| Font sizes in `main` | 6 | 6 | 7 | 7 | 8 | 8 | 8 |
| Text / background colours (chromatic) | 3 / 8 (1) | 4 / 7 (2) | 3 / 7 (0) | 5 / 8 (2) | 4 / 6 (0) | 5 / 7 (2) | 4 / 6 (0) |
| Controls · icons | 11 · 3 | 14 · 3 | 12 · 4 | 12 · 4 | 11 · 2 | 20 · 10 | 12 · 3 |
| Targets < 44 px | 1 of 11 | 4 of 14 | 1 of 12 | 1 of 12 | 1 of 11 | **12 of 20** | 1 of 12 |

- **Type:** head figure 32 px / weight 300 (phone 18 / 300) beside h1 28 / 600 (22); day name 16 / 600; row title 16 / 400; row meta, week meta, hint 13; label 15; eyebrow 11. **25 of 47 text fragments are 13 px.** Phone adds 12, 14, 18, 22.
- **Rows:** 3 of 9 carry a tick (24 × 24); 6 invoice rows have none. ⋯ is 42 × 42, hidden until hover on the desktop. Week row 48 px with a 128 × 8 px bar at the right edge; phone chip 53 × 52, the seventh is cut.
- **Overdue:** 6 rows „Frist war So/Di/Do“, all inside Monday's list, no group of their own; `--warning` `#e8b85a` 8.8 : 1 dark, `#8a5a00` 5.9 : 1 light. Title 14.1 : 1, meta 5.2 : 1.
## Click paths (Sunday scene; `MAX` = these numbers)

| Path | Taps | Keys | Screens | Dialogs | Detours | ≈ s PC / phone |
| --- | --- | --- | --- | --- | --- | --- |
| A tick a thing done | 2 | 0 | 1 | 0 | 0 | 4 / 4 |
| B move a thing to Wednesday | 4 | 29 | 1 | 1 | **2** | 26 / 31 |
| C1 open the source: ToDo | 3 | 0 | 2 | 1 | 0 | 10 / 10 |
| C2 open the source: invoice | 3 | 0 | 2 | 1 | 0 | 10 / 10 |
| C3 open the source: mail (desktop only) | 3 | 0 | 2 | 0 | 0 | 7 / – |
| D „Rest verteilen“ (Monday 18:00) | 2 | 0 | 1 | 1 | 0 | 7 / 7 |
| E enter a thing in the field | 0 | 14 | 1 | 0 | 0 | 6 / 8 |
| F settle an overdue invoice | 6 | 0 | 3 | 1 | 1 | 20 / 20 |

- **A:** the page opens on today with 0 things; one tap on Monday shows the nine.
- **B:** ⋯ names no other day (detour 1); „schieb Wohnung saugen auf Mi“ previews „Wohnung saugen festgenagelt auf Mi · Am Plan ändert sich nichts.“, stores `pinned: 2026-11-18`, and the thing **stays on Monday** (detour 2). „Später“ on a thing of tomorrow toasts „Später“ and moves nothing.
- **C:** „Öffnen“ opens the source's **edit form**. C3: way measured; the mail itself needs an account.
- **D:** no link before 17:00. All nine go „Mo → Di · der Tag hat weniger Zeit“, overdue invoices included; then Monday reads „Heute ist frei.“
- **E:** the field is not focused on arrival. First visit: the empty state shows until the first run, then the field jumps 817 → 567 (phone 606 → 356).
- **F:** no tick on the row (detour), ⋯ has no „Erledigt“; „Öffnen“ → edit form without a pay button → „Abbrechen“ → „Als bezahlt markieren“ in the list → back.

## Design critique (skill `design:design-critique`; 1920 and 412, light and dark, scene, empty, seed)

**Overall.** Calm and consistent with the frame – but it shows a schedule's bookkeeping instead of the things to do. The eye lands on „Heute ist frei.“ (largest type, top right), then on seven near-identical lines; the nine things appear after a tap, in a quarter-width panel.

| Usability finding (fix: friction table) | Severity |
| --- | --- |
| Opens on an empty today while Monday is overbooked (P01, P07) | critical |
| A thing cannot be moved to a day; the sentence does not move it (P08, P09) | critical |
| Overdue invoices hide as rows of a later day and roll on (P02, P12) | critical |
| Invoice rows cannot be settled where they stand (P03, P10) | moderate |
| The field is last under the week, below the fold on the phone (P06) | moderate |
| Desktop rows show no control until hover (P17) | moderate |

**Hierarchy.** First the thin 32-px sentence, far from what it describes; then the week list, whose 1086 px carry two words per line and an 8-px bar ~700 px away; the things come last, at 16/13 px like every list. Nothing marks the next step.

**Consistency.** Thing rows differ by source (tick or nothing) with no icon saying why. Blockers look like things. A bar fills relative to its own day: a 12-min day looks as full as a 3-h one (seed). „Das reicht für heute.“ stands beside nine things. Otherwise tokens and shared rows throughout.

**Accessibility.** Contrast passes (meta 5.2 : 1, overdue 5.9–8.8 : 1; „Frist war“ is text, not colour alone). Targets: ⋯ 42 px, tick 24 px (swipe is the alternative). Hover-only actions also show on keyboard focus. Half of all text at 13 px is legal but tiring.

**Works well – keep.** The preview before every change („Übernehmen / Verwerfen“) and the undo toast; one field for entering and sentences; calm numbers („37 Min frei von 3 h 12“) without red or guilt; A, D, E are short; the phone's chips + day card; „Warum hier?“.

**Top 3.** (1) The things are the page: the next loaded day in full width and bigger type, the week a compact band with one scale. (2) Every row acts the same: tick or „Bezahlt“, „Verschieben …“, visible controls; overdue gets its own group. (3) The field on top; the head a sentence about the next thing.

## Friction table (P01–P39 = chat C; severity 3 = blocks or misleads, 1 = cosmetic)

| # | Where | Is | Expected | Kind | Sev | File:line | Fix idea | Effort |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | Head | **confirmed:** „Heute ist frei.“ 32 px/300 while Mo holds 9, 37 min free | speaks about what is next | content | 3 | `PlannerPage.tsx:387` | head from the next loaded day | S |
| P02 | Overdue | **confirmed:** 6 „Frist war …“ rows inside Monday, no own place | own group, outside day time | structure | 3 | `PlannerPage.tsx:636`, `board.ts:133` | group „Überfällig“ on top | M |
| P03 | Rows | **confirmed:** 3 of 9 with tick; invoice ⋯ has 5 entries, ToDo 10 | same slots on every row | consistency | 2 | `PlannerPage.tsx:645`, `invoices/plannable.ts:5` | lead slot: tick / „Bezahlt“ / icon | M |
| P04 | Week | **confirmed:** 128 × 8 px bars; 56–71 % empty, right-half ink 3 % on opening | page filled with things | layout | 3 | `planner.module.css:38`, `PlannerPage.tsx:919` | days as columns or cards | L |
| P05 | Type | **partly:** title 16, meta 13 (house scale); 25 of 47 fragments 13 px, nothing between 16 and 28 | a step for day and next thing | type | 2 | `planner.module.css:79` | day name `--text-xl` | S |
| P06 | Field | **confirmed:** y 567 under the week, label + hint; phone y 900 > fold 851; empty 817 | the centre, always in reach | layout | 2 | `PlannerPage.tsx:969`, `planner.module.css:5` | field first / fixed bottom | M |
| P07 | Opening | 0 things on screen, 9 one tap away | things on arrival | structure | 3 | `PlannerPage.tsx:723` | pick first day with rows | S |
| P08 | Row ⋯ | no „move to day“; „Später“ on tomorrow's thing does nothing, toasts „Später“ | pick a day | function | 3 | `PlannerPage.tsx:482` | „Verschieben …“ chips, drag | M |
| P09 | Sentence | „schieb … auf Mi“: pin stored, thing stays Mo, preview says nothing changes | thing on Wednesday | bug | 3 | `core/plan/instructions.ts:302` | engine honours the pin | M |
| P10 | Invoice | settle = 6 taps, 3 screens, 20 s; „Öffnen“ = edit form | pay in place | function | 2 | `invoices/plannable.ts:57` | `onDone` = paid, with undo | M |
| P11 | ToDos | „Öffnen“: form edits one ToDo, panel beside shows another | same record | bug | 1 | `todos/plannable.ts:68` | `?open=` sets the panel too | S |
| P12 | Rest | link only from 17:00; overdue rolls Mo → Di; nine equal reason lines | offered in ⋯; overdue stays | function | 2 | `rest.ts:12`, `PlannerPage.tsx:864` | menu entry; grouped lines | S |
| P13 | Head detail | „Heute: … Das reicht für heute.“ beside 9 things | true for the day | wording | 2 | `strings.ts:8436` | only with one thing | S |
| P14 | Head | figure top right (x 1645), content left; weight 300 | near its content; 400–700 | type | 1 | `PlannerPage.tsx:856` | drop `thin`; sentence in page | S |
| P15 | First visit | empty state flashes, field jumps 250 px | stable | motion | 2 | `PlannerPage.tsx:897` | skeleton until first run | S |
| P16 | Empty | 7 equal empty rows (336 px) + empty state; field at y 817 | one invitation | layout | 2 | `PlannerPage.tsx:897` | field in the empty state | M |
| P17 | Desktop rows | ⋯ hidden until hover; invoice rows show no control | visible affordance | affordance | 2 | `ui/Patterns.module.css:355` | always visible in day panel | S |
| P18 | Targets | phone 12 of 20 < 44 px (⋯ 42, tick 24) | ≥ 44 px | a11y | 2 | `planner.module.css:91` | 44-px hit area | S |
| P19 | Strip | 7th chip cut, no scroll hint | hint or 7 fit | layout | 1 | `planner.module.css:121` | fade; 7 equal columns | S |
| P20 | Bars | fill relative to own day (12-min day looks full) | comparable days | data | 2 | `PlannerPage.tsx:937` | one scale for the week | M |
| P21 | Overbooked | no state: `capacityState` has no „over“ | named, with tone | state | 2 | `components/capacity.ts:9` | state + `Progress tone` | S |
| P22 | Blockers | look like things (grey title, no icon) | told apart | consistency | 1 | `PlannerPage.tsx:706` | icon or own line | S |
| P23 | Waiting | „Wartet auf freie Zeit · 14“ folded, 13 px, under the field | visible backlog | structure | 2 | `PlannerPage.tsx:727` | own column | M |
| P24 | Field text | „… oder sagen“ reads as voice; 136-char hint | says what happens | wording | 1 | `strings.ts:8588` | shorter; examples as chips | S |
| P25 | Field | not focused on arrival | type at once (desktop) | function | 1 | `PlannerPage.tsx:181` | focus on wide pages | S |
| P26 | Page ⋯ | „Neu verteilen“, „Woche prüfen“, „Tage einteilen“ behind 42 px beside the field | page actions in the head | structure | 1 | `PlannerPage.tsx:809` | `PageAction` + head menu | S |
| P27 | Split | things get 476 px (25 %), the week 1086 px | things get the room | layout | 2 | `PlannerPage.tsx:914` | swap the ratio | M |
| P28 | Week rows | „3 h 12 frei von 3 h 12“ four times | quiet when nothing differs | noise | 1 | `components/capacity.ts:26` | „frei“ + number only | S |

P29–P39 are free. Paths: `web/src/modules/planner/` (pages in `routes/`), else `web/src/`.
