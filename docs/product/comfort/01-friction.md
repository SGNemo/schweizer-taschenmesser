# Comfort review – 01 Friction measurement

Phase 1 of the comfort review (branch `docs/comfort-review`, docs only). Scope: every module except `disk` and the system info (being reworked elsewhere), plus the tools, global search/palette and Quick Capture.

**Method and limits.** Counts are traced from the code (routes, dialogs, widgets), not measured in a browser: a "click/tap" is one pointer action, typing is 0, native date/time/select pickers are assumed +1 each (+2–3 for a date). Android = 412 px layout. Screenshots (main view, first detail, create; Desktop 1920×1080 and Android 412×915; seed `medium`, Dev-Preview build) are in [screens/](screens/) as `<viewport>/<module>-<main|detail|create>.jpg` (no detail shot where the module has no row to open; accounts has no create dialog; `finance`/`todos` detail may show the list instead). Items marked *unclear* were not verifiable from code.

## Findings that shape everything else
1. **The comfort infrastructure exists but only `lists` uses it.** `useSwipeRow` (touch only, right = done, left unused), `useSelection`/`SelectionBar`, `data-row-tick` (Space), `data-list-search` (`/`), duplicate and the undo toast are used by `lists` only. `todos` has undo but its own `TaskRow` without `data-row`, so J/K/E/Space do nothing there.
2. **Deletes are permanent almost everywhere.** No undo for calendar, finance, invoices, subscriptions, budgets, pantry, notes, bookmarks, people, vault, chat. Ctrl+Z only reaches writes inside `undoable()`. Delete = red button inside the edit dialog, no confirm, no toast. Wrapping in `undoableWithToast` is small work.
3. **Home widgets are read-only for most modules.** `DueList` rows are plain `<li>` (no link, no action): invoices, subscriptions, vault, pantry. Only todos, lists and the "Jetzt dran" card act in place.
4. **Every edit is a full dialog.** No inline edit, no quick-shift for dates, no hover/context/long-press actions (zero hits for `onContextMenu`/`longPress`). Changing one field costs 3–5 (desktop) and 4–9 (Android, dates).
5. **Quick Capture is the fast path but covers 7 types** (todo, event, reminder, bookmark, list, finance, note). Missing: invoice, subscription, pantry, person/birthday, vault. A note needs a chip click (no prefix); finance always asks a confirm step.
6. **Search finds the module, not the record.** Palette hits open `routes[0]` of the module, so you must find the row again. Not searchable by design: accounts, chat.
7. **Habits and time tracking no longer exist** as modules (no module directory, only legacy redirects/old table names). The closest thing is the checklist template "Routinen" in `lists`. "Messages" = the AI chat only (there is no mail/messenger).
8. **Android has no autofill service**; copy from the detail view is the only path. Desktop autofill = Brave extension (Windows, opt-in).

## The 25 everyday actions (proposal – you edit)
Desktop = mouse+keyboard from the module view; Android = 412 px touch. "Target" follows the guideline: tick/mark 1, create with defaults 2, change one field 2–3.

