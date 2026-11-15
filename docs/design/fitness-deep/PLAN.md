# Fitness – „Tiefe & Politur“ (round 2026-11-tiefe)

Wish (Sven): „Gym braucht mehr Tiefe.“ Base: packages 1–5 ([features/fitness.md](../../features/fitness.md)). Rules: [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md), [MODULE-IDENTITY](../MODULE-IDENTITY.md) v3.1, [DESIGN-SPEC](../DESIGN-SPEC.md) §4a.

## Ist

- A session = date, optional title/duration/note, exercises as one summary each (sets × reps · kg or minutes); plans, templates, catalogue (40 exercises, 8 groups), week view as text, planner and calendar links.
- Missing for the gym: what did I lift last time and is it going up; per-set detail (warm-up, notes, supersets); a guided session with a rest timer; a weekly split.

## Ziel

Calm depth: everything optional, nothing counts against the user. No streaks, no reproach, no body data beyond what is typed explicitly, nothing new for the AI cloud (`aiSchema` unchanged).

## Pakete (stacked: each branch starts from the one before; each PR is mergeable on its own in order)

| Package | Branch                  | Content                                                                                                                                                                                                                                  | Data                                                   |
| ------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| p1      | `feat/fitness-deep-p1` | view „Übungen“: every exercise by muscle group with search, last values, personal best, history per exercise; catalogue search; „Letztes Mal“ under each exercise in the form; sets per muscle group in the week view (text)              | none                                                   |
| p2      | `feat/fitness-deep-p2` | per-set log (reps, kg, warm-up, note), supersets; „Einheit starten“: one exercise at a time, „Satz fertig“, rest timer (setting, soft end, off switch); session saved after every set                                                      | `exercise.log?`, `exercise.superset?`; manifest v3     |
| p3      | `feat/fitness-deep-p3` | training plan: weekdays on templates, three plan presets (Ganzkörper 2×, Ober-/Unterkörper 4×, Drücken/Ziehen/Beine 3×), „Heute laut Plan“ with „Anfangen“, plan days in the planner (virtual, nothing written until done)           | `template.weekdays?`; manifest v4                       |
| p4      | `feat/fitness-deep-p4` | charts from `@/ui/charts`: `Trend` per exercise (heaviest weight), `Bars` sets per muscle group, `Bars` kcal per day of the week                                                                                                          | none; waits for `feat/ui-charts`                       |

## Reihenfolge

p1 → p2 → p3 → p4 (p4 only once `@/ui/charts` is on `develop`; until then the numbers stay text in p1).

## Nicht geplant

Body weight, body measurements, 1RM formulas, streaks, badges, sound alarms, an exercise database from the network, AI coaching.
