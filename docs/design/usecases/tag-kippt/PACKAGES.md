# Use case „Tag kippt“ – packages left

Built in this round (2026-11-23): „Plan einfügen“ (T4: 12 → 3 handles, 11 → 0 duplicates) and „Nur das hier …“ with „Nächste Wochen“ and the start line (T1: 9 → 8 handles, 4 → 0 per thing; T2: 31 → 21, 23 → 0). Figures and friction: [ANALYSIS](ANALYSIS.md), target: [TARGET](TARGET.md). Left open in `TARGET`: T1 `smallerInOneMove` (P1). Each prompt below is complete; run them in this order, each in its own chat, branch and PR.

| Package                          | Gains                                                                      | Needs Sven                     |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| [P1 Kleiner machen](#p1)         | T1 „Pfand sammeln heute, wegbringen später“ in one move (K05)              | no                             |
| [P2 Ziel-Zeile](#p2)             | a calm goal head for the weekend                                           | no                             |
| [P3 Plan als Text kopieren](#p3) | the round trip to a chat without retyping                                  | **yes** – TARGET §5 question 1 |
| [P4 Kleinkram](#p4)              | K11 checkbox names, K13 board menu, the sentence „heute nur …“ as an alias | no                             |

Folding the list behind the start line (TARGET §4) is **not** a package: measure first with P1 in place; only if he still reports the list as the problem, write it.

---

## P1

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Opus · unattended

# „Kleiner machen …“ on a planner row (use case „Tag kippt“, package P1)

Branch `feat/kleiner-machen` from fresh `develop`. Read CLAUDE.md, docs/design/usecases/tag-kippt/{ANALYSIS,TARGET}.md (K05, §4), docs/decisions/plan-rethink.md (last three bullets), FOCUS-GUIDELINES.md, FOCUS-WORDING.md, `web/src/modules/planner/{actions.ts,components/rowMenu.ts,components/RowChoice.tsx}`, `web/src/modules/todos/plannable.ts`, `web/src/core/modules/types.ts` (`PlannableSource`). Start with `npm run chats:status`.

**Goal:** one move turns „Pfand wegbringen“ on today into „Pfand sammeln“ (today, same row, same lock) plus „Pfand wegbringen“ as its own thing for „Diese Woche, ohne Tag“ (default) or „Nächste Wochen“.

- Row ⋯ → „Kleiner machen …“ (under the day steps, after „Dauer …“; only for sources that have the new step). Sheet: field „Heute nur:“ (prefilled empty, placeholder = the title), the choice „Der Rest: Diese Woche, ohne Tag · Nächste Wochen“, button „Kleiner machen“. Enter submits.
- New optional source step `onSplitOff(id, todayTitle): Promise<string /* new id */>` in `PlannableSource` (hotspot `core/modules/types.ts`: heads-up row first). ToDos: the existing task keeps its id, gets `todayTitle`; a new task with the old title, same list, estimate and links, no date. The planner never edits a ToDo title itself.
- One `act(...)`, one undo (both ToDos, the row, someday). Toast: „Heute nur: Pfand sammeln · Rest: diese Woche“. No counter, no „nur noch“.
- `tag-kippt.spec.ts` T1: `smallerInOneMove` becomes `ja` (the script already looks for the menu item „Kleiner machen …“); move `IST` there, never loosen.
- Tests: unit (one undo restores both titles and the row; lock stays; source without the step → not offered), the e2e above, `privacy.test.ts` untouched.
- Words via `design:ux-copy`, the sheet via `design:accessibility-review`. `review loop`, then `file-pr`, `babysit-pr`. Change note de+en. Full stop.

**Handoff (`design:design-handoff`):** sheet = `Dialog` with `TextField` (label „Heute nur“), `Segmented` (two values, default „Diese Woche, ohne Tag“), primary `Button`. States: empty field → button off; same text as the title → button off with the hint „Das ist schon der ganze Schritt.“; error → the planner's calm line. Phone: bottom sheet, field autofocus. Touch ≥ 44 px.

---

## P2

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Opus · unattended

# A goal line for days („Wohnung frei bekommen“) (use case „Tag kippt“, package P2)

Branch `feat/plan-ziel` from fresh `develop`. Read CLAUDE.md, docs/design/usecases/tag-kippt/TARGET.md §4, `web/src/modules/planner/{schema.ts (daySchema.note),pastePlan.ts,components/DayPage.tsx,components/DaySheet.tsx}`, FOCUS-GUIDELINES.md, FOCUS-WORDING.md. Start with `npm run chats:status`.

**Goal:** a quiet head line on the sheet of the days it covers: „Ziel: Wohnung frei bekommen“ – no progress figure, no bar, no colour.

- Store as the day's existing `note` on each covered day (no new collection, no `db:bump`); the sheet shows it above the start line. Edit and remove in „Tag einstellen“ (DaySheet).
- „Plan einfügen“ fills it: a line „Ziel …: X“ (today skipped by `GOAL_RE` in `pastePlan.ts`) becomes `goal` on the parsed plan; the preview shows it as a ticked first line „Ziel: X · Sa, So“; „Übernehmen“ writes it into the same undo entry.
- An off switch is not needed (it only shows what he wrote); it must not show on the widget or in the calendar chip.
- Tests: parser (goal read, not a thing), one undo includes the notes, the line renders; `tag-kippt.spec.ts` T2 may add `goalShown` (`IST`/`TARGET`).
- `review loop`, `file-pr`, `babysit-pr`. Change note de+en. Full stop.

---

## P3

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Opus · unattended

# „Plan als Text kopieren“ (use case „Tag kippt“, package P3) – only after Sven's answer

**Stop first:** run only when docs/design/usecases/tag-kippt/TARGET.md §5 question 1 is answered „ja“ (see `docs/decisions/plan-rethink.md`). Otherwise end the chat with one line.

Branch `feat/plan-kopieren` from fresh `develop`. Read CLAUDE.md (AI privacy, planner `dataApi: false`), docs/decisions/plan-contract.md (AI layer bullet), `web/src/modules/planner/{pastePlan.ts,routes/PlannerPage.tsx}`, `web/src/core/platform` (clipboard). Start with `npm run chats:status`.

- Page ⋯ → „Plan als Text kopieren“: the days from today to the last laid day plus „Noch ohne Tag“ and „Nächste Wochen“, in exactly the format „Plan einfügen“ reads (heading per day „Sa 28.11.“, `- title (30 Min)`), titles only – no notes, links, blocker labels or ids. Clipboard through `getPlatform()`; toast „Plan kopiert.“ Nothing else leaves the device; no share target, no model.
- Round-trip test: `readPastedPlan(copy(plan))` gives the same places for every thing; a privacy test pins the fields that may appear.
- `council` (Guardian lens on what leaves the device), `file-pr`, `babysit-pr`. Change note de+en. Full stop.

---

## P4

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Opus · unattended

# Small things from „Tag kippt“ (package P4)

Branch `fix/tag-kippt-kleinkram` from fresh `develop`. Read docs/design/usecases/tag-kippt/ANALYSIS.md (K11, K13), `web/src/ui/Patterns.tsx` (ItemRow `selectable`), `web/src/modules/planner/components/ThingRow.tsx`, `web/src/modules/todos/components/BoardView.tsx`, `web/src/modules/planner/say.ts` + `web/src/core/plan/instructions.ts`. Start with `npm run chats:status`.

1. **K11:** the selection box of a planner row says „„Pfand wegbringen“ auswählen“ (ItemRow gets an optional `selectLabel`; ThingRow passes its title). Update the measuring script's `checkOf` to the plain name.
2. **K13:** a ToDos board card's ⋯ menu lies above the next card (stacking context of the card); remove the `dispatchEvent` workaround in `tag-kippt.spec.ts` `laterInTodos`.
3. **Sentence alias:** „heute nur A, B, C“ / „nur A und B heute“ in the planner's field opens „Nur das hier …“ with A, B, C ticked (names matched as `instructionItems` does); never applies without the „Der Rest“ choice. Optional – drop it if the matching is not reliable on the seed (say so in the PR).

- One PR, three commits. `review loop`, `file-pr`, `babysit-pr`. Change note de+en (1, 3). Full stop.
