# Focus audit 2 – results per package (before / after)

Measured with `npm run measure:stimulus` (`web/e2e/screenshots/stimulus.spec.ts`, the audit's script, in the repo since round 2): seeded Dev build, medium data, phone 412×915 and desktop 1280×800.

| Metric | Before | After package 1 |
|---|---|---|
| Phone home, page height | 6598 px | **2069 px** |
| Phone home, buttons / links / icons | 22 / 65 / 67 | **12 / 34 / 23** |
| Focus settings visible at once | 14 rows | 6 rows + 1 folded block |
| Settings → Darstellung, phone height | 6945 px | **5831 px** |
| Desktop home, buttons / links / icons | 44 / 81 / 110 | 34 / 50 / 66 |
| Stored settings (core / focus scope) | 77 / 27 | unchanged (no key removed) |

Package notes
- **Package 1** (`feat/focus2-defaults`): defaults for fresh installs (calm home, streaks, week review and module strips off); existing installs keep what they had; focus settings folded.
- Tests: new `core/focus/defaults.test.ts` (fresh vs existing, no overwrite, run once); E2E specs that assumed the old defaults now switch the old behaviour on first (`showAllWidgets`, `openMoreFocus` in `e2e/helpers.ts`), none removed or weakened.
- Manual test (one week with the diary): is the calm home enough, or is "Mehr anzeigen" needed too often?

## Package 2a – Home: one "Heute" card, pinning (`feat/focus2-today`)
Same seeded Dev build, medium data. Tool: `web/e2e/screenshots/measure-focus.spec.ts` (counts visible elements; its own baseline "before" = state after package 1, so the first columns differ slightly from the audit counting). Raw numbers and screenshots: `img/before2-*`, `img/after2a-*`.

| Metric (home) | Before 2a | After 2a |
|---|---|---|
| Phone, page height | 2069 px | **1202 px** |
| Phone, buttons / links / icons | 13 / 34 / 23 | **12 / 15 / 20** |
| Phone, interactive elements under 44 px | 26 | **4** |
| Phone, actions on first screen | 29 | 26 |
| Desktop, buttons / links / icons | 35 / 50 / 66 | 34 / 31 / 63 |
| Desktop, interactive elements under 44 px | 25 | 3 |

- "Jetzt dran": 3 equal buttons became 1 main + 1 quiet + a "⋯" menu.
- Widget title links are now 44 px high; the card shows no per-appointment links (one "Alle Termine" link).
- Tests: `modules/todos/today.test.ts`, `home/layout.test.ts` (pinned, folding, migration of an old record), `home/home.test.tsx` (stored record without `pinned`), `e2e/today.spec.ts` (desktop + pixel-7). Specs that expected the three old blocks now check the card; the ones that expected the plan row of the suggested task use a second planned task.
- Open for 2b: the ToDo page (calm layout, "Wartet noch" once, no FAB where there is an add field).
