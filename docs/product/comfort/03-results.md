# Comfort review – 03 Results (before / after)

Counts follow the method of [01-friction.md](01-friction.md) (code-traced, Desktop / Android).

## Package 1a – undo for every delete (`feat/comfort-row-actions`)
| Action | Before | After |
|---|---|---|
| Delete a booking, invoice, subscription, event, note, bookmark, pantry item, person/gift, budget/goal/deposit (D / A) | 2–3 / 2–3, permanent | 2–3 / 2–3, **undo with 1 tap** (toast) or Ctrl+Z |
| Pause a subscription, pantry − / + | 1 / 1, no undo | 1 / 1, undo toast |

Not changed on purpose: vault documents (file bytes cannot be restored), chat thread delete (keeps its confirm dialog), automatic chat retention clean-up, invoice "bezahlt" (its undo also removes the booking, which the journal cannot do).
Tests: `checkModules.test.ts` (rule), `core/undo/deleteWithUndo.test.ts`, e2e `money.spec.ts` "comes back with Rückgängig".

## Package 4 – links and search to the record (`feat/comfort-links`)
Built: a search hit or assistant answer links to `<module>?open=<id>` and the module opens the record itself (`ui/useOpenParam`; to-dos, calendar, bookings, invoices, subscriptions, budgets/goals, notes, pantry, bookmarks, documents open their dialog, people and lists show the person/list). Pantry: "Alle n nachkaufen" (one click for everything that runs low) and low stock on the home widget. Chat: "Als Notiz speichern" per answer (notes module must be on, undo in the toast).

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 25 | "Where was that" (search) | 5–8 keystrokes + find the row / tap, type, tap + find the row | **Ctrl+K, text, 1 click, the record is open** / 3 taps, the record is open | `open-record.spec.ts` |
| 20 | Low pantry items → shopping | 1 per item | **1 for all** | `pantry-restock.spec.ts` |
| – | Keep a chat answer | copy + new note ≈ 4 | **1 click** | `chat.spec.ts` |
| 24 | Document expiry from the home widget | widget rows not tappable | (unchanged: needs the `DueList` row link, see open items) | – |

Not done: invoice → to-do/reminder (the due date already reaches the calendar and the notifications, a second reminder would add noise), subscription → its bookings (no link in the data model, would need a `subscriptionId` or payee matching), palette verbs, location "Route" in rows, tappable widget rows for vault/pantry.
