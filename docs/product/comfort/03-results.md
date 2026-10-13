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

## Package 4 – links and search to the record (`feat/comfort-links`)
Built: a search hit or assistant answer links to `<module>?open=<id>` and the module opens the record itself (`ui/useOpenParam`; to-dos, calendar, bookings, invoices, subscriptions, budgets/goals, notes, pantry, bookmarks, documents open their dialog, people and lists show the person/list). Pantry: "Alle n nachkaufen" (one click for everything that runs low) and low stock on the home widget. Chat: "Als Notiz speichern" per answer (notes module must be on, undo in the toast).

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 25 | "Where was that" (search) | 5–8 keystrokes + find the row / tap, type, tap + find the row | **Ctrl+K, text, 1 click, the record is open** / 3 taps, the record is open | `open-record.spec.ts` |
| 20 | Low pantry items → shopping | 1 per item | **1 for all** | `pantry-restock.spec.ts` |
| – | Keep a chat answer | copy + new note ≈ 4 | **1 click** | `chat.spec.ts` |
| 24 | Document expiry from the home widget | widget rows not tappable | (unchanged: needs the `DueList` row link, see open items) | – |

Not done: invoice → to-do/reminder (the due date already reaches the calendar and the notifications, a second reminder would add noise), subscription → its bookings (no link in the data model, would need a `subscriptionId` or payee matching), palette verbs, location "Route" in rows, tappable widget rows for vault/pantry.

## Package 1b – row actions, quick-shift (`feat/comfort-row-actions`, same PR as 1a)
Built: `RowMenu` + `ItemRow.menu` ("⋯", right-click, long press), `DateChips` + `core/time/quickShift`, reminder snooze from the list, invoice swipe/menu/home-widget action, finance bookings on `ItemRow` with category change in the menu.

| # | Action | Before D / A | After D / A | Asserted in |
|---|---|---|---|---|
| 2 | Reschedule appointment (to tomorrow) | ~5 / 7–9 | **3 / 3** (open, "Morgen", save) | `comfort.spec.ts` |
| 4 | Snooze a reminder from the list | not possible (≈5) | **2 / 2** (⋯, "In 1 Std") | `comfort.spec.ts` |
| 9 | Invoice paid from the home widget | 3 / 3 (open page, row, button) | **1 / 1** | `comfort.spec.ts` |
| 12 | Change a booking's category | 3 / 3–4 | **2 / 2** (⋯, category) | `comfort.spec.ts` |
| – | Delete a booking | 3 / 3, permanent | 3 / 3 or swipe-left 1 (touch), undo 1 | `money.spec.ts` |

| 5 / 6 / 8 | Tick, to tomorrow, due/priority (to-dos) | 1 / 5 / 4–5 (D), 1 / 6–7 / 4–6 (A) | **1 / 2 / 2** (swipe right = tick, swipe left or ⋯ → "Morgen"/"Nächste Woche"/Hoch) | `comfort.spec.ts` |

To-do rows are now `ItemRow`s (checkbox as lead, subtasks nested), so `J/K/E/Space` work there too. Still open for later packages: subscription price inline (action 14), gift "geschenkt" (22), pantry quick actions (19/20).

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
