# Use list actions (and "Erweitert") in a module

Rule behind it: [FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md) click targets, plan [product/comfort/02-plan.md](../product/comfort/02-plan.md). Tick/mark = 1 click, create with defaults = 2, change one field = 2–3.

## A list row
1. Build the row with `ItemRow` (`@/ui`): `title`, `meta`, `onOpen` (edit dialog), `end` (amount, badge).
2. **Primary action** (tick, paid): a button in `end`/`lead`; also `onSwipeRight` + `swipeRightLabel` (touch). **Second action** (later, delete): `onSwipeLeft` + `swipeLeftLabel`. A swipe is never the only way: the same action stays in `menu` or in the edit dialog.
3. **`menu`** (the "⋯", also right-click and long press): `RowMenuItem[]` with `label`, `onSelect`, optional `group` heading and `danger`. Put the daily one-field changes here (category, "Morgen", "In 1 Std"), delete last. Give `menuLabel` the row title when several rows share a page.
4. **Every write is undoable:** `deleteWithUndo(() => repo.remove(id))`, `changeWithUndo(() => repo.update(...), message)`, or `undoableWithToast` for moves. `check:modules` fails on a direct `xRepo.remove(` in `components/`/`routes/` (comment `comfort-allow-delete` for automatic clean-ups).
5. **Dates:** `DateChips` under a date field (Heute · Morgen · Nächste Woche); pure helpers in `core/time/quickShift.ts` (`presetDate`, `shiftDays`, `shiftMinutes`, `snoozeTarget`).
6. **Home widget:** `DueList` entries take `action: { label, run }` (one tap, with the undo toast).
7. Keys come for free from `ItemRow` (`J/K/E`); add `data-row-tick` for Space.

## Test it
Unit: `ui/rowMenu.test.tsx` shows the pattern. E2E: `e2e/comfort.spec.ts` counts clicks as comments and asserts the result and the undo.
