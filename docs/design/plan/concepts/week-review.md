# Week review – concept

Index and seed figures: [README.md](README.md). Package: WR1 in [PACKAGES.md](PACKAGES.md).

## What the planner needs from it

A quiet look back at the start of the week, where the week is planned anyway: „Woche prüfen“ (`modules/planner/components/WeekCheck.tsx`). Today the only review is `weekReview()` in `todos/progress.ts`, shown in the ToDos „Jetzt dran“ widget (switch `focus.weekReview`, off on fresh installs); it knows ToDos only, compares with the week before and never sees tracked time or habits. Seed: 10 ToDos done and 28 h 05 tracked in the last 7 days – the review today shows the first, never the second.

## Smallest useful step

One line on top of the „Woche prüfen“ sheet, only while `focus.weekReview` is on:
„Letzte Woche: 9 Dinge erledigt · 28 h erfasst · 5 Tage gegangen“ (at most three parts, ≤ 68 characters, the rest dropped silently). Nothing on the board, no new head link, no notification. The „Jetzt dran“ widget shows the **same** collected line for its own range (rolling 7 days incl. today, title „Diese Woche“ unchanged) instead of its ToDo-only sentence: one source, one wording. Its comparison texts `weekMore`, `weekSame`, `weekLess`, `weekBest` go (they compare ToDos only and would contradict a line with hours and habits); `weekNone` stays as the one calm text when no module has a part. Tests that change: `modules/todos/progress.test.ts` (`weekReview`), `e2e/progress.spec.ts` (`week-review`).

## Data flow

- New lazy contribution `weekLine?: () => Promise<{ default: WeekLineSource }>` with `WeekLineSource = (ctx: { from: string; to: string }) => Promise<{ text: string; order: number } | undefined>`; collector `collectWeekLines(ctx, manifests)` in `core/modules/contributions.ts` (a failing source is skipped, like `collectHeadlines`). The caller picks the range: the sheet passes the last ISO week (Mon–Sun, „Letzte Woche: …“), the widget its rolling 7 days („Diese Woche“); dates `YYYY-MM-DD`.
- Each module counts only its own data and formats its own part (`t.<module>.weekLine(...)`, numbers via `core/i18n/format`): ToDos „9 Dinge erledigt“ (top-level, `completedAt` in the week), time tracking „28 h erfasst“ (finished sessions minus breaks), habits „Spazieren gehen an 5 Tagen“ (the goal with the most done days; rest days neither count nor show). A module with nothing to say returns `undefined` – never „0 …“.
- No bus event: nothing is requested from another module. `accounts`: no `weekLine` (`exclusion.test.ts` already pins its contribution keys).

## Focus checklist

1 Stimulus: one text line on a sheet the user opened; widget: replaces a line, adds none. · 2 Off: `focus.weekReview` (existing, off by default) for both places. · 3 Next step: the sheet's own primary action stays the only button. · 4 Calm: no comparison in the line, never „n von m“, no „nur“, no percent; a part only appears when it is above 0. · 5 Interruption: computed, nothing stored. · 6 Tests: collector + each module's part (empty week → `undefined`), widget/sheet with the switch off. · 7 Readability: plain text, no colour. · 8 Clicks: 0 extra (shown where the user already is). · 9 Removed: the ToDo-only review sentence of the widget (the shared line replaces it) – one wording instead of two.

## Stimulus and dependencies

Adds one line on an opened sheet, removes one in the widget: net 0 on the overview. Hotspot `core/modules/types.ts` (new contribution type) – one chat at a time, so after Wochenende package 5; `NextWidget.tsx` is also touched by Wochenende package 3. The concept packages start after Wochenende package 6 (see PACKAGES.md).

## Not now

A history of past weeks, charts, goals for the week, a Monday notification, AI summaries.
