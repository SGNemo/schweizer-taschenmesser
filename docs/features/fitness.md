# Fitness (module, concept – phase 1)

Log training (exercises, sets, weight, duration) and calories (meals, kcal, rough). Not a gym coach, not a diet app: calm, rough, honest. Wish: Sven, for a friend who likes "a rough overview". State: **concept, waiting for "Plan freigegeben"**. Rules applied: [FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md), [MODULE-IDENTITY](../design/MODULE-IDENTITY.md) v3.1, [DESIGN-SPEC](../design/DESIGN-SPEC.md) §4a, [new-module](../howto/new-module.md).

## 1. One module or two – recommendation: **one module `fitness`**

|             | One `fitness` (Training + Essen as two views)                                    | Two (`training`, `nutrition`)                                                             |
| ----------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Overview    | one widget, two rows: week training + today kcal = the "rough overview"          | two widgets, two library cards, two sidebar entries                                       |
| Area        | Haushalt grows 2 → 3 modules                                                     | 2 → 4; two more neighbour/head constraints                                                |
| Off switch  | setting "Kalorien erfassen" hides the whole kcal part (view, widget row, prefix) | switch the module off                                                                     |
| Boundaries  | both are "what I did with my body today", same day logic, same settings page     | clean, but the shared day/week code would be duplicated (modules never import each other) |
| Later split | possible: collections are already separate (`fitness_session`, `fitness_meal`)   | –                                                                                         |

Why one: the widget rule (one widget per module, "only what matters today") fits one card with two progress rows; one place to look; less navigation for a person who wants the gist. Kcal stays strictly optional (switch, default on because it is part of the wish; goal empty by default).

## 2. Area – recommendation: **Haushalt** (`household`)

- Haushalt holds only Listen and Vorräte; food already lives there (Vorräte). Planen has 8 modules (habits, timetrack sit there) – too full.
- A new area "Körper" means a new `AREAS` id, pattern, labels, sidebar block, library section, site catalogue and tests – for one module. Only worth it with a second body-related module; then move `fitness` with one manifest line.

## 3. Identity (v3.1, neighbour rule)

