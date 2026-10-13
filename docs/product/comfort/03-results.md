# Comfort review – 03 Results (before / after)

Counts follow the method of [01-friction.md](01-friction.md) (code-traced, Desktop / Android).

## Package 1a – undo for every delete (`feat/comfort-row-actions`)
| Action | Before | After |
|---|---|---|
| Delete a booking, invoice, subscription, event, note, bookmark, pantry item, person/gift, budget/goal/deposit (D / A) | 2–3 / 2–3, permanent | 2–3 / 2–3, **undo with 1 tap** (toast) or Ctrl+Z |
| Pause a subscription, pantry − / + | 1 / 1, no undo | 1 / 1, undo toast |

Not changed on purpose: vault documents (file bytes cannot be restored), chat thread delete (keeps its confirm dialog), automatic chat retention clean-up, invoice "bezahlt" (its undo also removes the booking, which the journal cannot do).
Tests: `checkModules.test.ts` (rule), `core/undo/deleteWithUndo.test.ts`, e2e `money.spec.ts` "comes back with Rückgängig".

## Package 3 – Basis / Erweitert (`feat/comfort-advanced`)
Built: synced setting (`comfort`), header switch per module, global switch "Alle Module in der Erweitert-Ansicht", `AdvancedFields` with "Mehr Felder" and never-hide-data rule. Applied to to-dos (recurrence, "Irgendwann"), calendar (end, recurrence of events, note), invoices (reference, note), subscriptions (notice days, note), pantry (minimum, note), bookmarks (kind, tags, note), people (tags, note).

| Dialog | Visible fields before → after (Basis) |
|---|---|
| Event | 9 → 6 (title, all-day, date, time, location, notify) |
| To-do | 9 → 7 (title, list, priority, due, estimate, planned, note, subtasks; recurrence and "Irgendwann" behind "Mehr Felder") |
| Invoice | 6 → 4 |
| Subscription | 8 → 6 |
| Pantry item | 6 → 4 |
| Bookmark | 5 → 2 |
| Person | 5 → 3 |

Deliberately kept visible although the plan listed them: estimate and "Für heute einplanen" (feed the day plan), expiry (feeds the "Läuft ab" widget), recurrence of reminders. Not done yet in this package: "Jetzt" strips for calendar/finance/pantry, filter chips, finance tabs Konten/Kategorien into advanced.
