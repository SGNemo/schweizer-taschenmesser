# Handoff 4 – Uhr: a sky per place

Module page: [modules/clock](../modules/clock.md). Mockup: `mockups/p2-clock.html`. Words: [COPY §3](../COPY.md).

- `modules/clock/picture.ts` `skyOfPlace(at, zone)` → `{ band, bodyT, moon }` (bands by the place's hour; table test for every hour 0–23 and the half-hour zones).
- `ClockWidget` tiles and the page's rows use `<SkyTile>`; `picture: { step: 1 }`.
- Ink: the sky's ink for all three lines. `SkyTile` takes the measured text box: no star inside it, body and glow outside it, body at 60 % or left out when the tile is too narrow ([A11Y §2](../A11Y.md)); the acceptance samples the pixels under the text for every hour at 162, 220 and 363 px tile width, ≥ 4.5.
- Day part words: four instead of two (`clock.morning`, `clock.evening`) – de and en catalogs.
- "Bilder: Aus" / per-module off: today's plain tiles; the four words stay (they are text, not picture).
- Edge cases: 12-hour locales (longer time text); six tiles.
