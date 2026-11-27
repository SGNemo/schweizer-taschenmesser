# Handoff 5 – ToDos: the lake

Module page: [modules/todos](../modules/todos.md). Drawing: `mockups/world.js` `lake`. Gallery: `mockups/p3-todos.html`. Words: [COPY §2](../COPY.md).

- `ui/scene/spots/lake.ts` (span `[1000, 1346]`, seven boat places, seven star places, lanterns and mirrors, the star figure) + tokens.
- `modules/todos/picture.ts` `lakeVars()` from `doneToday` (`modules/todos/next.ts`), capped at 7.
- Widget `todos:open`: `picture: { step: 2, spot: 'lake' }`; summary's third part; fallback sign: today card with 0–3 ticks.
- Stars only when the shared sky is dark, cover < 3, nothing falling, no fog; lanterns at golden hour, dusk and night.
- Edge cases: un-ticking (the boat leaves without animation – an undo is the user's act, not a loss); sub-tasks count as `doneToday` counts them; midnight; `todos:next` gets no picture.
