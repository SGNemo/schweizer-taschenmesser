# Handoff 8 – Planer: the way (after planner hub 2)

Module page: [modules/planner](../modules/planner.md). Drawing: `mockups/world.js` `way` (a sketch: sizes are final, the data mapping is not).

Start only when planner hub 2's last package is merged. First step of the package: read hub 2's "as built" (`docs/design/planner-hub-2/`, `docs/decisions/plan-hub-2.md`), fill the "Source" column of the variables table with the then-current functions, and write the result into this file's "as built" before coding.

- `ui/scene/spots/way.ts` (span `[846, 1010]`, the way, posts, flags, walker, lantern) + tokens.
- `modules/planner/picture.ts` `wayVars()`.
- Card `todos:next` "Heute": the planner contributes the picture through the widget contract; if the card stays owned by ToDos, the variables come over the existing plan contribution, never an import.
- Edge cases: no thing with a time; more than eight; a thing before the day begins or after it ends (clamped to the way's ends); now outside the day (no walker); day end before day begin (night shift: the way runs across midnight – `at` is computed on the span, not on the clock).