| # | Action | Desktop today | Android today | Blockers / "not possible" | Target (D / A) |
|---|---|---|---|---|---|
| 1 | Create appointment | 0 (`N`, type, Enter) or 2 (form) | 2 (FAB, Save) | Quick Capture sets no location/duration; month tap does not create | 1 / 2 |
| 2 | Reschedule appointment | ~5 | ~7–9 | No drag, no "+1 Tag/Std"; two pickers | 2 / 2 |
| 3 | Create reminder | 0 (capture) / 3 | 2 / 3 | Form shows all appointment fields | 1 / 2 |
| 4 | Snooze a reminder (from list) | not possible (edit ≈5) | not possible | Snooze only on the firing prompt/notification centre | 2 / 2 |
| 5 | Tick off a todo | 1 | 1 | Widget "Offene Aufgaben" ticks without undo; Space/J/K dead | 1 / 1 |
| 6 | Todo to tomorrow | 5 (only the suggested one: 1 via "Später", which sets *plannedFor*, not *due*) | 6–7 | Two date concepts (Fällig vs Geplant); no chips, no swipe-left | 2 / 1 (swipe) |
| 7 | Create todo (defaults) | 1 + typing | 2 + typing | Field not focused on load | 1 / 2 |
| 8 | Change due date or priority | 4–5 | 4–6 | Full editor, no presets/inline | 2 / 3 |
| 9 | Mark invoice paid | 1 | 1 | Not from home widget (+2); always today, no paid-date; undo bypasses journal | 1 (also home) |
| 10 | Create invoice | 3 | 4 | No capture target; due defaults to today; no duplicate/recurring | 2 / 3 |
| 11 | Enter an expense | 2 (Plus, amount, Save) / ≈3 with capture + confirm | 3 / ≈4 | Needs account; no category suggestion; capture always confirms | 2 / 2 |
| 12 | Change category/amount of a booking | 3 | 3–4 (native select) | No inline edit, no last-category per payee | 2 / 3 |
| 13 | Check balance / budget | 0 (hero, widget); per account 1 | 0; 1 | Budget widget hides healthy budgets; no drill-down to bookings | 0 |
| 14 | Change subscription price | 3 | 3 | Old price overwritten, no history, no effective date | 2 / 3 |
| 15 | Open a bookmark link | 1 (tile/widget); list row opens editor, link = tiny icon | 1 | List vs tile inconsistent | 1 |
| 16 | Quick note | 3–4 (`N`, type, chip, Enter) | 3 | No note prefix/keyword; no checklist in a note | 2 / 2 |
| 17 | Tick shopping item | 1 (Space on row) | 1 / swipe | Good. Packing widget read-only | 1 |
| 18 | Add shopping item | 0–1 | 2 | No suggestions of recent items; duplicate silently ignored | 1 / 2 |
| 19 | Consume pantry item | 1 | 1 | No undo/toast; not in capture | 1 |
| 20 | Low pantry item → shopping | 1 per item | 1 per item | No "alle nachkaufen"; low stock not on widget; no toast | 1 total |
| 21 | Add a birthday | ≈2 + typing | 6–8 | Date defaults to **today** (silently wrong); not in capture | 2 / 3 |
| 22 | Mark gift as given | 4–5 | 5–6 | Status via select inside editor; no cross-person overview | 1 / 1 |
| 23 | Copy a password | 3 (row, detail, icon); keys `G T J Enter P` | 3 (+unlock 2–3 when locked) | No copy icon on the row; `/` search dead; U/P only in detail | 2 / 2 |
| 24 | Check document expiry | 0 (row meta) / 1 (chip) | same | Widget rows not tappable; no "renewed +1 year" action | 0–1 |
| 25 | "Where was that" (search) | 5–8 keystrokes + find the row | tap, type, tap + find row | Hit opens module, not record | 5 / 3, lands on record |

Also checked (not in the 25): **Timer** 3 to start (Werkzeuge → tile → Start), 2 to stop, no presets, no shortcut, no home tile. **Packing list tick** 1 (good), home widget read-only. **Keep a chat answer** ≈4 (copy → new note); no "save as note". **Delete + undo** is 2 + undo in todos/lists, 2–3 without undo elsewhere.

## Reading the numbers
- Already good (≤ target): 5, 13, 15, 17, 24 (partly). Tick/check works where a row has a direct control.
- Worst ratio to target: 2, 4, 6, 8, 12, 21, 22 (all "change one thing in a row") – this is the case for the row-action/inline pattern, not for new screens.
- "Not possible": 4 (snooze from list), duplicate (everywhere but lists), split/recurring bookings, partial payment, price history, drag, mark-paid from home, checklist in notes.

## Answers (Stopp 1, maintainer)
- Daily: to-dos (5–8), calendar/reminders (1–4), money (9–12). Nothing is missing from the list.
- Biggest annoyance: all four – changing one field needs a dialog, deletes without undo, widgets without action, creating takes too long. Plus: a **typed confirmation** is annoying. In code that exists only for "Alle Daten auf diesem Gerät löschen" (phrase `LÖSCHEN`, `core/reset/device.ts`), the recovery-screen reset and the disk delete (Rust-side, out of scope). Per-record deletes have no confirmation at all. Open question in 02-plan.
