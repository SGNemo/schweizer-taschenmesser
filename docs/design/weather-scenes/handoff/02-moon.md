# Hand-off 02 – the moon (package 2)

Concept: [CONCEPT-MOON](../CONCEPT-MOON.md). Common: [00-common](00-common.md). Words: [COPY §4](../COPY.md). Mockups: `04-mond`, `10-karte`, `07-kopf` (1), `06-klein` (day row).

## `core/sky/` (port of `../reference/astro/`, TypeScript strict, pure, no dependency)

| File | Exports (keep the names) | Notes |
| --- | --- | --- |
| `core.ts` | `moonPhase(ms)`, `sunApparent`, `moonApparent`, `deltaT` | always the 60-term series |
| `topo.ts` | `sky(ms, lat, lon)` → altitude / azimuth of moon and sun; `crescentTilt(ms, lat, lon)` | |
| `riseset.ts` | `moonRiseSet(dayStartMs, dayEndMs, lat, lon)` | 10-minute steps, as measured |
| `phases.ts` | `phasesBetween(fromMs, toMs)`, `seasonInstant(year, which)` | |
| `phaseName.ts` | `phaseNameForDay(dayStartMs, dayEndMs, principal)` | rule of [CONCEPT-MOON §3](../CONCEPT-MOON.md) |
| `moonDay.ts` (new) | `moonOfDay(date, lat, lon, tz)` → `{ name, lit, waxing, rise?, set?, nextFull, nextNew, superMoon, secondFull }`, memoised per place and local day | day bounds = local midnights of `date` in `Forecast.tz` (package 1a), computed with `Intl.DateTimeFormat` (23 / 25 h days); without `tz` the device's zone |

Time: the real instant `now()` from `core/time/now.ts` (never the forecast's 15-minute slot). Fixtures: copy `../reference/vectors.json` to `core/sky/__fixtures__/` with its source line (package 4 deletes the design folder).

## Scene

- `SceneState.moon = { illum, tilt, size }` and `body = { kind: 'moon', t, alt }` from `sky()` / `crescentTilt()`; `t` and height as in [CONCEPT-MOON §4](../CONCEPT-MOON.md); drawn at night, dawn and dusk while above the horizon, else `body.kind = 'none'`.
- Phase path: `scene.js` `moonPath(r, illum)`; rotate by `tilt`; earthshine below 0.35; ring below 0.02.
- Full moon: `size 1.2`, sky key `night-full`, ridge highlight; supermoon `1.35`.
- Day moon: `dayMoon: true` by the rule of §4.
- Switch `sky` off: no moon in the scene (as in package 1b), no chip, card or row glyphs.

## Page

| Element | Spec |
| --- | --- |
| Third chip at night | `MoonGlyph` 16 px `mono` as the icon + `tp.keyMoon(name, percent)`; replaces `tp.keySunrise` of package 1a. Phone: the rest line below the stage begins with `tp.keyMoon(…)` |
| Card "Mond & Himmel" | in the aside under `WeatherAir` (the aside's `aria-label` becomes `tp.asideLabel`), same `Card` look; `h2` `tp.moonTitle`; row 1: `MoonGlyph` 64 px (colour, real tilt of now) beside name (`--text` 600) and `tx.moon.lit`; row 2: `tp.moonRise` · `tp.moonSet` in clock order of the local day, or the "does not rise / set" sentence; row 3: `tp.moonNextFull` or `tp.moonFullToday`, then `tp.moonNextNew`; supermoon and second-full-moon lines when true; phone: the card follows the air card in the page flow |
| Day rows (`DaySpans`) | at the end of `.rowMain`, after the rating chip: `MoonGlyph` 18 px `mono` in `--text-muted` + name in the meta size; the pair is one `span` with `aria-label={tp.moonDayAria(name)}`, the glyph `aria-hidden`; wraps under the row on the phone |

## Edge cases

No moonrise or moonset on a day (about once a month each) → the sentence; far north: several days without rise or set; a full moon instant within minutes of local midnight (the name follows the instant's local day); clock-change days (23 / 25 h); the place in another time zone than the device; `lat` / `lon` 0; cache without a time → device clock.

## Tests (acceptance)

1. `core/sky/*.test.ts` against `vectors.json` with the tolerances of [CONCEPT-MOON §7](../CONCEPT-MOON.md) – all rows, including the picture's moment (2026-11-24 01:50 UTC: 99.37 %, "full", altitude 41.99°).
2. Name per local day for a whole lunation in Europe/Berlin, Pacific/Auckland and America/Los_Angeles: exactly one "full" day, on the instant's local date.
3. Supermoon: 2026-11-24 and 2026-12-24 true, 2026-10-26 false; second full moon 2028-12-31.
4. Scene: eight phases → path snapshot by parameters (not pixels); tilt sign north / south; moon below the horizon → no body; day moon rule.
5. Page: chip at night, card rows, day-row names and accessible names; switch off removes all of it.
6. Speed: `moonOfDay` for seven days + now ≤ 5 ms median under CPU throttle ×4 (Playwright, phone profile), number in the PR.
