# Planner – the four missing concepts (index)

[CONCEPT.md §7](../CONCEPT.md#7-proposals-benefit--cost--recommendation) left four proposals as „later, own concept“. One file each (≤ 1 page), the packages with final prompts in [PACKAGES.md](PACKAGES.md). Nothing here is code. Rules: root `CLAUDE.md`, [FOCUS-GUIDELINES](../../FOCUS-GUIDELINES.md) (checklist 1–9), [FOCUS-WORDING](../../FOCUS-WORDING.md).

| Concept              | File                                 | Smallest useful step                                                                  | Touches                                                                    | Depends on                                                            |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Week review          | [week-review.md](week-review.md)     | one line „Letzte Woche: …“ on top of the „Woche prüfen“ sheet                         | new contribution `weekLine`, todos, timetrack, habits, `WeekCheck.tsx`     | after Wochenende package 6 (hotspot; `NextWidget.tsx` from package 3) |
| Habits as blocks     | [habits.md](habits.md)               | a goal with „Zeit im Plan freihalten: 30 Min“ lowers the free time of its days        | habits `minutes` + migration, `PlannableSource.blocks?`, `planner/days.ts` | Wochenende package 5 (same hotspot `core/modules/types.ts`)           |
| Time tracking ↔ plan | [time-tracking.md](time-tracking.md) | „Zeit erfassen“ on a plan row starts a session that remembers the thing               | timetrack `ref` + migration, planner row ⋯, focus screen                   | W14 stays „not now“ (no auto-enable)                                  |
| Energy               | [energy.md](energy.md)               | a per-thing flag „Braucht Kopf“; such sessions go first in their day, at most 2 a day | planner item flag, `core/plan/engine.ts`                                   | Wochenende packages 4 (day parts) and 6 (Tagesbeginn)                 |

## Measured on the seed (`medium`, today 2026-11-14)

Counted by running each module's `seed()` through `createSeedContext` (throwaway test, not committed).

| Module        | Rows                                                                                              | What the concepts need from it – there today?                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Habits        | 4 goals, 363 entries, 23 rest days, 19 entries in the last 7 days                                 | goals have weekdays and reminders, **no duration**; no `plannable`; event `habits.goal.open` (automation only)                                                      |
| Time tracking | 3 jobs, 2 clients, 58 sessions on 29 weekdays (≈ 5 h 44 a day), last 7 days 10 sessions / 28 h 05 | sessions carry `from`/`note` as free text, **no link** to a ToDo or plan item; bus `timetrack.start.requested { title, sourceRef? }` exists, `sourceRef` is ignored |
| ToDos         | 55 tasks, 43 open, **4 with `estimateMin`**, 10 done in the last 7 days                           | `weekReview()` in `todos/progress.ts` (switch `focus.weekReview`, off on fresh installs) in the „Jetzt dran“ widget                                                 |
| Planner       | 5 day rows (3 h, –, 0, 5 h, 4 h), 4 item rows                                                     | „Woche prüfen“ sheet (`WeekCheck.tsx`), focus round per session (`planner/focus.ts`), blockers = stored + timed calendar items (`days.ts`)                          |
| Energy        | –                                                                                                 | nothing stored anywhere; the nearest inputs are day windows (`PlanDay.window`) and Wochenende packages 4/6                                                          |

Habits, time tracking and the planner are `defaultEnabled: false`: every concept works with them off (it then simply adds nothing).

## Data flow – one pattern for all four

- **Reads** go through lazy manifest contributions (`plannable`, new `weekLine`), collected in `core/modules/contributions.ts`; a module reads only its own tables and formats its own text. The bus has no reply, so it cannot carry a read.
- **Requests and writes into another module** go over the bus (`core/events/events.ts`), as `todo.requested` / `plan.requested` / `timetrack.start.requested` do today. Nothing happens when the receiving module is off.
- No module imports another; `accounts` gets none of this (`exclusion.test.ts`); no new `aiSchema`, no AI sees any of it.

## Questions – decided with the recommended option (orchestrated round, no live stop)

1. **Order:** (a) week review → habits → time tracking (2 packages) → energy **[chosen]** · (b) time tracking first (most data) · (c) energy first.
2. **Time tracking link:** (a) optional internal `ref` (`<module>:<id>`) on a session started from the plan; hints only, never changes an estimate **[chosen]** · (b) match by title text · (c) no link.
3. **Energy:** (a) one flag „Braucht Kopf“ per thing + order/spread rule, no energy diary **[chosen]** · (b) a daily energy check-in · (c) drop the topic.
4. **Habits:** (a) only goals with a set duration block time, nothing tickable or „missed“ in the plan **[chosen]** · (b) every scheduled goal blocks a default · (c) habits as plannable things in the plan.
