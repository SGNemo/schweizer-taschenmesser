# Weather scenes – concept: sky events (package 3)

Rules of the round: [CONCEPT §0](CONCEPT.md). Moon module: [CONCEPT-MOON](CONCEPT-MOON.md). Words: [COPY §5](COPY.md). Hand-off: [handoff/03-events](handoff/03-events.md). Everything here hangs on the switch "Mond und Himmelsereignisse".

## 1. The list – source, visibility, when it shows

"Local" = calculated on the device by `core/sky/`; "table" = shipped with the app; "field" = a value of the forecast already fetched. Nothing asks the network.

| Event | Source | Visible at the place when | Picture | Words |
| --- | --- | --- | --- | --- |
| **Solar eclipse** (partial, total, annular) | local, no table: numerical search around each new moon whose latitude is within 1.6° (`reference/astro/solarEclipse.js`); measured against the truth over 25 places, 213 events: bite ≤ 0.25 percentage points, contacts ≤ 1.4 min, none missed | at least 5 % of the sun's disc covered at the local maximum, and the sun above the horizon at some moment between begin and end | during the eclipse the sun with the bite of this minute; total: dark disc with corona, dark sky, stars, glow on the horizon; annular: a thin ring | card: 7 days ahead; on the day chip + card with times, maximum, "hier bis n % bedeckt" and always the safety sentence |
| **Lunar eclipse** (partial, total) | table of 55 eclipses 2026–2050 (peak + three half-durations + percent, 2.4 KB, `reference/lunar-eclipses-2026-2050.json`), visibility local from the moon's altitude at the contacts (0 of 33 verdicts differ from the truth) | at least 10 % of the disc in the umbra at the peak, and the moon above the horizon for at least 10 min of the umbral phase | the moon with the shadow of this minute (linear between the contacts); total: copper moon, no glow, more stars | card 7 days ahead; on the day chip + card; "Der Mond geht hier erst um … auf" when the beginning or end is below the horizon |
| **Supermoon** | local (distance at the full-moon instant ≤ 361 885 km) | as the full moon | larger full moon | [CONCEPT-MOON §5](CONCEPT-MOON.md) |
| **Meteor nights** | table of six showers (below), the peak instant local from the sun's longitude | the night nearest the peak; the radiant reaches ≥ 25° at the place that night | at night with cloud ≤ 60 %: three still streaks | card and chip on that evening and night; plus one sentence when the moon is > 60 % lit and up, or when cloud > 60 % |
| **Solstices, equinoxes** | local (Meeus, ≤ 0.4 min) | everywhere; the names swap south of the equator | none – nothing in the sky looks different; a small glyph in the card line | card line on that local day |
| **Rainbow weather** | field + local: WMO 61, 80, 81 or 82 now, sun 3°–40° high (`sky()`), cloud cover ≤ 85 % | by definition here and now | rainbow, light rain curtain, warm light on the ridges, no sun disc (it stands behind the viewer) | chip "Regenbogen möglich", card line |
| **Saharan dust** | field: `dust` ≥ 50 µg/m³ now (one more variable in the existing air request) | here and now | by day: milky yellow sky, pale sun without halo, far ridge faded | a row in "Atemwege & Allergie": the sentence and the value |
| **Star night** | field + local: night, cloud ≤ 20 %, moon below the horizon or < 10 % lit | here and now | 150 stars and a faint band | card line |
| **Second full moon in a month** | local | – | none | card line |

Meteor table (IMO Meteor Shower Calendar values, written from memory in this round – **package 3 checks every number against the current IMO calendar and says so in its PR**; if it cannot, the showers stay out and the row moves to "Noch offen"):

