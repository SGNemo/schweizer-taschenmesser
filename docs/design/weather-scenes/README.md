# Weather scenes – sky pictures, moon and sky events (index of the round)

Brief (maintainer, 2026-11-24, with a picture of the head at 02:50, −4°): "nicer weather" – the picture larger and richer (moon, mountains), a picture for every weather by day, night and twilight, the moon always in its true phase and at every forecast day, eclipses and other sky events as pictures, and no second bar above the head. Design round only – **nothing here is product code.**

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | what `Sky` draws today and where, the data per weather, critique of the head at 1920 and 412, the finds from the picture |
| [CONCEPT](CONCEPT.md) | eight sentences every package keeps, layers and their data, weather × time of day → layers, landscape, size and place, the hint in the head, small versions, motion |
| [CONCEPT-MOON](CONCEPT-MOON.md) | phase and light, tilt, names, full moon, rise and set, the calculation with its measured accuracy and test data |
| [CONCEPT-EVENTS](CONCEPT-EVENTS.md) | every sky event with its source, when it shows, visibility at the place; what is struck |
| [COPY](COPY.md) | every new word, German and English |
| [A11Y](A11Y.md) | contrast per scene, text alternatives, motion rules, render cost ceiling |
| `handoff/` | one hand-off per package (`00-common` first: layers, tokens, building blocks) |
| [PACKAGES](PACKAGES.md) | order, branches, hotspots, the shared block, "as built"; prompts in [PACKAGES-PROMPTS](PACKAGES-PROMPTS.md) |
| `reference/` | the moon and eclipse reference code (`astro/`), test vectors, eclipse and meteor tables – measured against astronomy-engine, cited by the hand-offs |
| `mockups/` | `scene.js` (the drawing: one function, state → SVG; the template the packages port), `palette.js`, gallery pages, `render.mjs` (pictures go into the PR text, never into the repo) |

Sample data everywhere: the invented place "Lindenau" (sample coordinates 49.6° N, 11.0° E), Tuesday 2026-11-24. When the round closes (after package 4), the working documents are deleted in that PR; the decisions live in `docs/decisions/weather.md`.
