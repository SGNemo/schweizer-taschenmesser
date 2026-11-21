# Planner rethink – the new model (phase 2)

Branch `design/planner-rethink`, 2026-11-21. Status: **waits for four answers** ([README](README.md) „Questions“). Analysis: [ANALYSIS](ANALYSIS.md). Words: [CONCEPT-COPY](CONCEPT-COPY.md). Directions, critique, accessibility: [CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md). Supersedes the run and engine rules of [plan/CONCEPT.md](../plan/CONCEPT.md) §2–§3 once package 1 is merged; the source contract (§4), the calendar chips (§5) and the AI layer (§6) there stay.

## 0. In one paragraph

The plan is **data the person lays**, not the output of a run. A thing sits on the day he put it on until he moves it; a new thing lands on the day he looks at; a day that has passed keeps its open things, shown as a quiet group on today; a lock holds a thing on its day against every proposal; a day may hold more than its time and says so. The engine no longer runs on its own: it is a **proposer** behind buttons („Rest verteilen“, „Woche vorschlagen“, „Verteilen …“), always with a preview, and it only ever proposes days for things that are loose. Measured goal: things that change their day without an action = **0**.

## 1. States

Only two facts are stored; the rest is derived at read time, so no device ever has to write to „update“ a state.

| State | Stored as | Seen as | Who sets it |
| --- | --- | --- | --- |
| **no day** („Noch ohne Tag“) | no placement row | folded group under the day; the backlog | default for a thing that arrives without a date; „Vom Tag nehmen“ |
| **laid** | placement row (`planner_assignment`: thing, date, minutes) | a row on its day | entering, moving, dragging, taking a proposal, a date he sets in the source |
| **locked** („fest“) | `planner_item.pinned = date` (the existing field) | the row with a lock and „fest“ | the lock on the row, „… fest“ / „…!“ in the field |
| **proposed** | **never stored** – exists in a preview or as a chip „Vorschlag: Do“ on a thing without a day | preview row / chip | the engine, on request |
| **missed** | derived: placement date < today and the thing is open | group „Noch offen von Mo, Di“ on today | nobody – the date passing is not a write |

Transitions (every one is one undoable action of the person; the engine has none):

- no day → laid: place (enter, „Auf heute“, day pick, drag, accept a proposal).
- laid → laid (other day): move. Nothing else changes its day.
- laid ⇄ locked: one tap on the lock. Moving a locked thing by hand is allowed and keeps the lock on the new day (the lock binds the engine, not him).
- laid / locked → missed: time. Missed → laid: „Auf heute“, a day pick, or „Verteilen …“ (preview; skips locked things).
- any → no day: „Vom Tag nehmen“. Any → gone: done at the source, „Nicht planen“.

**„May be spread“** is a property, not a state: a laid thing may be picked up by „Rest verteilen“ / „Verteilen …“; a locked one never. **Splitting** is off by default: a long thing is one row on one day (the day may be overbooked). „In Teile aufteilen …“ is an action with a preview; after it each part is its own placement (`Teil 1/2`), movable and lockable on its own.

## 2. The engine becomes a proposer

`core/plan/` keeps `capacity`, `units`, `windows`, `explain`; `plan()` is replaced by

```ts
propose({ today, days, placed: Placement[], loose: PlanItem[], range: { from, to }, settings })
  → { proposals: Placement[], unplaced: { unit, reason }[], load: Record<date, Load> }
```

- `placed` is input and comes back untouched – there is no rule left that moves a placed thing (kept, carried, bumped, pulled, after-part go).
- `loose` things are placed by the old order that proved itself: hard due first (latest start), priority, soft due, age, id; into days with room (usable minutes, `planLimit` main things), never onto an overbooked day, never before `earliest`.
- Deterministic, no clock inside; **fixpoint**: `propose(x)` with its own proposals moved into `placed` proposes nothing. Fixtures S1–S6 are rewritten as (placed, loose) → proposals and each gets one line why it changed.
- `load(date) = { usable, planned, over }` is a pure function over placements and days, used by every surface (no stored „last run“).
- It runs **only**: for a preview (button or sentence), and for the chip „Vorschlag: Do“ on a thing without a day that has a deadline (computed at render, never written). No timer, no live query, no write of its own.
- **Overbooking:** `over = planned − usable > 0` shows „2 h 10 mehr geplant, als Zeit ist“ on the day and offers „Rest verteilen“. Nothing is displaced.

## 3. Missed

- **Where:** one group on top of today's sheet (question 1); each row names its day („war Mo“). The rows stay stored on their day, so a past day in a week or month view shows them too, dimmed.
- **In one move:** group actions „Alle auf heute“ (1 tap, undo) and „Verteilen …“ (preview → „Übernehmen“, 2 taps); per row the day pick (2 taps). Nothing happens until he taps.
- **Locked and missed:** stays in the group with its lock; „Verteilen …“ leaves it out and says so („1 bleibt: fest“); „Alle auf heute“ and the day pick move it, lock kept.
- **Calm:** no red, no count in the page head, no „seit 3 Tagen“; the group folds after seven rows („und 4 weitere“); a thing missed for more than 14 days gets the quiet offer „Vom Tag nehmen“ (back to „Noch ohne Tag“). Money past its deadline stays in „Frist vorbei“ as today.
- The ToDo's `plannedFor` stays the passed date, so the „Heute“ card keeps listing it (`plannedFor ≤ today`) without any write.

