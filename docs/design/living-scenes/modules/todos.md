# Living scenes – ToDos: the lake (step 2)

Mockup: `mockups/p3-todos.html`; drawing: `mockups/world.js` `lake` (spot `lake`: the lake below the massif). From the stop: "Sternbilder … bei ToDo mit Abhaken".

## Variables (`modules/todos/picture.ts` `lakeVars(todos, day)`)

| Datum | Source | In the picture |
| --- | --- | --- |
| things ticked today | `doneToday` of `modules/todos/next.ts` (ToDos with `completedAt` today) | one sailing boat per thing, at fixed places on the lake, at most 7 (the text names the full number) |
| the same number, at golden hour, dusk, night | shared sky phase | every boat carries a lantern, mirrored in the water |
| the same number, under a night sky that shows stars (cover < 3, nothing falling, no fog) | shared sky | as many stars over the lake, joined star by star to one figure; seven complete it |
| nothing ticked yet | 0 | the still lake with the rowing boat at the jetty (the weather's own picture) |

`LakeVars = { done: 0…7 }`. A new day starts with the still lake – nothing is taken away while one looks: the count changes at midnight with the date.

## Card on the overview ("Offene ToDos")

The list stays. The summary gains its third part when something was ticked: "43 offen · 8 warten · 2 heute erledigt" (no third part at 0). Picture: right 44 % / strip 112 px. Fallback sign: the today card with up to three ticks. Ticking a row lets a boat (and at night its star) fade in.

The card "Heute" (`todos:next`) keeps no picture: it is the one next thing, and the planner's way will stand there ([planner](planner.md)).

## Module page

No picture on the list page (a long list is work, not a view); the tab or block that shows "Erledigt heute" may carry the strip (120 px) – only if that block exists when the package is built; otherwise the page is unchanged.

## States

leer (0) · wenig (1) · normal (2) · viel (7, text "12 heute erledigt") · besonders (clear night, 7: the whole figure); the same data under day, golden hour, dusk, clear night, overcast night, rain.

## Deliberately not shown

What is open, waiting, overdue or planned – no boat missing, no empty slot, no figure "to complete" by day (the outline of the figure is never drawn ahead). More than seven: the eighth changes nothing in the picture, so the picture never becomes a counter to push.
