# Living scenes – Uhr: a sky per place (step 1, sky tiles)

Mockup: `mockups/p2-clock.html`; drawing: `Living.tile` (the weather's level "Schlicht": sky and body). Decided at the stop: more sky – the sky **is** the tile.

## Variables (`modules/clock/picture.ts` `skyOfPlace(at, zone)`)

| Datum | Source | In the picture |
| --- | --- | --- |
| the place's hour | `placeTime(at, zone, here)` (`modules/clock/logic.ts`) | the band: 21–6 night · 6–8 morning (day sky, sun low left) · 8–18 day (sun on its arc by the hour) · 18–21 evening (golden sky, sun low right) |
| the band | derived | sky key `night` / `day` / `golden`; body sun or moon; the body stands in the right 40 % of the tile so the text's side is plain sky |
| the moon's phase today | `core/sky/phases` (one value, the same for all places) | the moon's shape in night tiles |
| theme, colour mode | kit env | palette; greys in "Ruhig" |

`night` here is the app's own rule (hour ≥ 21 or < 6) – the word and the sky can never disagree.

## Card on the overview ("Uhrzeit anderswo")

Each tile's background is its sky; time, name and the line ("Tag · +9 h") stand on it in the scene ink for that sky (`inkForSky`), all three lines in the full ink (no grey on a sky). Same on the phone (two tiles per row). Nothing else changes: 2 / 4 / 6 places by size, the minute turns once. "Bilder: Aus": today's plain tiles.

## Module page

Each row's right 40 % carries the sky as a flush panel of the row's height; name, zone, line and the time stay on the plain row left of it. The head figure (your own time) stays text.

## States

leer (today's empty state, no sky) · wenig (one place) · normal (four) · viel (six) · besonders (full moon night; a morning and an evening tile side by side); the strip through 24 hours.

## Deliberately not shown

Real sunrise and sunset, twilight, the weather there, where the moon stands: the clock stores a zone, no position, and asks no network. No stars figure, no landscape – an info module keeps to the sky.

## Copy

The line's first word follows the four bands ("Nacht · Morgen · Tag · Abend") – [COPY §3](../COPY.md).
