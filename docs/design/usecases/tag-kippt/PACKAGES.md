# Use case „Tag kippt“ – packages left

Built in this round (2026-11-23): „Plan einfügen“ (T4: 12 → 3 handles, 11 → 0 duplicates) and „Nur das hier …“ with „Nächste Wochen“ and the start line (T1: 9 → 8 handles, 4 → 0 per thing; T2: 31 → 21, 23 → 0). Figures and friction: [ANALYSIS](ANALYSIS.md), target: [TARGET](TARGET.md). P1 „Kleiner machen …“ and P2 (goal line) are built too (T1 `smallerInOneMove`: 4 handles); every `TARGET` figure is reached. Each prompt below is complete; run them in this order, each in its own chat, branch and PR.

| Package                          | Gains                                                                      | Needs Sven                     |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------ |
| [P3 Plan als Text kopieren](#p3) | the round trip to a chat without retyping                                  | **yes** – TARGET §5 question 1 |
| [P4 Kleinkram](#p4)              | K11 checkbox names, K13 board menu, the sentence „heute nur …“ as an alias | no                             |

Folding the list behind the start line (TARGET §4) is **not** a package: measure first now that P1 is in place; only if he still reports the list as the problem, write it.

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
