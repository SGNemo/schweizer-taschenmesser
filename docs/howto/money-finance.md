# Money group: Finanzen (package 1)

Binding rules: [MODULE-IDENTITY](../design/MODULE-IDENTITY.md). Index: [HOW-TO](../HOW-TO.md). Code: `web/src/modules/finance/`.

## Data (manifest version 4, all new fields optional, no index change)
- account `kind` (checking, savings, cash, card); category `parentId` (one level) and `icon` (id from `categoryIcon.ts` `CATEGORY_ICONS`); booking `transferId`, `splits[]`, `repeat: 'weekly'`.
- **Transfer** = two bookings with the same `transferId` (expense on the source, income on the target, no category, no payee): balances move, `monthSummary`, `expensesByCategory`, budgets and the CSV see them as neither income nor expense (`isTransfer`). `transfer.ts` builds the pair, `TransferEditor` edits/deletes both halves together.
- **Split** = `splits[]` with at least two parts that add up to `amountMinor` (`splitsValid`; the schema stays a plain object, the editor checks). Evaluations count per part (`categoryParts`).

## Pure logic (tested with expectation tables)
`analysis.ts` roll-up of sub-categories (`rollupExpenses`, `topCategoryTotals`), comparison (`delta`, `compareMonths`, whole percent, rounded), year (`yearSummary`, `rollupYear`), filter (`applyBookingFilter`), duplicate hint (`findPossibleDuplicate`, same account/kind/amount/payee within 2 days; a hint, the second save goes through). `forecast.ts` outlook: balance today + the next dates of repeating bookings (`nextRepeatDate`, month ends clamp) + subscription charges + open invoices; a subscription that is also a repeating booking counts once; overdue items land on today. `export.ts` CSV (`;`, amounts with a dot, one row per split part).

## Cross-module (public API, additive)
`public.ts`: `listExpenseCategories` returns `parentId`; `expensesByCategory` counts split parts and skips transfers; new `plannedExpensesByCategory(from, to, currency)` (follow-ups of repeating expenses not yet booked) for the budget forecast in package 4.

## UI
Overview: previous-month delta under the KPIs (arrow + sign as text, no colour of its own); the outlook as two sentences (balance at the end, lowest point); in **Erweitert**: "Details" (line, horizon month end / 30 / 90 days, list) and the Monat/Jahr switch (`?period=year&year=` also opens it from a link). Bookings: the filter bar "Mehr" (account, category incl. children, amount range, transfers, "Umbuchung", "Als CSV exportieren") shows in Erweitert or while a filter is on; "Umbuchung" also sits on the Konten tab and in the empty list. Booking dialog: split under "Mehr Felder". Widget `balance`: expense change vs. last month in the context line and "Ausgabe +". Stimulus budget: the finance page stays within `e2e/stimulus-budget.json` (the new controls are Erweitert, not Basis).

## Not in this package
AI action for transfers (needs a custom handler and account matching), more than two account cards in the head (foundation decision), rule from a single booking.
