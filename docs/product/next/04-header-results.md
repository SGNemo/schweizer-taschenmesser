# 04 – Mobile header: results

Branch `claude/charming-volta-ruetox`. Measured on the seeded Dev-Preview build (`npm run measure:stimulus`, spec `e2e/screenshots/first-row.spec.ts`), phone 412 px wide, 2.625 DPR; pixel-7 (412×839) and 412×915 give the same numbers.

| Page | Before: title bottom / first row (y px) | After: title bottom / first row | Gained |
|---|---|---|---|
| todos | 228 / 507 | 181 / 463 | 47 / 44 |
| calendar | 234 / – (no list rows) | 183 / – | 51 |
| finance | 229 / 1325¹ | 176 / 1272¹ | 53 |
| pantry | 234 / 443 | 183 / 395 | 51 / 48 |

¹ finance: the first `li` is a widget row far down; the title bottom is the stable number.
Page height (phone): todos 4015 → 3971, calendar 1122 → 1074, finance 1800 → 1747. Stimulus budget: no new warning, buttons/icons/small targets unchanged.

What gave the ~48 px: area label and tabs share one line (`AreaFrame`), title one step smaller (`--text-2xl`, `ui/global.css`). The topbar folds on scrolling down (> 48 px) and returns on scrolling up, at the top, with keyboard focus in the bar, with palette/dialog/on-screen keyboard open; with less motion it stays fixed.

Screenshots: [todos](img/04-before-todos.png) → [after](img/04-after-todos.png), [calendar](img/04-before-calendar.png) → [after](img/04-after-calendar.png), [finance](img/04-before-finance.png) → [after](img/04-after-finance.png).

Not done: the "Erweitert" switch stays right of the title on the six pages (none of them has a "⋯" menu). `pageChrome.advancedInMenu` exists: a page that gets a menu sets it and `AdvancedToggle` steps aside.
