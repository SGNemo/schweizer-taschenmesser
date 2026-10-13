# Comfort review – 03 Results (before / after)

Counts follow the method of [01-friction.md](01-friction.md) (code-traced, Desktop / Android).

## Package 1a – undo for every delete (`feat/comfort-row-actions`)
| Action | Before | After |
|---|---|---|
| Delete a booking, invoice, subscription, event, note, bookmark, pantry item, person/gift, budget/goal/deposit (D / A) | 2–3 / 2–3, permanent | 2–3 / 2–3, **undo with 1 tap** (toast) or Ctrl+Z |
| Pause a subscription, pantry − / + | 1 / 1, no undo | 1 / 1, undo toast |

Not changed on purpose: vault documents (file bytes cannot be restored), chat thread delete (keeps its confirm dialog), automatic chat retention clean-up, invoice "bezahlt" (its undo also removes the booking, which the journal cannot do).
Tests: `checkModules.test.ts` (rule), `core/undo/deleteWithUndo.test.ts`, e2e `money.spec.ts` "comes back with Rückgängig".

## Package 5a – missing functions, no data change (`feat/comfort-more`)
Built: search and kind filter in the bookings list (text over payee, note, category and amount, all months while searching; kind chips stay in the month), and an overview "Offene Geschenke" across all people with a one-click "Verschenkt" (also in the person's own gift list, swipe right on touch).

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 12/13 | Find a booking ("where was that") | not possible (month stepper only) | **type 1 word**, all months | `more.spec.ts`, `filter.test.ts` |
| 22 | Gift given | 4–5 / 5–6 | **1 / 1** | `more.spec.ts` |
| – | What do I still have to give? | open every person | **1 list** | `more.spec.ts`, `people.test.ts` |

Next (5b/5c, with data changes): subscription price history and "gekündigt zum", recurring invoice/booking.
