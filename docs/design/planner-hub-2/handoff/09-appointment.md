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

- Line 1: day · time · place (`--text-sm`). Things already linked `before` / `after` stand under small heads (A5 „Vorbereitung“, „Danach“) as tick lines (they are ToDos: read through `linkEntries`, ticked through `todo.doneRequested` inside `undoable` – calendar never imports ToDos).
- A1 are two quiet buttons in the foot, drawn by the planner for blocker rows (calendar's panel is the body only: it has no channel to the planner's field and must not import it). A tap closes nothing: focus moves into the planner's field, which shows the lead chip A2 („vor Friseur, Mi“) before the input (the order of lead chips and preview: [00-common](00-common.md) „One slot, an order“); the chip is two controls: a small menu button (name A6, offers A3 „am Tag davor“ – hidden when the appointment is today) and a separate ✕ (name A6 „Entfernen“). Backspace in the empty field removes the chip.
- Enter: ToDo on the appointment's day (or the day before / after), link `before` / `after` – the planner's own `addFromField` grows: day and links inside its one undoable action, with the field's toast K7 („Liegt auf Mi, vor Friseur.“); not the bus. Only a plain ToDo – also one with steps – takes the lead chips (A2 → link and day, T11 → topic). For every other kind (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) the chips are drawn struck through while K1 shows and are not applied. When a chip gives the day, K1 / the field's toast names that day.
- The new row carries chip A4 („vor Friseur“) in its chip line and sorts directly before (after) the blocker within the day.

## States

no linked things (no heads) · with linked things · lead chip active in the field · calendar off (no blocker rows at all, as today) · appointment moved in the calendar (the linked thing keeps its day; its chip still names the appointment; nothing moves by itself) · appointment deleted (chip reads X3 as plain text).

## 1920 / 412

412: the two buttons share one row (each ≥ 44 px high, wrap allowed); the lead chip stands before the input as on 1920.

## Edge cases

- All-day events and events without a time are no blockers: nothing offered.
- A recurring appointment: the link points to the occurrence's id as the calendar's `linkTarget` resolves it today; the next occurrence starts clean.
- He types a date word with the lead chip active („morgen“): his word wins, the chip's day is ignored, the link stays.

## Tests

- Calendar panel component test (states); `addFromField` with the lead chip writes the ToDo, its day and a `_links` row with `before` in one undo entry, with no `links[]` entry; A3 is not offered for an appointment today.
- Order test: the row sorts before / after the blocker and is still moved only by him.
- e2e seed `e2e/seed/plan-appointment.seed.spec.ts`; `planner-hub-2.spec.ts` D3 re-measured (taps 4, switches 0); its `linked` now reads `_links` (`before` from the ToDo to `calendar:ev1`) instead of `todo.links[]`.
