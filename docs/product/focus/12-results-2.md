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

## Package 2b – ToDo page (`feat/focus2-todos`)
Same tool and data as 2a (`img/before2-*` = state before 2b, `img/after2b-*`). Honest reading: the first screen is calmer, the whole page is not shorter, because the waiting group now shows a move button per row.

| Metric (ToDos) | Before 2b | After 2b |
|---|---|---|
| Phone, actions on the first screen | 44 | **37** |
| Desktop, actions on the first screen | 74 | **50** |
| Phone, page height | 3382 px | 3601 px |
| Phone, buttons / links / icons | 108 / 10 / 60 | 107 / 10 / 58 |
| Phone, elements counted under 44 px | 47 | 55 (8 "Auf heute" buttons look 32 px and keep a 44 px hit area) |

- Above the first task: add field + one "⋯" (list filter, "Neue Liste", "Erweitert", "Mit KI eintragen"); no chips, no round "+" button, no separate "Wartet noch" card.
- Tests: `ui/rowMenuChecked.test.tsx`, `core/shell/pageChrome.test.tsx`, `e2e/todos-calm.spec.ts` (desktop + pixel-7); specs that used the chips, the "Erweitert" switch or the AI button now go through the menu (`openTodosMenu`, `pickTodosList` in `e2e/helpers.ts`).
- Not done (package 3): snooze on every row, not only the waiting ones; other pages with an add field keep the round button.

## Package 3 – "Später" on rows, one feedback line, 44 px (`feat/focus2-reminders`)
Tool: `web/e2e/screenshots/targets-focus.spec.ts` (phone 412×915, ten pages, seeded medium data; lists every button/link under 44 px except the controls that carry a 44 px hit area on purpose: icon/small buttons, switch tracks, chips, segment strips, calendar day numbers). Raw lists: `img/targets-before.json`, `img/targets-after.json`.

| Metric (phone, ten pages) | Before | After |
|---|---|---|
| Real gaps under 44 px (logo link ×10, skip link ×10, short tab links ×3, calendar day numbers ×35) | 58 | **0** |

- "Später" (out of today, always "tomorrow", with the toast and undo) is now one rule (`todos/postpone.ts`) used by the Heute card, the row menu (first entry) and the swipe-left of every open ToDo row. A task that is due today also moves its date, and it is not suggested again today (before, a due-today task came straight back on the card).
- Feedback: adding a ToDo and planning one for today now answer with one line and "Rückgängig" (the other actions already did).
- Tests: `todos/postpone.test.ts`, `nextWidget.test.tsx` (due today + Später), `e2e/todos-calm.spec.ts` (Später in the menu, with date, undo), `e2e/targets.spec.ts` (pixel-7, seven pages).
- Notification limits together: `core/notifications/limits.test.ts` (11 cases, no product change), see [repeat-reminders](../../features/repeat-reminders.md#grenzen-im-zusammenspiel).

## Darstellung – grouped (`feat/settings-appearance-fold`)
Same tool, same seeded Dev build; baseline = `develop` after package 1. Screenshots: `img/before-appearance-phone.png`, `img/after-appearance-phone.png`.

| Metric (Settings → Darstellung, phone 412×915) | Before | After |
|---|---|---|
| Page height | 6945 px (audit) / 5831 px (after package 1) | **4424 px** |
| "Darstellung" card | eleven rows, about 1660 px | five lines (Thema, Farben, Schrift & Lesen, Bewegung, Sonstiges), about 255 px |
| Actions on the first screen | 20 | 38 (five "Ändern" lines instead of long pickers; the count includes the page header) |
| Stored settings | 77 / 27 | unchanged (no key removed, no default changed) |

- Each group is one line with the current choice ("Thema: Hell · Ändern"); "Ändern" opens the pickers, "Fertig" closes. Deep links (`#appearance--density`, search, palette) open the surrounding group.
- The remaining height is the other sections of the category (Lesen, Fokus & Aufmerksamkeit, Wetter, …), which this package does not touch; a further cut needs the same treatment there.
- Tests: `AppearanceSection.test.tsx` (current choice shown, "Ändern" opens, all eleven fields stay in a group), `e2e/comfort-settings.spec.ts` (switch the theme through the group, keyboard, deep link opens the group; desktop + pixel-7); the specs that click an appearance control open its group first (`openAppearanceGroup`).

## Darstellung – the rest folded (`feat/focus2-settings-fold-2`, round 4)
Same tool and seeded Dev build; baseline = `develop` after #215–#219. Screenshots: `img/before-display-rest-phone.png`, `img/after-display-rest-phone.png`.

| Metric (Settings → Darstellung, phone 412×915) | Before | After |
|---|---|---|
| Page height | 4424 px | **1787 px** |
| Lesen | 5 rows incl. preview, about 900 px | one line ("Lesehilfe: Aus") |
| Fokus & Aufmerksamkeit | 6 switches + 1 folded block | two lines ("Hilfen: 6 von 6 an", "Weitere Einstellungen: Tagesplan 3 · Timer 25 Min · 2 von 6 an") |
| Favoriten | one switch per module | one line with the chosen modules |
| Stored settings | unchanged | unchanged (no key removed, no default changed) |

- "Basis oder Erweitert" stays as it is: one switch, a fold would add a step for nothing. The script's counts of buttons/links do not change (it counts the controls inside closed groups as well); the page is what gets shorter.
- Tests: `ReadingSection.test.tsx`, `FocusSection.test.tsx` (closed lines with the right counts, every row inside its group, the line follows a change); the specs that click a reading, focus or favourite switch open its group first (`openFoldedGroup` in `e2e/helpers.ts`), none removed or weakened.

## Benachrichtigungen – Ruhige Erinnerungen folded (`feat/focus2-reminders-fold`, round 4)
Same tool and seeded Dev build; baseline = `develop` after #222. No screenshots: the first phone screen (permission card, Zock-Modus) is the same before and after.

| Metric (Settings → Benachrichtigungen, phone 412×915) | Before | After |
|---|---|---|
| Page height | 3003 px | **1893 px** |
| Ruhige Erinnerungen | 6 switches, 4 sub-rows open by default | six lines ("Karte in der App: Aus", "Ruhezeit: 22:00–07:00", "Höchstens pro Stunde: 3", "Gestaffelte Erinnerung: Aus", "Ruhig wiederholen: 30 min · 6×", "ToDos am Morgen: 09:00") |
| Stored settings | unchanged | unchanged (no key removed, no default changed) |

- The permission card and Zock-Modus above it are not touched (different pattern: cards with a heading, not setting rows).
- Tests: `CalmRemindersSection.test.tsx` (six closed lines with the defaults, every row inside its group, the line follows a change); `e2e/reminders.spec.ts` opens the groups first (`openFoldedGroup`), none removed or weakened.
