# Weather scenes – concept: the moon (package 2)

Rules of the round: [CONCEPT §0](CONCEPT.md). Words: [COPY §4](COPY.md). Hand-off: [handoff/02-moon](handoff/02-moon.md).

## 1. Decision: an own small module, no dependency, no table

Measured against `astronomy-engine` 2.1.19 (MIT) as the truth, 2026–2040, five places (49.6° N 11.0° E, Tromsø, Singapore, Sydney, Reykjavik):

| | own module (`reference/astro/*.js`, Meeus series with all 60 terms) | `astronomy-engine` at run time |
| --- | --- | --- |
| Size | 427 lines, 11.5 KB min, **5.5 KB gzip** | 135 KB min, 48.9 KB gzip; tree-shaken to what is needed still 27.5 KB gzip |
| Illuminated fraction | max 0.010 percentage points | truth |
| Distance | max 21 km | truth |
| Altitude of moon / sun | ≤ 0.003° / ≤ 0.010° | truth |
| Tilt of the lit side (3–97 % lit) | ≤ 0.017° (≤ 0.17° with the moon at the zenith) | truth |
| Moonrise / moonset | ≤ 0.17 min; 0 missed, 0 extra events at all five places (10-minute steps; 1-hour steps miss grazing events in the far north) | truth |
| New / quarter / full instants (742) | ≤ 0.89 min | truth |
| Solstices, equinoxes | ≤ 0.40 min | truth |

**Own module in `core/sky/`** (ported to TypeScript from `reference/astro/`): the error is far below what a picture or a minute on a clock can show, at a tenth of the size. No run-time dependency and no devDependency: the test vectors (`reference/vectors.json`) and the lunar eclipse table (`reference/lunar-eclipses-2026-2050.json`) are committed as fixtures with their source named. The 15-term variant saves 2.5 KB and costs up to 6.6 min in rise / set and 3° in tilt – not used. **Moonrise and moonset are shown** (the brief asked "only if cleanly computable": they are).

