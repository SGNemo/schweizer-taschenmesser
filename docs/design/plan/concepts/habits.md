# Habits as fixed blocks – concept

Index and seed figures: [README.md](README.md). Package: H1 in [PACKAGES.md](PACKAGES.md).

## What the planner needs from it

Routines take time the planner does not know about: a day with 3 h free and a 30-minute walk is really 2 h 30. Today the user can only type a blocker into the day sheet by hand, every day. The planner does **not** need to plan, tick or judge habits – the habits page stays the one place for that. Seed: 4 goals (water as a count with a reminder window, a weekday walk, stretching 3× a week, a pill at 08:00), none with a duration; 23 rest days in 363 entries.

## Smallest useful step

One optional field on the goal: „Zeit im Plan freihalten“ – „keine · 15 · 30 · 60 Min“ (free entry 5–240), default „keine“. Only goals with a value block time, and only on their scheduled days (period `day`: every day or the chosen weekdays). The planner's day sheet lists them with the other blockers („Spazieren gehen · 30 Min“, the habits icon, no tick box); the board's free figure already counts them. Archived goals never block. A rest day (settable for today only, `GoalCard.tsx`) removes today's block. Weekly goals („3× pro Woche“) never block: there is no day to put them on.

## Data flow

- Habits: `goalSchema.minutes?` (int 5–240) + `manifest.version` + migration (additive, old goals unchanged); editor field in `GoalEditor.tsx`.
- Contract: `PlannableSource.blocks?(ctx: { today; until }): Promise<{ date: string; id: string; label: string; min: number }[]>` in `core/modules/types.ts`; habits ships a `plannable` source whose `list()` returns `[]` and whose `blocks()` returns the blocks. A collector `collectPlanBlocks(ctx, manifests)` (+ a live hook like `useCalendarItems`) in `core/modules/contributions.ts`; `planDays()` in `modules/planner/days.ts` is pure and takes the blocks as an input next to `calendar`, so every caller passes them: `run.ts` `buildInputs`, `board.ts` `buildBoard`, `useBoard.ts`; the run's input snapshot (`services.ts` `inputSnapshot`) includes them, so a changed goal replans. `DayBlocker` gets a source marker (`own | calendar | habit`): only `own` shows the remove button in `DaySheet.tsx`.
- No bus event (a read, not a request). A block never has a time window (no `from`/`to`): habits do not say when.
- Habit reminders, `habits.goal.open` and streaks stay exactly as they are.

## Focus checklist

1 Stimulus: no new element on the board; one row per block in a sheet that already lists blockers. · 2 Off: the field itself, per goal, default „keine“ (no global switch needed: nothing happens without a value). · 3 Next step: unchanged. · 4 Calm: a block is never „missed“, „offen“ or red; the plan never mentions whether the habit was done. · 5 Interruption: stored on the goal, synced. · 6 Tests: `blocks()` per period/weekday/rest day; day minutes with a block; run replans when a goal's minutes change; migration. · 7 Readability: label + minutes, icon paired with text. · 8 Clicks: walk blocked every weekday = 1 field once instead of 1 blocker per day (5 a week). · 9 Removed: typing the same blocker into the day sheet every day.

## Stimulus and dependencies

Adds one optional field in the goal editor (behind „Erweitert“ if the editor has that layer). Hotspot `core/modules/types.ts`: after Wochenende package 5 and after WR1. Touches `modules/planner/{days,run,board,useBoard,services}.ts` and `DaySheet.tsx`: after the last Wochenende package that touches them (6).

## Not now

Habits as tickable plan items (double ticking, guilt), time windows for habits, weekly goals in the plan, sleep data (Wochenende decision Q3: only „Tagesende“).
