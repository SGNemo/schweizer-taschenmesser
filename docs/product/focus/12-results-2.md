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
