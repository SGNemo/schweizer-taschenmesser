# Handoff 3 – Gewohnheiten: the garden

Module page: [modules/habits](../modules/habits.md). Drawing: `mockups/world.js` `garden`, `plant` (port shape by shape; keep every `lit` factor). Gallery: `mockups/p2-habits.html`.

- `ui/scene/spots/garden.ts` (span `[1470, 1596]`, bed, stones, plants in four growth steps × three bloom states, lantern, butterflies, empty state) + tokens.
- `modules/habits/picture.ts` `gardenVars()`; the "days ever done" count as one indexed query per goal, memoised per day (not per render).
- `HabitsWidget`: `picture: { step: 2, spot: 'garden' }`, `<CardPicture>`; fallback sign: ring with arc done / scheduled (`ui/scene/signs/ring`).
- Page tab "Heute": panel / strip per [00-common](00-common.md); hidden while the detail column is open.
- States to test and to show in the PR: leer, wenig, normal, viel (10, two rows), besonders, Pausentag, free day × day, dusk, night, rain.
- Edge cases: 13+ goals (12 plants, summary names all); a count goal over its target (`open` bloom, never bigger); archived goal returns (its growth is its history); midnight (the day changes: blooms close with the date, no animation).
