# Energy – concept

Index and seed figures: [README.md](README.md). Package: E1 in [PACKAGES.md](PACKAGES.md).

## What the planner needs from it

Hard, thinking-heavy things go better in the hours one is fresh, and a day of only hard things does not work. The planner needs **which things are hard** – not how the user feels. Today nothing exists: no field on items or ToDos, no setting; the engine orders a day by deadline, priority, age. The nearest inputs are the day window (`PlanDay.window`), Wochenende package 4 (day parts „Vormittag/Nachmittag/Abend“ on a thing) and package 6 („Tagesbeginn“).

## Smallest useful step

One flag per plan item: „Braucht Kopf“ (⋯ on the row, toggle; default off; shown as a small icon with label in the row detail, not in the title). With the planner setting „Schweres zuerst“ (default **off**) the engine:

- orders a day's sessions so flagged ones come first (after pinned order and hard deadlines, which still win);
- places at most `heavyPerDay` flagged sessions per day (default 2, 1–3) – a further one waits for the next day with room, reason „ein ruhigerer Tag passt besser“; a hard deadline overrides the limit.

With day parts (package 4) „first“ means the first part of the day; without them, the order in the day. No energy diary, no mood or sleep data, no daily check-in, no score.

## Data flow

Planner-internal: `planner_item.heavy?: boolean` + `manifest.version` + migration; `PlanItem.heavy?` in `core/plan/types.ts`; the rule in `core/plan/engine.ts` (pure, deterministic, fixtures), the reason in `explain.ts`. No source module changes, no bus event, no contract change. A source may one day pass a hint (`PlannableItem.heavy?`) – not in this step.

## Focus checklist

1 Stimulus: one ⋯ entry, one icon in the row detail of flagged things only. · 2 Off: „Schweres zuerst“ (off by default); with it off the flag is stored but changes nothing (said in the hint). · 3 Next step: unchanged; the first session of the day tends to be the important one. · 4 Calm: no „zu viel Schweres“, no colour; the wait reason is neutral. · 5 Interruption: stored, synced, undo with every run. · 6 Tests: engine fixtures (order, limit, deadline beats limit, setting off = today's plan unchanged), migration. · 7 Readability: icon + text. · 8 Clicks: 2 (⋯, „Braucht Kopf“). · 9 Removed: manual pinning of hard things to a morning (the common workaround) becomes unnecessary.

## Stimulus and dependencies

Small. Touches `core/plan/{types,engine,explain}.ts` and `modules/planner/{schema,migrations,settings}.ts`: after Wochenende packages 4 and 6 (same files), last of the four concepts.

## Not now

Energy levels per day or hour, learning from time tracking when one is productive, a chronotype setting, AI guessing which things are hard.
