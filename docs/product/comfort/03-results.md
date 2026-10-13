# Comfort review – 03 Results (before / after)

Counts follow the method of [01-friction.md](01-friction.md) (code-traced, Desktop / Android).

## Package 1a – undo for every delete (`feat/comfort-row-actions`)
| Action | Before | After |
|---|---|---|
| Delete a booking, invoice, subscription, event, note, bookmark, pantry item, person/gift, budget/goal/deposit (D / A) | 2–3 / 2–3, permanent | 2–3 / 2–3, **undo with 1 tap** (toast) or Ctrl+Z |
| Pause a subscription, pantry − / + | 1 / 1, no undo | 1 / 1, undo toast |

Not changed on purpose: vault documents (file bytes cannot be restored), chat thread delete (keeps its confirm dialog), automatic chat retention clean-up, invoice "bezahlt" (its undo also removes the booking, which the journal cannot do).
Tests: `checkModules.test.ts` (rule), `core/undo/deleteWithUndo.test.ts`, e2e `money.spec.ts` "comes back with Rückgängig".

## Package 1b – row actions, quick-shift (`feat/comfort-row-actions`, same PR as 1a)
Built: `RowMenu` + `ItemRow.menu` ("⋯", right-click, long press), `DateChips` + `core/time/quickShift`, reminder snooze from the list, invoice swipe/menu/home-widget action, finance bookings on `ItemRow` with category change in the menu.

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 2 | Reschedule appointment (to tomorrow) | ~5 / 7–9 | **3 / 3** (open, "Morgen", save) | `comfort.spec.ts` |
| 4 | Snooze a reminder from the list | not possible (≈5) | **2 / 2** (⋯, "In 1 Std") | `comfort.spec.ts` |
| 9 | Invoice paid from the home widget | 3 / 3 (open page, row, button) | **1 / 1** | `comfort.spec.ts` |
| 12 | Change a booking's category | 3 / 3–4 | **2 / 2** (⋯, category) | `comfort.spec.ts` |
| – | Delete a booking | 3 / 3, permanent | 3 / 3 or swipe-left 1 (touch), undo 1 | `money.spec.ts` |

Still open in package 1: to-dos (after Fokushilfen #57–#60), subscription price inline (action 14), pantry/people gift quick actions (19, 22).
