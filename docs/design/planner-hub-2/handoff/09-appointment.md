# Hand-off 09 – before and after an appointment (package 9)

Concept: [CONCEPT-INTAKE, idea 9](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/09-appointment.html`.

## Structure

The appointment is the recessed blocker row of the day sheet, as built („15:00 Friseur · 45 Min“). New: its title is the expand button (hand-off 04) and calendar ships a panel.

```
 15:00  Friseur ▾                                         45 Min
 ┌ compartment ──────────────────────────────────────────────┐
 │ Mi 2. Dez. · 15:00–15:45 · Salon am Markt                 │
 │ VORBEREITUNG                                              │
 │  ○ Bargeld holen                                          │
 │                    [Vorbereiten …] [Danach …] [Ganz öffnen]│
 └───────────────────────────────────────────────────────────┘
```

- Line 1: day · time · place (`--text-sm`). Things already linked `before` / `after` stand under small heads („VORBEREITUNG“, „DANACH“) as tick lines (they are ToDos: the tick is theirs).
- A1 are two quiet buttons. A tap closes nothing: focus moves into the planner's field, which shows the lead chip A2 („vor Friseur, Mi“) in the preview line's place (hand-off 03's slot); the chip is a small menu button offering A3 („am Tag davor“) and has ✕. Backspace in the empty field removes the chip.
- Enter: ToDo on the appointment's day (or the day before / after), link `before` / `after`; toast as for any entry, one undo.
- The new row carries chip A4 („vor Friseur“) in its chip line and sorts directly before (after) the blocker within the day.

## States

no linked things (no heads) · with linked things · lead chip active in the field · calendar off (no blocker rows at all, as today) · appointment moved in the calendar (the linked thing keeps its day; its chip still names the appointment; nothing moves by itself) · appointment deleted (chip reads X3 as plain text).

## 1920 / 412

412: the two buttons share one row (each ≥ 44 px high, wrap allowed); the lead chip stands above the field (the field is the last row).

## Edge cases

- All-day events and events without a time are no blockers: nothing offered.
- A recurring appointment: the link points to the occurrence's id as the calendar's `linkTarget` resolves it today; the next occurrence starts clean.
- He types a date word with the lead chip active („morgen“): his word wins, the chip's day is ignored, the link stays.

## Tests

- Calendar panel component test (states); `links` on `plan.requested` writes a `_links` row with `before` and no `links[]` entry.
- Order test: the row sorts before / after the blocker and is still moved only by him.
- e2e seed `e2e/seed/plan-appointment.seed.spec.ts`; `planner-hub-2.spec.ts` D3 re-measured.
