# Weather round 2 – analysis

Measured on `develop` at 6eebccc (before #1120). Pictures of the built head: 13 situations at 1920 and 412 (mocked forecast, fixed clock, place "Bern" from the e2e seed), shown in the PR text. [V] = read in the code, [D] = from the provider's documentation, not verified from the sandbox (the proxy refuses the host).

## 1. Critique of the built head

First impression: a calm, friendly band – and almost the same band in every weather. The sky changes colour; the land, the clouds and the strength of the weather hardly do.

| # | Find | Where it shows | Against the maintainer's words |
| --- | --- | --- | --- |
| K1 | **The land is three soft waves.** Round hills in two tones, no ridge, no flank, no rock; caps are white ovals. Nothing in it has an edge. | every situation | "eckigere Berge" |
| K2 | **Trees are one row of small marks** of one shape at one height, plus three crowns. No forest, no depth between the rows. | every situation | "mehr Bäume" |
| K3 | **The foreground is empty.** A pale lake stripe and a hill; nothing a wind or a rain could move. | every situation | "es fehlen Details", "realistischere Szenerie" |
| K4 | **Light and heavy rain are the same picture** (07 against 05): same layers, same 101 elements; only the stroke count differs (45 / 80 / 120), and at this size nobody counts. Strength comes from the WMO code alone, never from the amount [V]. | 05, 07 | "leichter bis starker Regen" |
| K5 | **A thunderstorm is one bolt under one cloud**, whatever its strength. | 06 | "leichtes bis starkes Gewitter (mehr Regen, mehr Blitze)" |
| K6 | **Overcast is a dark band with a wavy edge**, not a ceiling: one tone, no rolls, no depth. | 01, 07, 09 | "das 'bewölkt' soll eher ersichtlich sein" |
| K7 | **No moon under cloud.** Above 85 % cover the moon (and the sun) is replaced by a white glow of 32 % that the opaque deck then covers; with rain or snow nothing is drawn at all (`draw.ts` `deckOn`) [V]. The chip beside it says "Abnehmender Mond · 100 %". From 36 % a large cloud may sit on the disc. | 01 | "Den Mond sehe ich nicht … quasi ein Loch für den Mond" |
| K8 | **Wind is three curled lines in the sky.** Level 1 draws nothing (81 elements, as without wind); level 2 and 3 add the same curls and a lean of the marks that is too small to see. Nothing shows where the wind comes from. | 04, 12 | "Der Wind sieht auch nicht so toll aus" |
| K9 | **Fog only pales the picture**; a light and a dense fog cannot differ (codes 45 / 48 only). | 08 | "neblig" |
| K10 | **"How sunny" has no picture.** A clear day and a day with six hours of sun look the same but for the cloud count. | 03, 12 | "wie sonnig" |
| K11 | **On the phone the land is behind the chips.** Hint and chips cover the lower 80–110 px of 272: what is left is sky and the upper edge of a hill. | 412, all | detail that is drawn is not seen |
| K12 | What works and stays: the text side is quiet and readable in every scene; the opaque chips; the true moon phase on a clear night; the calm palette; the five seconds of motion. | | |

Usability finds outside the picture, fed into the later concepts: the 7 days are plain rows (not a control); the hour cards repeat the same word four times in a row without the amount; hourly felt temperature, amount, humidity, cloud, pressure and UV are cached and shown nowhere (`lines.ts` `hourLine` is unused) [V].

## 2. Data inventory

Sources today: Open-Meteo forecast and air quality (two requests, position rounded to ~1 km), DWD warnings, NOAA Kp, the sky calculated on the device. **No new destination is needed for anything below** – every "add" is one more variable in the existing forecast request.

| Field | Source can deliver | Fetched | Shown | Useful for him | Verdict |
| --- | --- | --- | --- | --- | --- |
| felt temperature per hour | hourly | yes | no | yes – cold wind, heat | show (hour detail, curve row) |
| rain amount per hour (mm) | hourly | yes | no | yes – "how much" beside "how likely" | show; drives the rain level |
| `rain` / `showers` split | hourly [D] | no | – | no | leave |
| snowfall per hour (cm) | hourly [D] | no | – | yes in winter | add; drives the snow level |
| snow depth | current, hourly | current | word "Schnee liegt" | yes | add hourly (for a chosen hour) |
| snowfall line (`freezing_level_height`) | hourly [D] | no | – | sometimes (rain or snow?) | add; one line in the details, only near the place's height ± 600 m |
| thunder tendency (`cape`) | hourly [D] | no | – | indirectly | add; drives the thunder level with gusts and amount |
| `lightning_potential` | hourly, Central Europe, ~2 days [D] | no | – | no (thin coverage) | leave |
| `lifted_index`, `convective_inhibition` | hourly [D] | no | – | no | leave |
| dew point | hourly [D] | no | – | yes – "schwül" in summer, fog risk | add; details, as a word above 16° |
| visibility | hourly [D], weak for European models | no | – | yes in fog | add; drives the fog level, with a fallback |
| cloud in three heights | hourly [D] | no | – | for the picture (thin high cloud ≠ ceiling) | add; picture and details |
| total cloud per hour | hourly | yes | no | yes | show (curve row) |
| pressure per hour → tendency | hourly | yes | now only | a little ("fällt") | show as a word in the details, computed |
| gusts per hour | hourly | yes | no | yes | show (hour detail, curve row) |
| wind direction per hour | hourly | yes | no | yes for the picture | drives lee side, flag, smoke |
| sunshine per hour | hourly [D] | no (daily only) | daily | yes – "wie sonnig" | add; drives the sun level |
| day length | daily [D] or sunset − sunrise | no | – | yes | compute, no request |
| civil twilight | **not delivered** [D]; `core/sky/topo.ts` gives the sun's altitude, a search for −6° is missing [V] | – | – | a little | compute in `core/sky` |
| rain start and end in the next 2 h | `minutely_15` [D]; native only in Central Europe and North America, elsewhere interpolated | no | – | **yes** – "starts in 20 min" | add (8 values); shown only while rain is near |
| UV per hour | hourly | yes | daily max | yes in summer | show (curve row, by day) |
| air values per hour | hourly | yes | now only; hourly thrown away | pollen and AQI over the day: yes | keep per hour for 5 days, show on a chosen day |
| `uv_index_clear_sky`, wet bulb, evapotranspiration, soil | hourly [D] | no | – | no | leave |
| DWD headline, description, instruction | WFS [D] | no (round 1 chose eight fields) | – | description: yes when a warning is open | open decision, not part of this round's packages |

**Depth per day [V]:** the API answers 168 hours; `hourRowsOf` drops the past hours and keeps 48 (`HOURS_KEPT`). Days 4–7 have no hourly values in the cache. A whole chosen day needs all 168 hours and today's past hours. Size: one hour row ≈ 175 B; cache today ≈ 11 KB; 168 h with today's fields ≈ 32 KB, with the added fields ≈ 48 KB – harmless for `localStorage`. The cache schema (Zod) strips unknown fields, so every added field is added there too.

## 3. What the strength levels need

| Level in the picture | Data | There? |
| --- | --- | --- |
| rain light / moderate / heavy | amount per hour (fetched), WMO code as fallback | yes |
| snow light / heavy, snow cover | `snowfall` per hour (add), `snow_depth` (fetched now, add hourly) | one variable |
| thunder light / strong | WMO 95–99, plus amount, gusts, `cape` (add) | one variable |
| fog light / dense | `visibility` (add), fallback: code 45 / 48 + humidity + cloud low | one variable |
| how sunny | `sunshine_duration` per hour (add), cloud total and in three heights (add) | two variables |
| wind still / breeze / strong / storm | wind, gusts, direction per hour (fetched) | yes |
| frost, heat | temperature (fetched) | yes |
| moon and sun through cloud | cloud low / mid / high (add): thin high cloud → a veil, low cloud → a deck with a hole | same variable |
| a chosen hour or day | all of the above per hour for 7 days | drop the 48-hour cut |

The scene reads only current values today [V]; `sceneOf` gets an hour row instead, so "now", a chosen hour and a chosen day use one path.
