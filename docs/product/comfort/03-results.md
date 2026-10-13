# Comfort review – 03 Results (before / after)

Counts follow the method of [01-friction.md](01-friction.md) (code-traced, Desktop / Android).

## Package 1a – undo for every delete (`feat/comfort-row-actions`)
| Action | Before | After |
|---|---|---|
| Delete a booking, invoice, subscription, event, note, bookmark, pantry item, person/gift, budget/goal/deposit (D / A) | 2–3 / 2–3, permanent | 2–3 / 2–3, **undo with 1 tap** (toast) or Ctrl+Z |
| Pause a subscription, pantry − / + | 1 / 1, no undo | 1 / 1, undo toast |

Not changed on purpose: vault documents (file bytes cannot be restored), chat thread delete (keeps its confirm dialog), automatic chat retention clean-up, invoice "bezahlt" (its undo also removes the booking, which the journal cannot do).
Tests: `checkModules.test.ts` (rule), `core/undo/deleteWithUndo.test.ts`, e2e `money.spec.ts` "comes back with Rückgängig".

## Package 2 – create with fewer steps (`feat/comfort-create`)
Built: Quick Capture `n ` (note) and `r ` / "Rechnung …" (invoice, no confirm step), repeat bookings take category and account of the payee's last booking, "Duplizieren" for bookings, invoices and events/reminders (the copy opens for editing, undo toast), a new person has no birthday date preset.

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 10 | Create an invoice | 3 / 4 (dialog) | **1 / 2** (capture line + Enter) | `create.spec.ts` |
| 16 | Quick note | 3–4 / 3 | **1 / 2** (`n text` + Enter) | `create.spec.ts` |
| 11 | Repeat booking (same payee) | 2–3 / 3–4 | **2 / 3** (amount + payee, category/account set) | `create.spec.ts` |
| – | Same invoice next month | 3 / 4 | **2 / 2** (open, "Duplizieren", save) | `create.spec.ts` |
| 21 | Add a birthday | wrong date silently possible | date required, no preset | `create.spec.ts` |

Not done: "Mehr Felder" fold (package 3, `AdvancedFields`), capture targets for pantry and person (the parser has no signal for them), no confirm step for finance captures (kept on purpose: finance captures are only booked after confirmation, see the quick-capture doc), duplicate for to-dos (to-do editor is in package 3's branch).
