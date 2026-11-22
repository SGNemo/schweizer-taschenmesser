# Planner rethink – analysis of the current state (phase 1)

Branch `design/planner-rethink`, 2026-11-21. Index: [README](README.md). Measured with [`web/e2e/usecases/planner-rethink.spec.ts`](../../../web/e2e/usecases/planner-rethink.spec.ts) on `develop` (fixed clock, Monday 2026-11-16 08:00, empty install, ToDos + planner on, things of one hour). What hangs on the automaton and the user material: [ANALYSIS-DEPENDENCIES](ANALYSIS-DEPENDENCIES.md). Paths below are under `web/src/`.

## 0. Verdict on the starting thesis

**Confirmed.** The planner is an automaton: every input change, every midnight and every user action starts a run of the engine over _all_ things, and only two kinds of things are exempt from being moved: a pin on a day that has not passed, and a fixed block. The maintainer uses it as a plan he lays himself. Three facts carry the verdict:

1. „Verschieben …“ already nails the thing (`item.pinned`), so „fest“ exists – but a pin **on a passed day is ignored** (`core/plan/engine.ts:87-88, 164`): the missed thing is planned like a new one, on any day with room. That is the moment the maintainer describes.
2. A thing he did _not_ move by hand has no protection at all: it is „kept“ only while nothing with a higher rank (pin, deadline, priority, a carried thing of higher priority) wants its room.
3. Nothing he enters lands where he looks: the field ignores the day on the sheet (`modules/planner/routes/PlannerPage.tsx:397`, `actions.ts:271`).

The switch `autoReplan` (off = no background run) is no way out: user actions still run the whole engine (`services.ts:165`), and without the midnight run the missed rows stay on days the board no longer shows – they vanish instead of moving.

## 1. The use case as a script

| Path | Figure | Now | Target | Measured (package 7, desktop / phone) |
| --- | --- | --- | --- | --- |
| **U1** lay out a week (10 things on Mo–Fr), miss two days, put it back | things on another day than laid, without an action (Wednesday morning) | **5** of 10 | 0 | 0 / 0 |
| | missed things whose row says where they were meant to be | 0 of 5 (**5 untraceable**) | all | all (0 untraceable) / all |
| | handles to put the plan back (find, menu, „Verschieben …“, day) | **17** taps in 3 passes | 10 in 1 pass (or 1: „Alle auf heute“) | 9 in 1 pass (U7 „Alle auf heute“: 1) / same |
| | things that changed their day while he moved another one (repair) | **4** | 0 | 0 / 0 |
| | same while laying out the week | 1 | 0 | 0 / 0 (laying: 11 taps by dragging; phone by menu 31) |
| **U2** new thing while Thursday is on the sheet | lands on Thursday | no (Wednesday) | yes | yes / yes |
| **U3** new thing of an hour, today full | lands on today | no (Wednesday) | yes, day shows the overbooking | yes / yes |
| **U4** new thing on a day off | lands there | no (Wednesday) | yes, with a hint | yes / yes |
| **U5** a thing onto Monday in three weeks | possible | **no**: the dialog offers 7 days, the sentence „schieb … auf 7.12.“ changes nothing visible, the day is not reachable | yes, 3 taps | yes, 3 taps, visible in „4 Wochen“ / same |

Measured column: `e2e/usecases/planner-rethink.spec.ts` asserting `TARGET` (2026-11-22, three runs light and dark). Also asserted: U6 lock 1 tap (phone 2: the lock control shows only on rows that are „fest“), U7 „Alle auf heute“ 1 tap.

What happened in U1, step by step (facts file `test-results/usecase-planner-rethink/U1-desktop-chrome-facts.json`):

- Monday: the engine had already spread the ten things; he moves 3 (9 taps incl. finding). Moving „Geschenk“ to Wednesday pushes „Vortrag“ from Wednesday to Thursday – the first unasked move, while he is still laying out.
- Wednesday 08:00: Monday's three and Tuesday's two things are gone from their days. Angebot and Steuer sit on Thursday, Keller and Blogpost on Friday, Fahrrad on Saturday. No toast, no group, no mark: the rows read „Angebot · ToDo · 1 h“ like any other. „Warum hier?“ would say „weiter von …“ and probably names the current day, because the write-back has already overwritten the date it reads (`PlannerPage.tsx:508`; not verified by a run).
- Putting it back: moving Keller to Thursday pushes Vortrag to Friday, moving Blogpost… pushes it on to Saturday; Steuer and Angebot leave Thursday for Saturday. Only the third pass holds, because by then every thing is nailed. **The stable state is „everything pinned“** – which is his model, reached the hard way.

## 2. Every trigger of a run

Background runs are serialised, not undoable and silent; a run is skipped when the input hash, the row signature and the pending dates are unchanged (`modules/planner/run.ts:461-468`). The hash contains `today`.

