# Money group: Budgets (package 4)

Binding rules: [MODULE-IDENTITY](../design/MODULE-IDENTITY.md). Index: [HOW-TO](../HOW-TO.md). Code: `web/src/modules/budgets/`.

## Data (manifest version 3, all new fields optional, no index change)

Budget: `period` (`month` default, `quarter`, `year`), `carryOver`, `warnAtPercent`; the field `monthlyLimitMinor` keeps its name and means "limit per period". Goal: `monthlyRateMinor` (the planned rate), `startDate` (since version 4, when the saving began).

## Pure logic (expectation tables in `__tests__/periods.test.ts`, database tests in `rows.test.ts`)

- `period.ts`: `periodOf` (calendar month, quarter, year; leap years), `previousPeriodMonth`, `pastPeriodMonths`, `elapsedIn`.
- `compute.ts`: `spentInMonths` (a budget on a category includes its sub-categories, a budget on a sub-category only itself), `carryIn` (the unspent or overspent amount of the period right before, never more than one limit either way, no chains), `effectiveLimit` (never below 0), `budgetStatus(limit, spent, warnAt)` (the exact percent counts: 79,99 % is not yet 80 %), `projectedSpend` (the larger of the run rate and spent + planned, so a planned rent is not counted twice; only for the running period), `goalPlan` (months to reach the goal with the rate, the date, whole months late against the deadline), `goalPace` (saved ÷ months since `startDate`, at least one month, rounded to the cent) and `paceReachedOn` (the month the target is reached at that pace; only shown when no planned rate is set).
- `data.ts` `loadBudgetRows` joins this with finance's public API (`expensesByCategory` per month, `plannedExpensesByCategory`, `listExpenseCategories` with `parentId`); with finance off the rows are empty; `loadHistory` gives the last six periods.

## Signature: fill bars and ring

Head (`HeroSlot`): the figure "Noch frei" (what is left in the main currency) with a context line and, on wide screens, a `Ring` of the spending shares; the fill bars are the budget cards' `Progress`. The ring is decoration, every number is text on the cards.

## UI

Card: spent of limit, left/over, the period ("Q3 2026", "2026") and the carry-over as a muted line, and a forecast line only when the pace lands **above** the limit ("Im bisherigen Tempo: etwa X über dem Budget"; calm: no line while it looks fine). Editor: category tree, limit; in **Erweitert**: period, carry-over, warning level (empty = the setting), currency; for an existing budget the **history** (last six periods, spent against limit) with a link to the bookings of its last month **and category** (`/finance?tab=transactions&month=…&category=<id>`: the bookings list opens with its filter set). Goals: planned rate and "Gespart seit" (both Erweitert; with a start the card says "Bisher legst du im Schnitt X pro Monat zurück.") and a plan line ("Mit 100 € im Monat bist du im September 2027 am Ziel. Das sind 2 Monate nach dem Zieldatum."). Settings: `warnAtPercent` (default 80), `showForecast` (default on), both with help text. "Jetzt wichtig": over the limit (red, as before) and, calm (accent, running period only), a budget that reached its warning level. Widget: the two budgets with the highest share (healthy ones too) and the goals; "Ausgabe +" opens finance's booking dialog.

## Not in this package

AI actions for **budgets** are not possible without a core change: a budget has no text field the assistant could name (it has only a category *id*, and the assistant never sees user data), so `create`/`update` could not find the category or the target. Goals take `monthlyRateMinor` and `startDate` through the existing goal actions. Idea for a later core change: an `AiFieldType` that resolves a category *name* locally.
