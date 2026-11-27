# Living scenes – modules and the overview show their state as picture and colour

Brief (maintainer, 2026-11-27): "Wetter gefällt mir mittlerweile sehr gut … Ich will mehr davon in der App: mehr Variablen, die sich aufgrund des Standes aus dem Modul verändern. Mehr Verspieltheit wie beim Wetter, ohne Daten und Infos zu verlieren. Gerade im Überblick fehlt mir Farbe und Abwechslung. Nicht zu viel bei Info-Modulen, aber andere können verspielter sein." Design round only – **nothing here is product code.** The drawing language is the weather's ([weather-scenes-2](../weather-scenes-2/README.md), direction B "Facetten").

**State: designed; ready for package 1** ([PACKAGES](PACKAGES.md)). The stop was answered on 2026-11-27 ([PILOTS §8](PILOTS.md)).

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | critique of the overview, every module with its changing data, its step and why, what became of the brief's ideas |
| [PILOTS](PILOTS.md) | the record of the stop: overview and three pilots as shown, the questions, the maintainer's answers |
| [CONCEPT-KIT](CONCEPT-KIT.md) | the scene kit: what leaves the weather, the shared sky, the contract for a module's picture, settings, behaviour |
| [CONCEPT-HOME](CONCEPT-HOME.md) | the overview: the day's tone, the rule for loud and quiet cards, phone |
| `modules/` | one page per picture: [habits](modules/habits.md) (garden), [clock](modules/clock.md) (sky tiles), [todos](modules/todos.md) (lake), [planner](modules/planner.md) (way), [signs](modules/signs.md) |
| [RULES-DRAFT](RULES-DRAFT.md) | the section "Pictures" for MODULE-IDENTITY (steps, the nevers, budgets, checklist) – not yet in force |
| [COPY](COPY.md), [A11Y](A11Y.md) | every word (de, en); contrast, motion, ceilings, stimulus numbers |
| `handoff/` | `00-common` first, then one per package |
| [PACKAGES](PACKAGES.md), [PACKAGES-PROMPTS](PACKAGES-PROMPTS.md) | order, what may run side by side, the common block, the prompts, "as built" |
| `mockups/` | `world.js` (the drawing: spots `garden`, `lake`, `way`, sky tiles), `signs.js`, `cards.js`, `shell.js`, `icons.js`, `mock.css`, pages `p2-*`, `p3-*`, `render.mjs`, `measure.mjs` (pictures and numbers go to `web/.screens/living-scenes/`, never into the repo) |

The mockups load the weather round's drawing (`../weather-scenes-2/mockups/scene.js`, `palette.js`) – one world means one drawing. Those two files must stay until this round closes.

## The ten sentences (set by the brief)

1. **The picture reads the state.** Every drawing has named variables from its module's data. A picture that never changes is decoration and is not built.
2. **Nothing is lost.** Text and numbers stay complete and in front; the picture lies behind or beside. AA in every state.
3. **Pictures show, they never punish.** Nothing gets uglier, emptier or sadder because something was not done; nothing wilts, decays, counts streaks or backlogs. Quiet states are as beautiful as full ones. No red except overdue.
4. **Steps:** 0 tone · 1 a sign that reads the state · 2 a scene. Info modules stay low.
5. **One world.** The weather's language everywhere; scenes share one landscape and the real sky. Own drawings only.
6. **The overview gets colour with a rule:** not every card is loud.
7. **It can be switched off:** one setting for all ("Bilder: Aus · Ruhig · Verspielt"; in the app the middle word is "Dezent", [COPY §1](COPY.md)) and per module; no motion with `prefers-reduced-motion`.
8. **Calm and cheap:** sparse motion, nothing blinks, still when unseen, a ceiling per card and for the page.
9. **Privacy:** a picture tells no more at a glance than the text beside it. The password vault (`accounts`) gets no picture from its data. Nothing goes to the network.
10. **Stimulus budget:** `check:stimulus` rises only with the maintainer's yes.

## What this round adds to them

- **One world, many spots.** A module's scene is a crop of the weather landscape – the garden in front of the cabin's fence, the lake below the massif, the way through the meadow – with the module's things drawn into it and lit by the same sky. Evening on the overview is evening in every picture; so is rain.
- **Colour follows the day.** The cards' tone is the sky's tone of the hour, not a colour per area (decided at the stop).
- **Text stands on a picture only where the picture is a plain sky** (the weather, the clock's tiles). Scenes stand beside the content (wide cards) or under it (narrow cards, phone).
- **A picture shows what is there and what was done – never what is missing.** Boats for ticked things, blooms for today's habits, flags on passed posts; an open thing is a bud or a plain post, not a gap.
- **Growth only rises.** What grows is driven by totals (days a habit was ever done), never by streaks; a pause changes nothing.

Sample data: the app's seed (invented), place "Bern" as in the seed, Tuesday 2026-09-29.