| Trigger | Where | Seen by him | Breaks principle |
| --- | --- | --- | --- |
| Live query over sources (every ToDo edit anywhere, invoices …), calendar, habit blocks, own tables, settings, sync flags | `services.ts:194-226`, `274` | nothing; rows change day | 1 |
| Midnight timer, tab visible again, app start | `services.ts:255-280` | nothing; yesterday's rows land elsewhere | 1, 3 |
| Sync-applied change of plan rows | `services.ts:208`, `run.ts:460` | nothing | 1 |
| A new appointment in the calendar | same live query | nothing; the day shrinks, things leave it | 1, 4 |
| Field entry | `PlannerPage.tsx:397` → `actions.ts:271` | toast „Eingeplant: Mi · X jetzt Do“ | 2, 1 |
| Tick, „Später“, „Verschieben …“, unpin, „Nicht planen“, deadline mark, duration, day part, „Als Pause“ | `actions.ts:318-481` | toast naming up to two moves | 1 (the other moves) |
| Day sheet (available, day off, blocker, window), „Woche prüfen“ | `actions.ts:567-628` | toast | 1 |
| „Tage einteilen“, sentence, „Neu verteilen“, „Rest verteilen“ | preview → `actions.ts:510, 662` | preview, then toast | none (asked for) |
| `plan.requested` (note, list, mail) | `services.ts:281` → `actions.ts:116` | toast „Im Plan: X · Di“ | 2 |

Dry runs without a write exist already (`services.ts:179 previewUser`, `run.ts:574`) – the rebuild keeps exactly this part.

## 3. Every rule that changes a day

| Rule | Where | Effect | Breaks |
| --- | --- | --- | --- |
| Past days leave the plan; their rows count as „carried“ | `core/plan/engine.ts:62-65`, `216-222` | missed things are placed again from today on | 3 |
| Order: priority, then kept > carried > new | `engine.ts:90-93`, `203-209` | a carried thing of higher priority takes a kept thing's day | 1 |
| Day limits: usable minutes, `planLimit` main things | `engine.ts:211-213` | what does not fit goes to a later day or „Wartet“ | 1, 2 |
| Hard due pulls forward, may use the buffer | `engine.ts:166-195` | things come earlier, others are bumped | 1 |
| Bumped / capacity / after-part | `engine.ts:226-266` | kept things lose their day | 1, 4 |
| Pin: placed whatever the room; **ignored in the past and beyond the horizon** | `engine.ts:84-88`, `164` | the one protection ends when the day ends | 3, 4 |
| Sessions of a long thing on different days | `engine.ts:139-141`, `units.ts` | a 2-h thing becomes two rows on two days, unasked | 1 („aufgeteilt“) |
| Horizon: nothing after `today + horizonDays − 1` (7/14/28) | `engine.ts:62`, `settings.ts:79` | no plan beyond; the board shows 7 days whatever the setting (`calendar.ts:23`) | 6 |
| User's own `plannedFor` on a ToDo is only „earliest“ | `run.ts:199-215`, `308-334` | a date set in ToDos is no day in the plan | 1 |
| „Später“ lifts the pin, sets earliest = next day | `actions.ts:332-343` | the thing lands on any day from tomorrow | 2 |
| Write-back of the first day to the ToDo | `run.ts:407-433` | „Heute“ card and ToDo views follow every move | (carrier) |

**What „fest“ means today:** set only by „Verschieben …“, by the sentence „schieb X auf Mi“ and by quick capture `p …`; shown as „fest“ only while the row sits on the pinned day (`board.ts:210`); the same word marks fixed blocks (a training at 18:00). It guarantees the day while that day lies between today and the horizon. It does **not** protect: after the day has passed; beyond the horizon; a second session; against „Später“; and it protects nothing else – every unpinned thing still gives way to it (a pin overbooks nothing, it displaces).

## 4. Friction

Severity 3 = stops the task or loses trust, 2 = detour, 1 = irritation. P/W/C numbers refer to earlier analyses.

| # | Friction | Sev | Principle | Evidence |
| --- | --- | --- | --- | --- |
| R01 | Missed things are planned again on any day, silently | 3 | 3 | U1: 5 of 5 |
| R02 | A missed thing carries no trace of its day | 3 | 3 | U1: 5 untraceable; P12 |
| R03 | Moving one thing moves others | 3 | 1, 4 | U1: 4 + 1; S2 fixture |
| R04 | New things ignore the day on the sheet | 3 | 2 | U2–U4; W23, W20 |
| R05 | No plan beyond 7 visible days; horizon ≤ 28 | 3 | 6 | U5 |
| R06 | A pin dies with its day | 3 | 4 | `engine.ts:87` |
| R07 | A full day sends the new thing away instead of showing the overbooking | 2 | 2, 4 | U3 |
| R08 | Long things are cut into sessions without being asked | 2 | 1 | C8 |
| R09 | Things not moved by hand have no standing („kept“ is a tie-break) | 2 | 1 | §3 |
| R10 | A run rewrites the ToDo's date on every move; „Heute“ follows | 2 | 1 | `run.ts:407` |
| R11 | „Wartet auf freie Zeit“ is where things go that he placed and the engine could not keep | 2 | 1 | `board.ts:252` |
| R12 | One word „fest“ for a pin and for a timed block | 1 | 4 | `strings.ts` `row.fixed` |
| R13 | The `p` prefix loses its pin in the planner's own field (read from the code) | 1 | 4 | `actions.ts:304` |
| R14 | „Später“ cannot say which day | 1 | 2 | `actions.ts:332` |
| R15 | Stable only when everything is pinned – 17 taps to get there | 3 | 1 | U1 |

**Critique of the current surface** (`design:design-critique`): the sheet, the band and the one figure are calm and stay; what fails is not the look but the contract behind it. Critical: the day on the sheet is no target (R04), the row shows no state (laid by him? by the engine? missed?), the move dialog ends after seven days. Moderate: the toast is the only place a move is named and it is gone in seconds; „Warum hier?“ explains a decision he never asked for. What works: the preview with „Übernehmen“ for sentences and „Rest verteilen“, undo on every action, the folded waiting group, no red.
