# Comfort review – 03 Results (before / after)

Counts follow the method of [01-friction.md](01-friction.md) (code-traced, Desktop / Android).

## Package 1a – undo for every delete (`feat/comfort-row-actions`)
| Action | Before | After |
|---|---|---|
| Delete a booking, invoice, subscription, event, note, bookmark, pantry item, person/gift, budget/goal/deposit (D / A) | 2–3 / 2–3, permanent | 2–3 / 2–3, **undo with 1 tap** (toast) or Ctrl+Z |
| Pause a subscription, pantry − / + | 1 / 1, no undo | 1 / 1, undo toast |

Not changed on purpose: vault documents (file bytes cannot be restored), chat thread delete (keeps its confirm dialog), automatic chat retention clean-up, invoice "bezahlt" (its undo also removes the booking, which the journal cannot do).
Tests: `checkModules.test.ts` (rule), `core/undo/deleteWithUndo.test.ts`, e2e `money.spec.ts` "comes back with Rückgängig".

## Package 5b – subscriptions: price history and "gekündigt zum" (`feat/comfort-subs`)
Built: every price change is kept (`priceHistory`, last 20, shown in the dialog as "9,99 € → 12,99 € (+30 %)") and a recent increase is flagged on the row ("Preis erhöht (+30 %)", 180 days); a field "Gekündigt zum" (stored as the recurrence end, so charges, deadlines, calendar and notifications stop by themselves; a "Gekündigt zum …" line on the row; ended subscriptions drop out of the totals). Data version 2 (migration sets an empty history).

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 14 | Change the price | 3 / 3, old price lost | 3 / 3, **history kept, increase flagged** | `subscriptions-plus.spec.ts` |
| – | Cancel a subscription for a date | pause or delete only | **1 field**, charges stop on that date | `subscriptions-plus.spec.ts`, `logic.test.ts` |

Not done: "price increased" notification, linking bookings to the subscription, an end date per price (a change counts from the day it is saved).
