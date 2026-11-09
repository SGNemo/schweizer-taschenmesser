# Uhr – prompts for the next packages

Concept and state: [features/clock.md](../../features/clock.md). One branch and one PR per prompt; 02–04 start with a decision phase (stop, ≤ 4 questions with a recommendation). Order: 01 any time; 02–04 independent of each other, each after 01 is merged (shared files `modules/clock/*`).

| File                                           | Branch                       | Kind                       |
| ---------------------------------------------- | ---------------------------- | -------------------------- |
| [01-followups.md](01-followups.md)             | `fix/clock-followups`        | small fix, no stop         |
| [02-alarm-timer.md](02-alarm-timer.md)         | `feat/clock-alarm`           | decision → build           |
| [03-meeting-planner.md](03-meeting-planner.md) | `feat/clock-meeting-planner` | decision → build           |
| [04-weather.md](04-weather.md)                 | `feat/clock-weather`         | decision → build (network) |

The prompts are German, like the other prompt files; paste one as the first message of a new chat.
