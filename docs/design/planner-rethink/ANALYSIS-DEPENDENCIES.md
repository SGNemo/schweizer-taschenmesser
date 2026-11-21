# Planner rethink – what hangs on the automaton, and what users expect

Part of [ANALYSIS](ANALYSIS.md). Paths under `web/src/`. Verdict per row: **stays** (unchanged), **changes**, **goes**.

## 1. Dependencies

| What | Today | Verdict | After the rebuild |
| --- | --- | --- | --- |
| Write-back to ToDos (`plannedFor`, `planMark`; `modules/todos/plannable.ts:24-58`, `run.ts:407-433`) | every run writes the first day of every thing | **changes** | written only by the action that sets or clears a day (place, move, apply a preview, undo); never by a background pass. `planMark` keeps its meaning (planner-own date) and `prior` |
| A date set in ToDos (`views.ts:26 userPlannedFor`) | read as „earliest“, never a day | **changes** | a date set by hand in ToDos lays the thing on that day: the ToDo-side helper emits `plan.dayRequested`, the planner writes the row and nothing back ([CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §4); no background adoption |
| „Heute“ card, `dayPlan`, „im Plan: Mi“ (`todos/next.ts:87`, `TodosPage.tsx:280`) | follow `plannedFor` | **stays** | a missed thing keeps `plannedFor` in the past, so the card still lists it under today (`plannedFor ≤ today`) – the card needs no change |
| Disable clean-up (`services.ts:294`, `todos/planMark.ts:28`) | hands dates back to `prior` or clears them | **changes** | a laid day is his date: the mark is cleared, `plannedFor` stays |
| Sync gate `syncSettled()` (`core/sync/service.ts:181`) | guards the copy of user dates in background runs | **changes** | guards the one-time migration only; no background writer is left |
| Sources (`contributions.plannable`: todos, bookmarks, fitness, routines, invoices, subscriptions, vault, lists, people; habits `blocks`) | listed, the run places them | **changes** | listed as before; a dated occurrence (training, routine) shows on its day; a thing with a deadline only arrives as a _suggestion_ (question 2); `fixed` blocks and habit blocks are read live, never stored as placements ([CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §6) |
| `plan.requested` (notes, lists, mail; `actions.ts:116`) | ToDo + run, toast names the day | **changes** | ToDo + placed on the day asked for, else today; the toast names that day |
| Quick capture `p …` (`quickCapture/targets/adapters.ts:435`) | pin, earliest or hard due | **changes** | a day in the text places, a lock word locks |
| Calendar chips and time blocks (`modules/planner/calendar.ts`) | from the stored rows, 7 days | **changes** | from the stored placements, for the range the calendar asks; no run needed |
| Readers of the rows outside (`quickCapture/targets/index.ts:232 plannedOn`, mail „Im Plan · Mi“) | read `planner_assignment` | **stays** | the rows keep id and `date`; read through the one selector that hides finished things ([CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §3) |
| „Rest verteilen“ (`rest.ts`, 20:00 notice) | ops → preview → run | **stays**, narrower | preview and apply as today; only things that may be spread (not locked) move; one undo |
| „Tage einteilen“ (`daySetup.ts`) | preview → run, may reshuffle | **changes** | places the typed things on the days chosen; „verteilen“ inside it is the same suggest step with preview |
| „Woche prüfen“ (`WeekCheck.tsx`, `actions.ts:628`) | writes day rows, then a run without preview | **changes** | writes the day rows only; a day that now holds more than its time says so |
| Sentences (`core/plan/instructions.ts`) | ops → preview → run | **changes** | „schieb X auf Mi“ = move (no run); „Do frei“ = day row, no run; „neu verteilen“ / „alles neu mischen“ = suggestion with preview |
| Local model stage (`localStage.ts`) | translates to ops | **stays** | |
| Overload figure and toast (`overload.ts`) | horizon overflow from the last run | **changes** | per day: planned minus usable, computed from the placements; the weekly toast goes |
| „Wartet auf freie Zeit“ (`board.ts:252`) | what the engine could not place | **changes** | becomes „Noch ohne Tag“: things that have no day yet – by his choice, not by lack of room |
| „Frist vorbei“ (late money, `late.ts`) | off the days | **stays** | |
| Passed trainings (`passed.ts`) | asked once under today | **stays** | same pattern as the new missed group |
| Widget (`widgets/WeekWidget.tsx`) | stored rows + last run | **stays** | reads the placements |
| Sync (field LWW; `planner_day`, `planner_item`, `planner_assignment`; deterministic ids) | two devices run and converge by recomputing | **changes** | the placement is plain data: the later action wins per field; no device recomputes another device's plan. Convergence becomes the ordinary LWW case |
| Input hash, row signature, `LastRun` in `_meta` (`run.ts:38-52`, `242-260`) | skip unchanged runs | **goes** (for the background) | kept only as the base of a preview |
| Midnight and visibility timers (`services.ts:255-280`) | start a run | **changes** | trigger a re-render only (today changed → missed group) |
| `autoReplan`, `horizonDays`, `bufferShare`, `maxSessionMin` | engine inputs | **changes** | `autoReplan` becomes „Neues automatisch vorschlagen“ (off); the horizon is the range of a suggestion, not of the plan |
| Engine tests and fixtures S1–S6, `run.test.ts` | pin the automaton | **changes** | the engine keeps determinism and fixpoint as a _proposer_; fixtures get a `stay` input that never moves; run tests about background runs are replaced by „no write without an action“ |

## 2. What users expect (`design:research-synthesis`)

**Method:** secondary analysis of seven persona reports (2026-10-29, before the planner existed), two agent play-throughs of the maintainer's scenarios (Wochenende, Kopf leer), the planner-hub measurement and the maintainer's own words. **One real person** (the maintainer); everything else is simulated. No analytics exist (local-first).

| Theme | Evidence | Strength | Consequence |
| --- | --- | --- | --- |
| T1 The result does not match the intent: things land elsewhere or move unseen | P08, P09, P12 (planner hub), C5, C8 (Wochenende check), W10, W20, W23, W24; the maintainer's brief | strong (10 observations), one person | the day is the person's; the engine proposes |
| T2 Missed things and deadlines need a visible place and an honest, calm word | B08 (Herbert, Priya: a missed cancellation „wird nirgends als verpasst markiert“), P02, P72, „Wartet noch“ splits the personas 2 : 3 | strong (5 personas) | a missed group with a plain name; no „überfällig“ for chores |
| T3 People plan a week, not a day | V03 (5 personas: „Heute · Morgen · diese Woche“), V12 (4: compact week / month), persona A „plant die Woche sonntags“ | medium | several days in view; more than a week is the maintainer's own need, no other evidence |
| T4 Overload has to stay calm | Kopf leer U12 („Mich überfordert die Anzahl“), 6 personas: „3 Dinge reichen“, no red, no guilt | strong, already built | overbooking is a quiet line, never a counter that grows |
| T5 Control: move to a day, hold it there, give a day time | P08, P09, W10 | medium, one person | move and lock are first-class, one tap |
| T6 People who want to be told what to do when | Jonas (ADHD student) and Herbert like „Wartet noch“ and the next-step focus; Wochenende path A: one tap to a filled day | medium | the suggestion stays one tap away („Woche vorschlagen“) – the automaton becomes an offer, it does not disappear |

**Segments:** _the layer_ (the maintainer: knows where things belong, wants them to stay) – served badly today; _the unloader_ (Kopf leer, Jonas: dumps a pile, wants a start) – served well today and must not lose the one-tap proposal. **Open questions the material cannot answer:** whether anyone but the maintainer plans further than a week; whether the missed group reads as relief or as a pile after a holiday (the design caps it: folded, no count in the head).
