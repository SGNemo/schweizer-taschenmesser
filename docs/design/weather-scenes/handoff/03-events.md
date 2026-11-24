# Hand-off 03 – sky events (package 3)

Concept: [CONCEPT-EVENTS](../CONCEPT-EVENTS.md). Common: [00-common](00-common.md). Words: [COPY §5](../COPY.md). Mockups: `05-ereignisse`, `10-karte`.

## `core/sky/` additions

| File | What |
| --- | --- |
| `solarEclipse.ts` | port of `../reference/astro/solarEclipse.js`: `localSolarEclipses(fromMs, toMs, lat, lon)` → `{ kind, begin, max, end, obscuration, sunAltBegin, sunAltMax, sunAltEnd }`; `obscurationAt(ms, lat, lon)` for the bite of this minute |
| `lunarEclipses.ts` | the table `../reference/lunar-eclipses-2026-2050.json` as a typed constant (source line kept) + `localLunarEclipse(row, lat, lon)` → contacts, altitude at each, `visible`, `risesLate`, `setsEarly`; `umbraAt(ms, row)` 0…1 linear between the contacts |
| `meteors.ts` | the six showers of [CONCEPT-EVENTS §1](../CONCEPT-EVENTS.md) (after the check against the IMO calendar), `showerNight(date, lat, lon)` |
| `events.ts` | `eventsFor({ nowMs, lat, lon, forecast })` → `{ scene?: SceneEvent, chip?: …, card?: … }` by the priority of §2; pure |

## Scene

`SceneState.event` and `eventAmount` as in `scene.js` (`solarPartial`, `solarTotal`, `solarAnnular`, `lunarPartial`, `lunarTotal`, `meteors`, `starNight`, `rainbow`, `dust`). The bite's direction is drawn as in the mockup (upper right for the sun, lower left for the moon) – the true position angle is not computed. Rainbow: no sun disc. Dust: by day only. None of the event shapes moves.

## Data

`air.dust?: number` (µg/m³, current) – add `dust` to `AIR_VARIABLES` and to the cache schema, optional. Threshold 50.

## Page

| Element | Spec |
| --- | --- |
| Event chip | replaces the hero's third chip while an event of §2 is live; a 16 px glyph from the mockup (`10-karte.html`) + the short words of [COPY §5](../COPY.md) |
| Card block "Als Nächstes" | last block of "Mond & Himmel": small heading `tp.ev.next`, one event: line 1 name and time, line 2 the local facts, optional line 3 (rises late / sets early / moon bright / clouds); a solar eclipse always ends with `tp.ev.solarSafety` in `--text` (not muted) |
| Solstice / equinox | line with the small glyph, on that local day only |
| Dust | one row in `WeatherAir` under the particle rows |

## Edge cases

Eclipse that begins before sunrise or ends after sunset (sample 2028-01-26); moon rising eclipsed (2028-12-31); an eclipse whose local maximum is below the limits (2028-01-12, 2034-03-20: nothing); two events on one day (priority); a place south of the equator (season names swap; radiant never reaches 25° → no shower); cloud cover unknown for a date beyond the hourly forecast → no cloud sentence; the table's end (after 2050 no lunar eclipses are announced – stated in `docs/features/weather.md`); switch `sky` off → nothing of this.

## Tests (acceptance)

1. Solar: every local row of `../reference/eclipses.json` for the five places within ± 2 min and ± 1 percentage point; none missed; nothing found for a year without one.
2. Lunar: the 33 verdicts of `eclipses.json` exact; contacts ± 2 min; `risesLate` for 2028-12-31 at 49.6° N.
3. Limits: 5 % / 10 % at and below the edge.
4. Meteors: peak instants 2027–2031 of the report within ± 30 min; latitude rule (Eta-Aquariiden hidden at 49.6° N, shown at 1.35° N).
5. Seasons: 2027–2028 within ± 2 min; names swapped at −33.9°.
6. Rainbow and star-night rules as tables at their edges; dust threshold.
7. `events.ts` priority table; one chip, one card event.
8. Scene: each event → its layer parts (`data-part`), no motion classes on them.
9. Privacy: no new host in the connection log test; the air request differs only by the variable.
