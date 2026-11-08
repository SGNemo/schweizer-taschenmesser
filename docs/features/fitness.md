# Fitness (module, concept – phase 1)

Log training (exercises, sets, weight, duration) and calories (meals, kcal, rough). Not a gym coach, not a diet app: calm, rough, honest. Wish: Sven, for a friend who likes "a rough overview". State: **package 1 built (`feat/fitness-1`)**; packages 2–3 open. Rules applied: [FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md), [MODULE-IDENTITY](../design/MODULE-IDENTITY.md) v3.1, [DESIGN-SPEC](../design/DESIGN-SPEC.md) §4a, [new-module](../howto/new-module.md).

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
- **Daily goal kcal** (Sven 2026-11-08): setting `kcalGoal`, empty by default (then only the sum is shown). Two ways to fill it: type the kcal directly, or **"Ausrechnen"** – a small dialog with the formula fields that writes its result into the field (still editable). Optional week goal `weekSessions`.
- **Formula:** Mifflin-St Jeor (the usual estimate for adults) × activity factor. Resting rate = 10 × weight kg + 6.25 × height cm − 5 × age + s, with s = +5 ("männlich"), −161 ("weiblich"), −78 ("keine Angabe", the mean); daily need = resting rate × factor 1.2 (meist sitzend) · 1.375 (leicht aktiv, 1–3 × Sport/Woche) · 1.55 (mäßig, 3–5 ×) · 1.725 (sehr aktiv, 6–7 ×) · 1.9 (körperliche Arbeit + Sport); rounded to 50 kcal. Pure function `goal.ts` with unit tests (reference values, bounds age 18–99, 30–300 kg, 120–230 cm). No deficit/surplus presets ("abnehmen −500" is diet mechanics); the user may change the number. Hint under the result: "Grobe Schätzung, keine medizinische Beratung."
- **Body data is not stored:** the formula fields live only in the open dialog; only the resulting `kcalGoal` is saved (data minimisation; nothing for sync, backup, diagnostics or the assistant). No weight log, no BMI, no weight trend in any package without its own concept: a body-weight trend is the classic source of guilt (focus rules), and health-adjacent data stays minimal.
- Weight in kg with at most one decimal (`weightKg`, not money, no cents rule); `exercises` is one LWW field (two devices editing the same session at the same time: the later list wins – acceptable for a log).
- `manifest.version` 1, `npm run db:bump` once, settings in `modules/fitness/settings.ts` (`module.fitness`: `nutrition` on, `kcalGoal` empty, `weekSessions` empty).

## 5. Capture in seconds

**Quick capture** (`quickCapture/parser` + `targets/adapters.ts`; two new types `meal`, `workout`; word prefixes like `plan:` since the one letters are taken; corpus cases in `parser/corpus.ts`):

| Input                                                                                                                 | Result                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kcal 650 Döner` · `Döner 650 kcal` · `gestern kcal 400 Pizza` (no `essen` prefix: „Essen mit Anna …“ stays an event) | meal: text "Döner", 650 kcal, today/now (date words as usual)                                                                                                                 |
| `650 kcal Döner` without prefix                                                                                       | detected as meal (the unit `kcal` is an unambiguous signal)                                                                                                                   |
| `training Bankdrücken 3×8 60` · `3x8 60kg` · `3 × 8 @ 60 kg`                                                          | exercise Bankdrücken, 3 sets × 8 reps, 60 kg, as **one new session** for today (built: every `training` line is its own session; append to today's session = later, if asked) |
| `training Laufen 30 Min`                                                                                              | exercise Laufen, 30 min (estimate parser)                                                                                                                                     |
| `training Bankdrücken 3×8 60, Kniebeuge 3×5 80`                                                                       | two exercises; `split.ts` keeps a `training` line whole                                                                                                                       |
| `kcal` while "Kalorien erfassen" is off                                                                               | built: still saved (it is an explicit entry) and shown again once the switch is on; the switch hides the view and the widget row                                              |

Built: the fitness parser runs only while Fitness is on (meals only with „Kalorien erfassen“), never over a one-letter prefix, gives way when the text names a time or a day it does not read („19 Uhr“, „morgen“, „Freitag“), needs a real signal after `training` (sets × reps, kg, minutes) and never guesses between two plain numbers. Undo removes the meal or the session. en: `kcal`, `workout`; a day word may come first (`gestern kcal 400 Pizza`). Built: the preview shows a chip per exercise and the kcal.

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

- `aiSchema` minimal: the two actions "Mahlzeit anlegen" (`text`, `kcal`, `date`, `time`) and "Einheit anlegen" (`date`, `title`, `exercises[].name/sets/reps/weightKg`, `durationMin`) with field names only; never entries (pinned by `privacy.test.ts` as for every module). Like every module with an `aiSchema`, a chat thread may attach fitness rows as context only when the user ticks it for that thread and after the text preview (`modules/chat/context.ts`); nothing is sent by itself. 5 inputs in `web/tests/ai/eval-set.json`.
- **`dataApi: false`** (recommended, like `planner`): health-adjacent data stays out of the local API/MCP and the generic JSON import; nothing in package 1 needs it; import comes as an own importer in package 3. `searchable`: no (global search does not need meal texts).
- Seed (`seed.ts`, small|medium|large, deterministic, invented): a few sessions with catalogue exercises and plain meals ("Haferflocken mit Obst · 350 kcal"); no body data, no goal set.
- Diagnostics/bug reports: nothing new (entries are on the negative list anyway). Sync: normal synced collections.

## 9. Focus checklist (to answer in the PR)

1 stimulus: one widget with two rows, no colour states · 2 off switch: module `defaultEnabled: false`, "Kalorien erfassen", goals empty by default · 3 next step: one primary per view, empty state names it · 4 wording: no "zu viel", no "verfehlt", overrun neutral · 5 interruption: entries saved on every change, forms keep drafts · 6 tests: parser corpus, day/week sums, widget, e2e · 7 colour only with meaning (bars in the hue, no state colour) · 8 clicks: "Wie letztes Mal" = 1 tap, quick capture = 1 line · 9 removed instead: nothing existing becomes redundant; a new module, so it ships `maturity: 'preview'` and off by default (situation: the friend's wish, Sven).

## 10. Packages

| Package | Branch           | Content                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1       | `feat/fitness-1` | module `fitness` (`preview`, off by default): two collections, page with two views, forms, "Wie letztes Mal", suggestions, widget, head, identity + `dumbbell` mark, seed, settings (kcal goal + "Ausrechnen" dialog, `goal.ts`), quick capture `kcal`/`training` + corpus, `calendarItems`, `aiSchema` + eval, a11y, e2e (session → widget → calendar; `kcal` prefix → day sum), strings de/en, `.changes/` DE+EN |
| 2       | `feat/fitness-2` | week view, templates ("Oberkörper", "Laufen"), planned sessions + `plannable` + user reminders (`attention`)                                                                                                                                                                                                                                                                                                       |
| 3       | `feat/fitness-3` | CSV import (e.g. from another training/food app) as an onboarding importer                                                                                                                                                                                                                                                                                                                                         |

Not planned: body data, weight trend, step counter, external food databases, special sync/export paths, Android widget.

## Questions to Sven (answered 2026-11-08)

1. One module `fitness` or two? – answered: one.
2. Optional daily kcal goal? – answered: yes, typed directly or calculated (Mifflin-St Jeor × activity, inputs not stored).
3. Area? – answered: Haushalt.
4. Macros in package 1? – answered: optional fields behind "Erweitert", not in the widget.
