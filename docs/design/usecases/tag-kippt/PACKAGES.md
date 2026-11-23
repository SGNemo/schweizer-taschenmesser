# Use case „Tag kippt“ – packages left

Built in this round (2026-11-23): „Plan einfügen“ (T4: 12 → 3 handles, 11 → 0 duplicates) and „Nur das hier …“ with „Nächste Wochen“ and the start line (T1: 9 → 8 handles, 4 → 0 per thing; T2: 31 → 21, 23 → 0). Figures and friction: [ANALYSIS](ANALYSIS.md), target: [TARGET](TARGET.md). P1 „Kleiner machen …“, P2 (goal line) and P3 (copy the plan as text, answered „ja“ 2026-11-23) are built too (T1 `smallerInOneMove`: 4 handles); every `TARGET` figure is reached. Each prompt below is complete; run them in this order, each in its own chat, branch and PR.

| Package             | Gains                                                                      | Needs Sven |
| ------------------- | -------------------------------------------------------------------------- | ---------- |
| [P4 Kleinkram](#p4) | K11 checkbox names, K13 board menu, the sentence „heute nur …“ as an alias | no         |

Folding the list behind the start line (TARGET §4) is **not** a package: measure first now that P1 is in place; only if he still reports the list as the problem, write it.

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