Not measured: speed on a phone (package 2 measures: one day's values – now, rise / set, seven day names, next phases – in ≤ 5 ms on the phone profile, memoised per place and local day), years after 2040 (the ΔT polynomial holds to 2050), observer height.

## 2. What is calculated, from what

Input: the place's latitude and longitude (the same rounded position the forecast uses; never leaves the device for this) and the time. No network.

| Value | Use | Reference function |
| --- | --- | --- |
| illuminated fraction 0…1, elongation, waxing, distance km | phase shape, percent, supermoon | `core.js` `moonPhase(ms, 60)` |
| altitude, azimuth of moon and sun | is the moon up, where on the arc, day moon, rainbow | `topo.js` `sky(ms, lat, lon)` |
| tilt: direction of the lit side against "up" | rotation of the phase shape in the scene | `topo.js` `crescentTilt(ms, lat, lon)` |
| rise, set within the local day | moon card | `riseset.js` `moonRiseSet(start, end, lat, lon)` |
| instants of new, first quarter, full, last quarter | names, "next full moon" | `phases.js` `phasesBetween(from, to)` |
| name for a local day | chip, card, day rows | `phaseName.js` `phaseNameForDay(…)` |

## 3. Eight names – which day gets which

**A principal name (Neumond, Zunehmender Halbmond, Vollmond, Abnehmender Halbmond) only on the local calendar day that contains its instant; every other day gets the in-between name from the elongation at local noon** (< 90° zunehmende Sichel, < 180° zunehmender Mond, < 270° abnehmender Mond, else abnehmende Sichel). Measured over 15 years: "Vollmond" stands on the right local date in 100 % of lunations and on exactly one day; bands by angle miss the date in 3 %, a rule "> 98 % lit" shows it on two or three days. The local day is the place's day (23 or 25 h on a clock change).

"Now" uses the name of the place's current local day. The percent is the illuminated fraction now, rounded (the night before a full moon reads "Zunehmender Mond · 98 %").

## 4. The moon in the scene

- **Shape:** lit disc with four flat maria; the lit part is a half disc plus the terminator's half ellipse with `rx = r · |1 − 2k|` (k = illuminated fraction): concave below half, convex above. Below 35 % the dark side shows faintly (earthshine); below 2 % only a thin ring.
- **Tilt:** the whole shape is rotated so that the lit side points where it does in the sky at the place and time (`crescentTilt`: + = lit side to the left of "up"). No waxing flag is needed in the scene, and the southern hemisphere is right by itself. Asserted in tests only for 3–97 % lit and altitude < 85°.
- **Position:** drawn only while the moon is above the horizon. `t` on the arc from the azimuth (east = left end, south = top, west = right end; mirrored south of the equator), height from the altitude (0° at the ridge line, ≥ 60° at the top of the arc). Below the horizon at night: stars only – the chip and the card still say the phase.
- **Light:** stars thin out with the moon's light (× (1 − 0.6 k)); clouds get a lit upper edge; under an overcast deck a pale glow marks the place.
- **Day moon:** by day, moon up, 20–97 % lit, cloud ≤ 60 %: a small pale moon (r 22, 55 % opacity), no glow.
- **Small versions:** the porthole draws the same shape with the same tilt. The glyph in a day row has no moment: upright, lit on the right when waxing north of the equator, on the left south of it, in `currentColor` (lit = filled, dark = a 1 px ring).

## 5. Full moon, supermoon

- **Full moon picture:** on the local day named "Vollmond", at night with the moon up: the moon 1.2 × as large, maria clear, a thin halo ring, the ridges with a moonlit top edge, the sky one step lighter (`night-full`), fewer stars. Detail line and chip: "Vollmond".
- **Supermoon:** a full moon whose distance at the instant is ≤ 361 885 km (computable from the distance alone; 25 in 2026–2035, one to three a year; no rule yields two to four every year). Moon 1.35 ×, word "Supermond", line in the card.
- **Second full moon in a calendar month** (place's local month; 2028-12-31, 2031-09-30, 2034-07-31): a line in the card, no picture of its own.

## 6. Where the moon stands as words

| Where | What |
| --- | --- |
| Hero, third chip at night | moon glyph + "{Phase} · {n} %" (by day the chip is UV as before) |
| New card "Mond & Himmel" in the aside, under "Atemwege & Allergie" | glyph 64 px, name, "{n} % beleuchtet", moonrise and moonset of the local day (or "Der Mond geht heute nicht auf"), next full moon and next new moon with date, supermoon line; from package 3 the next sky event |
| Every forecast day row | glyph 18 px + name at the end of the row; accessible name "Mond: {Phase}" |
| Overview widget, overview line | the porthole shows the phase; no extra word |

Switch "Mond und Himmelsereignisse" (module setting, on by default): off removes chip, card, row glyphs and events; the scene then draws the moon as a plain disc at a fixed place, as today.

## 7. Test data (from `reference/vectors.json`; tolerances for the product tests)

At 49.6° N, 11.0° E; times UTC. The first row is the moment of the maintainer's picture.

| UTC | lit % | waxing | name of the local day | distance km | altitude | tilt |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-24 01:50 | 99.37 | yes | Vollmond (instant 14:54 UTC) | 362 230 | 41.99° | not asserted (> 97 %) |
| 2026-03-23 18:40 | 27.56 | yes | Zunehmende Sichel | 367 624 | 45.44° | −147.6° |
| 2027-07-01 02:34 | 12.85 | no | Abnehmende Sichel | 370 264 | 20.31° | 125.0° |
| 2029-10-30 09:37 | 50.97 | no | Abnehmender Halbmond | 385 725 | 26.12° | 62.4° |
| 2032-08-17 17:49 | 84.16 | yes | Zunehmender Mond | 367 278 | 14.49° | −68.0° |
| 2037-11-26 05:19 | 88.73 | no | Abnehmender Mond | 383 964 | 40.62° | 54.8° |
| 2039-01-24 10:09 | 0.08 | no | Neumond | 372 566 | 15.33° | – |

Rise and set (local day Europe/Berlin, UTC): 2026-11-24 rise 14:43, set 06:45 · 2027-01-28 no rise, set 09:03 · 2027-01-14 rise 09:32, no set. Next after the picture: full moon 2026-11-24 14:54, new moon 2026-12-09 00:52. Full moons within the supermoon limit: 2026-11-24 (360 800 km), 2026-12-24 (356 700 km).

**Tolerances:** lit ± 0.1 percentage points · distance ± 50 km · waxing flag and name exact (skip instants within 10 min of a phase instant or local midnight) · altitude ± 0.05° · tilt ± 1° · rise / set ± 1 min and "exists" exact · phase instants and seasons ± 2 min · supermoon and second-full-moon flags exact. All 40 spread rows, 12 phase instants, 8 seasons and 6 rise / set pairs of `vectors.json` are asserted, not only the rows above.