## 4. Entering

A new thing lands on **the day on the sheet, else today** – also when that day is full (the overbooking line appears) or kept free (hint „Do ist frei gehalten. Liegt trotzdem dort.“). No other thing moves. A date in the text wins („Zahnarzt 7.12.“); „bis Do“ stays a deadline and lands on the day on the sheet. **Lock words:** a trailing „!“ or the word „fest“ after a day („Zahnarzt Do fest“, „Zahnarzt Do!“); not „muss“ (too common in titles). A thing dumped without wanting a day: the pile sheet („Tage einteilen“) and the global quick capture keep creating things _without_ a day.

## 5. More than a week

- **Range:** any date. The plan has no horizon; `horizonDays` only bounds how far a proposal looks (default 14).
- **View:** the week band pages („‹ KW 47 ›“, „Heute“); a switch turns it into a **four-week grid** with one load mark per day (question 3). Moving onto any date: the day pick has „Anderer Tag …“ (date field), the band and the grid are drop targets.
- **Time of later weeks:** the weekday defaults hold for every date; only touched days are stored. „Zeiten dieser Woche“ (the former „Woche prüfen“) applies a template to the week in view.
- **Cost:** views read placements by the `date` index for their range only; sources are listed up to the last day in view; `load` is computed per visible day (28 at most).

## 6. Moving

Drag a row onto a day of the band or grid (mouse; touch after a long press, the sheet scrolls as today); the same by menu „Verschieben …“ (day chips of the week in view, „Anderer Tag …“) and by keyboard (`M` opens it on the focused row; in the grid the arrow keys pick the day). Multi-select: „Auswählen“ in the group or day menu, then one day pick for all. The lock is one tap on the row. **Dropping moves the dropped thing and nothing else**; a full target shows its overbooking.

## 7. Migration and two devices

- **Data:** none has to change. Every stored placement row stays where it is and is now „laid“; `pinned` is the lock; things the last run left unplaced have no row and appear under „Noch ohne Tag“. Nothing disappears: package 1 asserts „rows before = rows after“ on a copy of the seed and of a real-shaped plan.
- **Write-back:** `plannedFor` / `planMark` are written by the action that sets a day and cleared by the one that takes it; no pass over all things. A date the person sets in ToDos is **read** as the day (mark does not match → his date wins over the stored row) and written into the row by his next planner action on that thing – no background adoption, so no loop.
- **Two devices:** a placement is ordinary synced data; the later action wins per field. No device recomputes. A device still on the old version keeps running the automaton and can move rows; until both are updated the new device shows what arrives. Stated in the change note; a hard gate needs a sync protocol version and is out of scope.
- **Settings:** `autoReplan` is replaced by „Neues automatisch vorschlagen“ (off): when on, a thing without a day gets its chip „Vorschlag: Do“ also without a deadline – still a tap to take.

## 8. Counter-scenarios

| Scenario | Today | New | Verdict |
| --- | --- | --- | --- |
| First morning („Wochenende“ A–C): pile → days | „Tage einteilen“, preview, „Übernehmen“ (7 taps) | same sheet; its last step is the proposal with preview | equal |
| „Kopf leer“: dump a pile, sort later | things spread at once, 16 wait | things arrive in „Noch ohne Tag“ (folded); one tap „Woche vorschlagen“ → preview | calmer; +2 taps for who wants them spread |
| Reminder chain from the planner hub (invoice → deadline → pay) | invoice placed by the run | chip „Vorschlag: Do · Frist Fr“, one tap; „Nächste Fristen“ card unchanged | +1 tap, no silent day |
| Someone who liked the automaton | default | setting „Neues automatisch vorschlagen“ + „Woche vorschlagen“ each morning | 2 taps a day, nothing silent |
| Evening „Rest verteilen“ | 2 taps | same | equal |

## 9. Target, measured against the use case

| Figure | Now | Target |
| --- | --- | --- |
| Things that change their day without an action (U1, after two days) | 5 | **0** |
| Things that move while another is moved (laying + repair) | 5 | **0** |
| Missed things without a trace | 5 | **0** |
| Handles to put five missed things back | 17 | **1** all on today · **2** spread with preview · **10** each on a chosen day (1 pass) |
| New thing lands on the chosen day (empty / full / free) | no / no / no | yes / yes / yes |
| A thing onto a day in three weeks | not possible | **4** taps (menu, „Verschieben …“, „Anderer Tag …“, date) |

The targets stand as `TARGET` in the measuring script; package 7 switches its assertion.
