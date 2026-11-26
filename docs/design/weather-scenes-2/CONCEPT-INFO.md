# Weather round 2 – more values, in steps

Rule: **the glance stays as it is; everything new is one step away or appears only when it matters.** Inventory and verdicts per field: [ANALYSIS §2](ANALYSIS.md). Words: [COPY](COPY.md). Mockups: `mockups/p4-seite-heute.html`, `p4-seite-tag.html`.

## 1. Where things stand

Order of the page (desktop: main column | aside; phone: one column in this order):

1. **Head** – picture, temperature, detail line; desktop: hints, three chips, rest line on the picture (stage 320 px). Phone: the picture carries temperature and detail line only (256 px); hints, two chips and the rest line stand directly under it.
2. **Place row** with the **day stepper** at its end.
3. **Regen in den nächsten zwei Stunden** – only while rain falls or starts within two hours.
4. **Stunden** – cards (choosable), under them the **hour line** of the chosen hour.
5. **Verlauf** – the curve, with a select for what it shows.
6. **7 Tage** – rows (choosable).
7. **Mehr Werte** – a closed disclosure with the day's values in groups.
8. Aside: **Atemwege & Allergie**, **Mond & Himmel**.

## 2. What is new, part by part

| Part | New | Shown when |
| --- | --- | --- |
| Head chip 1 | the rain sentence uses the 15-minute values: "Regen ab 14:20", "Regen bis etwa 15:10", "Schauer gegen 14:45" | rain within 2 h; otherwise the chip of today ("Regen ab 16 Uhr", "Kein Regen in Sicht") |
| Rain in the next two hours | eight bars (one per 15 min) with the two clock times under them and one sentence above ("Regen ab 14:20, etwa 40 Minuten, zusammen etwa 1,2 mm"); the bars are `aria-hidden`, the sentence says it all | as above |
| Hour card | the rain line names the amount beside the chance: "60 % · 0,8 mm" (snow: "1 cm") | amount ≥ 0.1 mm |
| Hour line | one line of text under the cards for the checked hour: felt temperature · gusts and direction · humidity · dew point · cloud · pressure · UV (by day) · visibility (under 10 km) | always (for "Jetzt" it repeats nothing the head says: it starts with gusts) |
| Curve | select "Anzeigen": **Temperatur und Regen** (default; felt temperature as a second, dashed line; amount as bars, chance as a thin line) · **Wind und Böen** (two lines, a row of direction arrows every 3 h) · **Sonne und Wolken** (sunshine minutes as bars, total cloud as a line) · **Luftdruck** (line, with the word "steigt / fällt / gleichbleibend") · **UV** (bars, daylight hours) · **Luftqualität** (index line; 5 days ahead) | always; the choice is kept on the device (`localStorage`), not synced |
| 7 Tage | rows are choosable; nothing added to a row | – |
| Mehr Werte | groups, each a short definition list: **Gefühl** (gefühlt, Taupunkt with the word "schwül" from 16°, "drückend" from 20°, Luftfeuchte) · **Niederschlag** (Menge, Stunden mit Regen, Neuschnee, Schneehöhe, Schneefallgrenze) · **Wind** (Mittel, Böen, Richtung) · **Himmel** (Bewölkung, davon tief / mittel / hoch, Sonnenschein, Sichtweite) · **Luftdruck** (Wert, Tendenz) · **Gewitterneigung** (only "mäßig" or "hoch") | closed by default; a line without a value is left out; "Schneefallgrenze" only on a day with precipitation and a level under 2 500 m |
| Mond & Himmel | first line gains the day: "Sonne 07:41–16:22 · 8 h 41 min Tageslicht · Dämmerung 07:06–16:57"; for a chosen day everything for that date | always |
| Atemwege & Allergie | for a chosen day: that day's highest index and pollen | 5 days ahead |

## 3. What stays out, on purpose

- **In the glance:** no new chip, no fourth fact, no number per cloud height, no second big number.
- **Fields:** lightning potential, lifted index, convective inhibition, wet bulb, evapotranspiration, soil values, clear-sky UV, the rain / showers split – nothing he decides anything by.
- **A rain radar or a map:** a new network destination and a moving picture.
- **A table of all hours × all values:** the hour line and the curve answer the same questions with one line each.
- **The official warning's long text** (DWD description): useful, but a change to what round 1 decided to read – named as an open decision in the PR, not part of a package.
- **Pollen per hour:** the daily level is what the source is good for.

## 4. Data

One forecast request as today, more variables; no new host, same rounded position. The `weather` row of DATA-FLOWS changes its list of values, not its destination – the PR of package B says so.

| Added to the request | Granularity | For |
| --- | --- | --- |
| `minutely_15=precipitation` with `forecast_minutely_15=8` | 15 min, next 2 h | rain preview, chip 1 |
| `snowfall`, `snow_depth` | hourly | snow level, cover of a chosen hour, card amount |
| `visibility` | hourly | fog level, hour line, Mehr Werte |
| `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high` | hourly | deck or veil in the picture, Mehr Werte |
| `sunshine_duration` | hourly | "how sunny" in the picture, curve |
| `dew_point_2m` | hourly | hour line, Mehr Werte |
| `cape` | hourly | thunder level, Gewitterneigung |
| `freezing_level_height` | hourly | Schneefallgrenze |
| already fetched, now shown per hour | hourly | felt temperature, amount, gusts, direction, humidity, cloud, pressure, UV |
| already fetched, now kept per hour | hourly (air request) | European index for the curve |

Computed on the device, no request: day length, civil twilight (sun at −6°, a small search in `core/sky`), pressure tendency (now against three hours earlier: ≥ +1 hPa "steigt", ≤ −1 hPa "fällt"), the snowfall line (freezing level − 300 m, rounded to 100 m), the middle hour of a day.

Every added field is optional in `HourRow` and in the cache schema; a response without it draws and writes the fallback. The source's documentation was not checked live from the sandbox – package B's first step is one real request per added variable and a fixture from it.

## 5. Stimulus count

| Change | Counted as | d1920 | p412 |
| --- | --- | --- | --- |
| day stepper `‹` `›` (+ "Heute" while away) | buttons +2 (+1) | 21 → 23 (24) | 6 → 8 (9) |
| "Mehr Werte" | button +1 | → 24 (25) | → 9 (10) |
| "Jetzt" while an hour is chosen | button +1, never on the default view | – | – |
| curve select | no button, no icon | – | – |
| days and hours as radio groups | no button | – | – |
| rain preview | 0 icons; +1 block while rain is near | – | – |
| page height | the head grows (desktop +40 px, phone about +40 px), "Mehr Werte" closed +56 px | 2063 → about 2160 | 3018 → about 3120 |

The default view therefore adds **three buttons** on the desktop and on the phone – over the 10 % tolerance of `buttons` on both. That is a ratchet hit the maintainer has to allow (`stimulus-raise`), named in package C's PR; nothing else moves. If he declines: the stepper stays (it is the way to the days on the phone) and "Mehr Werte" becomes the last group inside the "7 Tage" card.
