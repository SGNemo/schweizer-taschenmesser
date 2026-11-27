# Handoff 4 – Uhr: a sky per place

Module page: [modules/clock](../modules/clock.md). Mockup: `mockups/p2-clock.html`. Words: [COPY §3](../COPY.md).

- `modules/clock/picture.ts` `skyOfPlace(at, zone)` → `{ band, bodyT, moon }` (bands by the place's hour; table test for every hour 0–23 and the half-hour zones).
- `ClockWidget` tiles and the page's rows use `<SkyTile>`; `picture: { step: 1 }`.
- Ink: the sky's ink for all three lines; contrast per band in [A11Y §2](../A11Y.md) is the acceptance.
- Day part words: four instead of two (`clock.morning`, `clock.evening`) – de and en catalogs.
- "Bilder: Aus" / per-module off: today's plain tiles; the four words stay (they are text, not picture).
- Edge cases: a tile narrower than 150 px (the body may leave the tile's right edge by at most a third; text never overlaps it: the body stands behind the text's z-order but right of its box); 12-hour locales (longer time text); six tiles.
