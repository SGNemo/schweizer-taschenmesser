# Living scenes – modules and the overview show their state as picture and colour

Brief (maintainer, 2026-11-27): "Wetter gefällt mir mittlerweile sehr gut … Ich will mehr davon in der App: mehr Variablen, die sich aufgrund des Standes aus dem Modul verändern. Mehr Verspieltheit wie beim Wetter, ohne Daten und Infos zu verlieren. Gerade im Überblick fehlt mir Farbe und Abwechslung. Nicht zu viel bei Info-Modulen, aber andere können verspielter sein." Design round only – **nothing here is product code.** The drawing language is the weather's ([weather-scenes-2](../weather-scenes-2/README.md), direction B "Facetten").

**State: phase 2, stopped – waits on the maintainer** (three questions in [PILOTS §6](PILOTS.md)). Phases 3 and 4 (kit, module pages, overview concept, rules, copy, a11y, handoffs, packages) follow his answer.

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | critique of the overview, every module with its changing data, its step and why, what became of the brief's ideas, what the budgets allow |
| [PILOTS](PILOTS.md) | the stop: the overview and three pilots (habits – scene, clock – sign, finance – tone), variables, states, contrast, cost, the three questions |
| `mockups/` | `world.js` (the drawing: spots of the weather landscape plus a module's things), `signs.js`, `cards.js`, `mock.css`, pages `p2-*`, `render.mjs`, `measure.mjs` (pictures and numbers go to `web/.screens/living-scenes/`, never into the repo) |

The mockups load the weather round's drawing (`../weather-scenes-2/mockups/scene.js`, `palette.js`) – one world means one drawing. Those two files must stay until this round closes.

## The ten sentences (set by the brief)

1. **The picture reads the state.** Every drawing has named variables from its module's data. A picture that never changes is decoration and is not built.
2. **Nothing is lost.** Text and numbers stay complete and in front; the picture lies behind or beside. AA in every state.
3. **Pictures show, they never punish.** Nothing gets uglier, emptier or sadder because something was not done; nothing wilts, decays, counts streaks or backlogs. Quiet states are as beautiful as full ones. No red except overdue.
4. **Steps:** 0 tone · 1 a sign that reads the state · 2 a scene. Info modules stay low.
5. **One world.** The weather's language everywhere; scenes share one landscape and the real sky. Own drawings only.
6. **The overview gets colour with a rule:** not every card is loud.
7. **It can be switched off:** one setting for all ("Bilder: Aus · Ruhig · Verspielt") and per module; no motion with `prefers-reduced-motion`.
8. **Calm and cheap:** sparse motion, nothing blinks, still when unseen, a ceiling per card and for the page.
9. **Privacy:** a picture tells no more at a glance than the text beside it. The password vault (`accounts`) gets no picture from its data. Nothing goes to the network.
10. **Stimulus budget:** `check:stimulus` rises only with the maintainer's yes.

## What this round adds to them (decided here, open to the stop)

- **One world, many spots.** A module's scene is a crop of the weather landscape – the garden in front of the cabin's fence, the way through the meadow, the trail up the hill – with the module's things drawn into it and lit by the same sky. Evening on the overview is evening in every picture.
- **Only the weather carries text on its picture.** Every other picture stands beside the text (wide cards: the right part of the card) or under it (narrow cards and the phone: a strip at the card's foot). Contrast of text is then never a property of a drawing.
- **A picture shows what is there and what was done – never what is missing.** Ticks for done things, lit windows for finished rooms, blooms for today's habits; an open thing is a bud, not a gap.
- **Growth only rises.** What grows is driven by totals (days a habit was ever done), never by streaks; a pause changes nothing.

Sample data: the app's seed (invented), place "Bern" as in the seed, Tuesday 2026-09-29.
