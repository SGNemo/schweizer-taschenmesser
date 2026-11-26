# Weather round 2 – new drawing language, strength in the picture, more values, days to step through

Brief (maintainer, 2026-11-26, after round 1 was built, with a picture of an overcast frost night): the pictures lack detail – more angular mountains, more trees, a more real scenery that is still a cartoon; the picture should show how strong the weather is (rain, thunder, fog, sun, wind); the moon must show through an overcast sky; more values on the page; the forecast days can be opened one after another. Design round only – **nothing here is product code.** Round 1: [weather-scenes](../weather-scenes/README.md); its eight sentences hold where this round does not change them.

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | critique of the built head in 13 situations, the data inventory, what the strength levels need |
| [STYLES](STYLES.md) | the stop: three drawing languages on the same three scenes, cost, the maintainer's three answers |
| [CONCEPT](CONCEPT.md) | the scene v2: landscape, how the body is seen, levels (data → level → picture), size, small versions, motion |
| [CONCEPT-DAYS](CONCEPT-DAYS.md) | days and hours to choose: the view moment, what the page shows, keys, swipe, address, missing values |
| [CONCEPT-INFO](CONCEPT-INFO.md) | more values in steps: where they stand, what stays out, the data, the stimulus count |
| [COPY](COPY.md) | every new word, German and English |
| [A11Y](A11Y.md) | contrast per scene, motion, keyboard ways, ceilings |
| `handoff/` | `00-common` first, then one per package (A–D) |
| [PACKAGES](PACKAGES.md) | order, what may run side by side, the shared block, the four prompts, "as built" |
| `mockups/` | `scene.js` + `palette.js` (the drawing), `events.js`, `scene-motion.css`, galleries `p3-*`, pages `p4-*`, `render.mjs` and `measure.mjs` (pictures and numbers go to `web/.screens/weather-scenes-2/`, never into the repo); `styles.js`, `head2.js`, `p2-stile.html` are the record of the style choice |

**Decided at the stop (2026-11-26):** direction B "Facetten", the picture grows, bolts stand and the glow brightens once ([STYLES](STYLES.md)).

Sample data: the invented place "Lindenau", Thursday 2026-11-26.