| Shower | Sun's longitude at the peak (J2000) | Usual date | Radiant RA / Dec | Rate class | Best |
| --- | --- | --- | --- | --- | --- |
| Quadrantiden | 283.15° | 3–4 Jan | 230° / +49° | 110 | after midnight |
| Lyriden | 32.32° | 22 Apr | 271° / +34° | 18 | after midnight |
| Eta-Aquariiden | 45.5° | 5–6 May | 338° / −1° | 50 | after midnight; reaches only 13° at 49.6° N, so it shows only where the radiant passes 25° |
| Perseiden | 140.0° | 12–13 Aug | 48° / +58° | 100 | after midnight |
| Orioniden | 208.0° | 21 Oct | 95° / +16° | 20 | after midnight |
| Geminiden | 262.2° | 14 Dec | 112° / +33° | 150 | late evening |

## 2. One event at a time

- **In the scene and the chip** (the hero's third chip gives way to it): solar eclipse running → lunar eclipse running → rainbow weather → an eclipse later today ("Heute: …") → meteors tonight. Dust and star night change the picture but take no chip.
- **In the card "Mond & Himmel":** one line "next": the nearest of the eclipses within 7 days, today's event, or nothing. No list of future events, no countdown, no notification – a sky event never becomes a reminder in this round.
- **Clouds are told, not hidden:** with cloud cover > 80 % at the event's time the line adds "Wolken verdecken den Himmel hier wahrscheinlich." and the scene shows the deck, as the sky will.
- **Safety:** every solar eclipse line in the card is followed by "Nur mit Sonnenfinsternis-Brille hinsehen, nie mit bloßem Auge oder Sonnenbrille."

## 3. Struck, with the reason

| Wished or considered | Why not | What would change it |
| --- | --- | --- |
| **Aurora** | needs the planetary K index or an aurora forecast (NOAA SWPC, GFZ): a new network destination | the maintainer's decision for a new data flow – listed in the PR under "Noch offen" |
| **Official weather warnings** | Open-Meteo has none; DWD or MeteoAlarm would be a new destination and a per-country source | same |
| Penumbral lunar eclipses | the eye sees almost nothing; a picture would promise what the sky does not show | – |
| Partial eclipses below the limits (sun < 5 %, moon < 10 %) | not noticeable without knowing where to look | – |
| Leoniden, Ursiden | 10–15 an hour under a perfect sky: a promise the night rarely keeps | an outburst year would need a source |
| Planets, conjunctions, ISS, comets | need planetary series or orbital elements from a source that changes | a later round |
| Sleet ("Schneeregen") | no WMO code for it in the Open-Meteo set | – |
| Halo, moon ring, red sky | no data field says so | – |
| A scene picture for solstice and equinox | nothing in the sky differs that day | – |

## 4. Sample cases for the place "Lindenau" (49.6° N, 11.0° E), from the measurement

| Date | Event | Local facts (UTC) | What the app shows |
| --- | --- | --- | --- |
| 2027-08-02 | partial solar eclipse | 08:10–10:14, maximum 09:11, 45 % covered, sun 40°–55° high | card from 26 July; on the day chip and the sun with the growing bite |
| 2028-01-12 | partial lunar eclipse, 3 % | – | nothing (below 10 %) |
| 2028-01-26 | partial solar eclipse | begins 15:40 with the sun 2° high, maximum after sunset | chip and card with "Die Sonne geht hier um … unter, das Ende sieht man nicht." |
| 2028-12-31 | total lunar eclipse | umbra 15:07–18:36, total 16:15–17:28; the moon rises during the partial phase | card from 24 December; "Der Mond geht hier erst um … auf"; the copper moon in the scene from moonrise |
| 2029-12-20 | total lunar eclipse | 20:54–00:28, total 22:14–23:09, moon 52°–62° high | the full case |
| 2034-03-20 | partial solar eclipse, 4 % | – | nothing (below 5 %) |
| 2027-12-14 | Geminiden | peak 20:02, moon 98 % lit | line with "Der helle Mond überstrahlt die schwächeren." |
| 2028-12-14 | Geminiden | peak 02:06, moon 6 % | line, streaks in a clear night |
| 2027-12-22 | winter solstice | 02:42 | card line |

Tolerances for the product tests: eclipse contacts ± 2 min, solar bite ± 1 percentage point, visibility verdict exact for every row of `reference/eclipses.json` (33 lunar, the local solar rows of five places).
