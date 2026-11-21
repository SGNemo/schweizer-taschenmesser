# Planner rethink – the new model (phase 2)

Branch `design/planner-rethink`, 2026-11-21. Status: **waits for four answers** ([README](README.md) „Fragen“). Analysis: [ANALYSIS](ANALYSIS.md). Data, migration, sync, sources: [CONCEPT-MIGRATION](CONCEPT-MIGRATION.md). Words: [CONCEPT-COPY](CONCEPT-COPY.md). Directions, critique, accessibility: [CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md). Supersedes the run and engine rules of [plan/CONCEPT.md](../plan/CONCEPT.md) §2–§3 once package 1 is merged; the source contract (§4), the calendar chips (§5) and the AI layer (§6) there stay. Package numbers below refer to the plan written after the answers.

## 0. In one paragraph

The plan is **data the person lays**, not the output of a run. A thing sits on the day he put it on until he moves it; a new thing lands on the day he looks at; a day that has passed keeps its open things, shown as a quiet group on today; a lock holds a thing on its day against every proposal; a day may hold more than its time and says so. The engine no longer runs on its own: it is a **proposer** behind buttons („Rest verteilen“, „Woche vorschlagen“, „Verteilen …“), always with a preview, and it only proposes days for things the button hands to it. Measured goal: things that change their day without an action = **0**.

## 1. States