| Field              | Value                                                  | Check                                                                                                                                                            |
| ------------------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hue` / `hue2`     | `sky` / `ocean`                                        | Haushalt uses orchid (Listen), fern (Vorräte); sky elsewhere: Kalender (zeit/zeitleiste), Chat (fokus/notiz) → no shared head+widget                             |
| `head`             | `fortschritt` (figure "3 Einheiten diese Woche", bars) | neighbours: Listen `kennzahl`, Vorräte `regal` – differs                                                                                                         |
| `widget`           | `fortschritt` (`FortschrittBody kind="bars"`)          | –                                                                                                                                                                |
| `signature`        | new mark `dumbbell` (mark only, no block)              | new id in `SIGNATURES` (`core/modules/types.ts`, hotspot → heads-up row) + `SignatureMark`; fallback without contract change: `weekBars` is the planner's, so no |
| `layout` / `order` | `content` (default) / 98 (after Vorräte 95)            | –                                                                                                                                                                |

## 4. Data model (envelope `id, createdAt, updatedAt, deviceId, deletedAt, _f`; write only via `createRepo`)

| Table                       | Fields                                                                                                                                                             | Indexes |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `fitness_session` (Einheit) | `date` YYYY-MM-DD · `time?` HH:mm · `title?` ("Oberkörper") · `durationMin?` int · `exercises: { name, sets?, reps?, weightKg?, durationMin? }[]` (≤ 30) · `note?` | `date`  |
| `fitness_meal` (Mahlzeit)   | `date` · `time?` HH:mm · `text` · `kcal` int 0–9 999 · `proteinG?` `carbsG?` `fatG?` int (form: "Erweitert")                                                       | `date`  |

- **Exercise catalogue = no table.** A built-in starter list (≈ 12 names, `strings.ts` de/en: Bankdrücken, Kniebeuge, Kreuzheben, Rudern, Schulterdrücken, Klimmzüge, Liegestütze, Plank, Laufen, Radfahren, Schwimmen, Dehnen) plus every name from own sessions = suggestions. "Erweiterbar" by just typing a new name. Rename/archive later if asked.
- **Food memory = no table.** Suggestions from own meals (text → last kcal, most recent first, local only). No external database, no network.
- **Daily goal kcal:** setting `kcalGoal` (empty = no goal, then only the sum is shown). Optional week goal `weekSessions`. Both set by the user, **never computed** from body data.
- **No weight/BMI/body data in package 1** (also not later without its own concept): a trend of body weight is the classic source of guilt and shame (focus rules: no guilt text, no counters against you); data minimisation for health-adjacent data; a computed kcal target would need body data.
- Weight in kg with at most one decimal (`weightKg`, not money, no cents rule); `exercises` is one LWW field (two devices editing the same session at the same time: the later list wins – acceptable for a log).
- `manifest.version` 1, `npm run db:bump` once, settings in `modules/fitness/settings.ts` (`module.fitness`: `nutrition` on, `kcalGoal` empty, `weekSessions` empty).

## 5. Capture in seconds

**Quick capture** (`quickCapture/parser` + `targets/adapters.ts`; two new types `meal`, `workout`; word prefixes like `plan:` since the one letters are taken; corpus cases in `parser/corpus.ts`):

| Input                                                          | Result                                                                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `kcal 650 Döner` · `Döner 650 kcal` · `gestern kcal 400 Pizza` | meal: text "Döner", 650 kcal, today/now (date words as usual)                                |
| `650 kcal Döner` without prefix                                | detected as meal (the unit `kcal` is an unambiguous signal)                                  |
| `training Bankdrücken 3×8 60` · `3x8 60kg` · `3 × 8 @ 60 kg`   | exercise Bankdrücken, 3 sets × 8 reps, 60 kg, added to **today's session** (created if none) |
| `training Laufen 30 Min`                                       | exercise Laufen, 30 min (estimate parser)                                                    |
| `training Bankdrücken 3×8 60, Kniebeuge 3×5 80`                | two exercises; `split.ts` keeps a `training` line whole                                      |
| `kcal` while "Kalorien erfassen" is off                        | not offered as a type; text stays a ToDo                                                     |

Undo removes the meal / restores the session's previous exercise list. en: `kcal`, `workout`. The prefixes appear in Settings → Schnellerfassung like the others.

**In the module:** primary action per view ("Einheit eintragen" / "Mahlzeit eintragen"); **"Wie letztes Mal"** = one tap copies the last session to today (toast with "Rückgängig", then editable); the meal field suggests own foods with their kcal ("Döner · 650 kcal"); the exercise field suggests catalogue + own names, sets/reps/weight prefilled from the last time.

## 6. Display

- **Page:** `PageHeader` with two views (Training · Essen), lists grouped by day (`GroupedList`: Heute, Gestern, dates). Head figure: "3 Einheiten diese Woche · 2 h 10". Empty: "Noch nichts eingetragen. Eine Einheit reicht." with one action.
- **Widget** (`FortschrittBody kind="bars"`, title "Fitness", s/m/l): row 1 "Diese Woche · 3 Einheiten · 2 h 10" (bar only with a week goal, else count); row 2 "Heute · 1 450 kcal von 2 200" (no goal: "Heute · 1 450 kcal"). **Over the goal: neutral text "2 450 kcal · Ziel 2 200", bar full, never `overText` (that is danger red).** No "noch 750 übrig" (diet mechanic). Empty: "Noch nichts diese Woche" + "Einheit eintragen".
- **Week view (package 2):** seven days, sessions and kcal per day as plain numbers; no averages against a goal, no colours for "good/bad days".
- **Never:** streaks, "Ziel verfehlt", red for eating, comparisons with last week as a judgement, badges, motivational pushes.

## 7. Links to other modules

| Contract        | Package                            | What                                                                                                                                                  |
| --------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `calendarItems` | 1                                  | logged sessions as all-day items (time if set), kind `fitness`, `done: true` → never a planner blocker; meals **not** in the calendar (noise)         |
| `plannable`     | 2                                  | planned session ("Training · 60 Min") as a planner item with `durationMin`; `onAssign` sets the planned date, `onDone` turns it into a logged session |
| `attention`     | 2                                  | only for a reminder the user set on a planned session ("Gleich: Training"); never "heute noch nicht trainiert"                                        |
| `onboarding`    | 1: `noOnboarding`; 3: CSV importer | –                                                                                                                                                     |
| `headline`      | 1                                  | the head figure above                                                                                                                                 |

## 8. Privacy

- `aiSchema` minimal: the two actions "Mahlzeit anlegen" (`text`, `kcal`, `date`, `time`) and "Einheit anlegen" (`date`, `title`, `exercises[].name/sets/reps/weightKg`, `durationMin`) with field names only; never entries (pinned by `privacy.test.ts` as for every module). 5 inputs in `web/tests/ai/eval-set.json`.
- **`dataApi: false`** (recommended, like `planner`): health-adjacent data stays out of the local API/MCP and the generic JSON import; nothing in package 1 needs it; import comes as an own importer in package 3. `searchable`: no (global search does not need meal texts).
- Seed (`seed.ts`, small|medium|large, deterministic, invented): a few sessions with catalogue exercises and plain meals ("Haferflocken mit Obst · 350 kcal"); no body data, no goal set.
- Diagnostics/bug reports: nothing new (entries are on the negative list anyway). Sync: normal synced collections.

## 9. Focus checklist (to answer in the PR)

1 stimulus: one widget with two rows, no colour states · 2 off switch: module `defaultEnabled: false`, "Kalorien erfassen", goals empty by default · 3 next step: one primary per view, empty state names it · 4 wording: no "zu viel", no "verfehlt", overrun neutral · 5 interruption: entries saved on every change, forms keep drafts · 6 tests: parser corpus, day/week sums, widget, e2e · 7 colour only with meaning (bars in the hue, no state colour) · 8 clicks: "Wie letztes Mal" = 1 tap, quick capture = 1 line · 9 removed instead: nothing existing becomes redundant; a new module, so it ships `maturity: 'preview'` and off by default (situation: the friend's wish, Sven).

## 10. Packages

| Package | Branch           | Content                                                                                                                                                                                                                                                                                                                                                               |
| ------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1       | `feat/fitness-1` | module `fitness` (`preview`, off by default): two collections, page with two views, forms, "Wie letztes Mal", suggestions, widget, head, identity + `dumbbell` mark, seed, settings, quick capture `kcal`/`training` + corpus, `calendarItems`, `aiSchema` + eval, a11y, e2e (session → widget → calendar; `kcal` prefix → day sum), strings de/en, `.changes/` DE+EN |
| 2       | `feat/fitness-2` | week view, templates ("Oberkörper", "Laufen"), planned sessions + `plannable` + user reminders (`attention`)                                                                                                                                                                                                                                                          |
| 3       | `feat/fitness-3` | CSV import (e.g. from another training/food app) as an onboarding importer                                                                                                                                                                                                                                                                                            |

Not planned: body data, weight trend, step counter, external food databases, special sync/export paths, Android widget.

## Open questions (to Sven)

1. One module `fitness` or two? – recommendation: one.
2. Optional daily kcal goal? – recommendation: yes, empty by default, only ever set by the user.
3. Area? – recommendation: Haushalt (new area only with a second body module).
4. Macros (protein/carbs/fat) in package 1? – recommendation: optional fields behind "Erweitert", not in the widget.
