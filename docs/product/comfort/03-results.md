# Comfort review – 03 Results (before / after)

Counts follow the method of [01-friction.md](01-friction.md) (code-traced, Desktop / Android).

## Package 1a – undo for every delete (`feat/comfort-row-actions`)
| Action | Before | After |
|---|---|---|
| Delete a booking, invoice, subscription, event, note, bookmark, pantry item, person/gift, budget/goal/deposit (D / A) | 2–3 / 2–3, permanent | 2–3 / 2–3, **undo with 1 tap** (toast) or Ctrl+Z |
| Pause a subscription, pantry − / + | 1 / 1, no undo | 1 / 1, undo toast |

Not changed on purpose: vault documents (file bytes cannot be restored), chat thread delete (keeps its confirm dialog), automatic chat retention clean-up, invoice "bezahlt" (its undo also removes the booking, which the journal cannot do).
Tests: `checkModules.test.ts` (rule), `core/undo/deleteWithUndo.test.ts`, e2e `money.spec.ts` "comes back with Rückgängig".

## Package 5c – recurring invoices (`feat/comfort-repeat`)
Built: a field "Wiederholen" (Nie / Monatlich / Vierteljährlich / Jährlich) in the invoice dialog. Paying a repeating invoice creates the next one (same payee, amount, reference, note, due one period later, open); paying again never makes a second one; "Rückgängig"/"Wieder öffnen" takes an untouched next invoice away again. The row shows "↻ Monatlich". Data version 2 (optional `repeat`, internal `repeatOf`).

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 10 | Rent / insurance / subscription invoice every period | create again every time (3 / 4) | **paid = 1, the next one is there** | `repeat.spec.ts`, `invoices.test.ts` |

Not done: recurring **bookings** (salary, rent as a booking): they need a time trigger at app start and are a separate step; automatic creation of invoices that were never paid.