One row is the whole truth: the **placement** (`planner_assignment`: thing, part, `date`, `minutes`, `order`, `locked`). Day and lock live in the same row, so they cannot disagree, also not after a sync merge. Everything else is derived at read time by one function, used by every surface of the planner (sheet, band, grid, load, calendar chips, widget, the readers of its rows). A date set in ToDos is not a day in the plan; it shows as the chip „In ToDos: Do“ ([CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §4):

```
dayOf(thing) = date of its placement row      (the thing is open at its source)
             ?? the `day` of a dated turn at its source (a training on Thursday, a routine's occurrence)
             ?? none
```

| State | Is | Seen as | Who sets it |
| --- | --- | --- | --- |
| **no day** | `dayOf` = none | folded group „Noch ohne Tag“ under the day | default for a thing without a date; „Vom Tag nehmen“ |
| **laid** | `dayOf` = a day from today on | a row on its day | entering, moving, dragging, taking a proposal or a chip |
| **locked** („fest“) | the row has `locked` | the row with a closed lock and the word „fest“ | the lock on the row; „… fest“ / „…!“ in the field |
| **proposed** | **never stored** – a row of a preview, or the chip „Vorschlag: Do“ on a thing without a day | preview / chip | the proposer, on request |
| **missed** | a placement row with a date before today, thing still open | group on today („Noch offen von Mo, Di“) | nobody – a date passing is not a write |

Transitions – each is one undoable action of the person; the proposer has none:

- no day → laid: enter, „Auf heute“, day pick, drag, accept a proposal.
- laid → another day: move. **Nothing else changes its day.** „Später“ is the move to the next day.
- laid ⇄ locked: one tap on the lock. Moving a locked thing by hand is allowed and keeps the lock (it binds the proposer, not him); the toast says so („Steuer liegt auf Mi · fest“).
- laid / locked → missed: time. Back: „Alle auf heute“, a day pick, „Verteilen …“ (preview; leaves locked things out).
- any → no day: „Vom Tag nehmen“ (removes the row). Any → gone: done or deleted at the source (the row is hidden, never deleted behind his back – [CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §3), „Nicht planen“.

**Order inside a day** stays on the row (`order`): a new or moved thing goes to the end, a drop takes its position; fixed blocks and appointments sort by their time as today; the order is mirrored to the ToDo (`planMark.order`), so the „Heute“ card keeps its order.

**May be spread** is a property, not a state: a laid thing may be handed to the proposer by „Rest verteilen“ / „Verteilen …“; a locked one never. **Parts:** nothing is cut by itself. A long thing is one row on one day (the day may be overbooked). „In Teile aufteilen …“ is an action with a preview – also offered inside a proposal when a thing fits no day in one piece. Each part is its own row (movable and lockable on its own); „Teil 1/2“ is counted from the live rows, never stored.

## 2. The engine becomes a proposer

`core/plan/` keeps `capacity`, `windows`, `explain`, `units`; `plan()` is replaced by

```ts
propose({ today, days, stay: Placement[], loose: Unit[], range: { from, to }, settings })
  → { proposals: Placement[], unplaced: { unit, reason }[] }
load(date, placements, day) → { usable, planned, over }      // pure, no stored „last run“
```

- `stay` = every placement the action did not hand over (always: locked ones, other days' things). It comes back untouched – no rule is left that moves it (kept, carried, bumped, pulled, after-part go).
- `loose` = the units the button names: things without a day („Woche vorschlagen“), the unlocked things of the day on the sheet („Rest verteilen“ – on today: what is still open), the unlocked missed things („Verteilen …“). A unit is a whole thing or one existing part; `propose` never splits.
- Order of the loose units as before: hard due first (latest start), priority, soft due, age, id; into days of `range` with room (usable minutes, `planLimit` main things), never onto an overbooked day, never before a source's start date.
- Deterministic, no clock inside. **Stable under partial acceptance:** when some proposals are taken (moved into `stay`), `propose` over the remaining loose units returns the remaining proposals unchanged. Fixtures S1–S6 are rewritten as (stay, loose) → proposals, each with one line why it changed.
- It runs **only** for a preview (button or sentence) and for the chips „Vorschlag: Do“: one call over all things without a day that have a deadline (so two chips never claim the same room), computed at render, never written. These deadline chips always show; the setting „Neues automatisch vorschlagen“ adds chips for things without a deadline. No timer, no live query, no write of its own.
- **Overbooking:** `over > 0` shows „2 h 10 mehr als planbar“ on the day and offers „Rest verteilen“. Nothing is displaced.

## 3. Missed

- **Where:** one group on top of today's sheet (question 1); each row names its day („war Mo“). The rows stay stored on their day, so a past day in the week or four-week view shows them too, with the word „offen“ and no figure.
- **In one move:** „Alle auf heute“ (1 tap), „Verteilen …“ (preview → „Übernehmen“, 2 taps), per row the day pick (2 taps on desktop and phone: a missed row carries tick, lock and the move button, no ⋯); several at once by „Auswählen“. Each is one undo entry. Nothing happens until he taps.
- **Locked and missed:** stays in the group with its lock; „Verteilen …“ leaves it out and says so („1 bleibt: fest“); „Alle auf heute“ and the day pick move it, lock kept.
- **Calm:** no red, no count in the page head, no „seit 3 Tagen“; the group shows three rows on the phone, seven on the desktop, then „und 4 weitere“; the head always names the days. A thing open for more than 14 days gets the quiet offer „Vom Tag nehmen“. Money past its deadline stays in „Frist vorbei“ as today.
- The ToDo's `plannedFor` stays the passed date, so the „Heute“ card keeps listing it (`plannedFor ≤ today`) without a write.

## 4. Entering

A new thing typed into the planner's field lands on **the day on the sheet, else today** – also when that day is full (the line „… mehr als planbar“ appears) or kept free (hint „Do ist frei gehalten. Liegt trotzdem dort.“). No other thing moves. A date in the text wins („Zahnarzt 7.12.“); „bis Do“ stays a deadline and the thing lands on the day on the sheet. **Lock words** after a day: „fest“, „lock“ or a trailing „!“ („Zahnarzt Do fest“, „Zahnarzt Do!“); without a day in the text they stay part of the title and lock nothing; not „muss“ (too common in titles). `plan.requested` from another module: the day asked for, else today. Things dumped without a day keep their two doors: the pile sheet („Tage einteilen“, step 1) and the global quick capture create things **without** a day.

## 5. More than a week

- **Range:** any date. The plan has no horizon; `horizonDays` only bounds how far a proposal looks (default 14).
- **View:** the week band pages („‹ KW 47 ›“, „Heute“); a switch in the band's row turns it into a **four-week grid** (question 3); a grid day shows the number of things, „offen“ for a passed day with open things and „+ 2 h 10 mehr“ when overbooked – free minutes only fit the band.
- **Onto any date:** „Verschieben …“ shows the four weeks from today as its picker (‹ › for more): row menu, „Verschieben …“, day = **3 taps** for any day in the next four weeks. Band and grid are drop targets.
- **Time of later weeks:** the weekday defaults hold for every date; only touched days are stored. „Zeiten dieser Woche“ (the former „Woche prüfen“) applies a template to the week in view and runs nothing.
- **Cost:** views read placements by the `date` index for their range; sources are listed up to the last day in view; `load` per visible day (28 at most).

## 6. Moving

Drag a row onto a day of the band or grid (mouse; touch after a long press); the same by menu („Verschieben …“, first entry) and keyboard (`M` on the focused row; arrow keys pick the day). Multi-select: „Auswählen“, then one day pick for all (one undo entry). The lock is one tap on the row. **Dropping moves the dropped thing and nothing else**; a full target shows its overbooking.

## 7. Counter-scenarios

| Scenario | Today | New | Verdict |
| --- | --- | --- | --- |
| First morning („Wochenende“ A–C): pile → days | „Tage einteilen“, preview, „Übernehmen“ (7 taps) | same sheet; its last step is the proposal with preview | equal |
| „Kopf leer“: dump a pile (pile sheet or quick capture), sort later | things spread at once, 16 wait | they arrive in „Noch ohne Tag“ (folded); „Woche vorschlagen“ → preview → „Übernehmen“ | calmer; +2 taps for who wants them spread |
| Reminder chain (invoice → deadline → pay) | invoice placed by the run | chip „Vorschlag: Do · Frist Fr“, one tap; „Nächste Fristen“ unchanged | +1 tap, no silent day |
| A training or routine dated at its source | shown on its day | shown on its day (`dayOf`), no tap | equal |
| Someone who liked the automaton | default | setting „Neues automatisch vorschlagen“ + „Woche vorschlagen“ | 2 taps a day, nothing silent |
| Evening „Rest verteilen“ | 2 taps | same | equal |

## 8. Target, measured against the use case

| Figure | Now | Target |
| --- | --- | --- |
| Things on another day than laid, without an action (U1, after two days) | 5 | **0** |
| Things that move while another is moved (laying + repair) | 1 + 4 | **0** |
| Missed things without a trace | 5 | **0** |
| Handles to put five missed things back, each on a chosen day | 17 in 3 passes | **10** in 1 pass (also possible: 1 „Alle auf heute“, 2 „Verteilen …“) |
| New thing lands on the day on the sheet (empty / full / kept free) | no / no / no | yes / yes / yes |
| A thing onto a day in three weeks | not possible | **3** taps |

The same values stand as `TARGET` in the measuring script; each package re-measures `IST` for the paths it changes, the last one switches the assertion to `TARGET`.
