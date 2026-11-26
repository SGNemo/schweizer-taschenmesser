# Weather (module)

**Since identity v2 weather is a module** (`modules/weather`, area Planen, route `/weather`): a full page in the module frame (sky in the head, thin large temperature, the three facts that matter, hour cards, 24 h chart with rain, wind and night, 7 day range bars, air quality in the aside, hints computed from the forecast, up to three places as chips) and an overview **widget** with only today (sky swatch, temperature, word, rain hint). The overview line, its "Wetter: Stadt wählen" hint and the dialog are gone; the sections below that talk about the line and the dialog describe the data behaviour that still holds (cache, offline, rating, air). Decisions: [decisions/ui-shell.md](../decisions/ui-shell.md) "Module identity v2".

One calm line on the Overview (old): place, temperature now, a few words, a rain hint for the next hours. Switch + place in Settings → Verbindungen → Wetter. Rules: [FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md). Decisions: [decisions/weather.md](../decisions/weather.md).

## Behaviour

- Default **on**, but nothing is shown or requested until a place is chosen. Without a place one quiet hint "Wetter: Stadt wählen" appears; "Später nicht mehr" ends it (device-local `tm-weather-hint`), after that only the settings offer it.
- The line is one button (icon + text, no colour, no motion); a tap opens the preview (below). Not shown when switched off or when nothing was ever fetched; never an error banner.
- Cache: device-local `localStorage` `tm-weather` (`core/weather/cache.ts`, clock `now()`): at most one request per place and 30 min, **none while offline** (`navigator.onLine`), values older than 30 min stay visible with "Stand hh:mm" (rain hint dropped, it would be stale). A failed request is remembered (`tm-weather-tried`): no retry for 5 min, and one request per place at a time. Removing the place clears both.
- **Preview** (`home/WeatherPreview.tsx`, `WeatherChart.tsx`; a wide `Dialog`: bottom sheet on phones, Back closes it): title = place; "Stand hh:mm" when stale; a "Jetzt" card (icon, temperature, word, rating, felt temperature, high/low, wind, gusts, humidity, sun times, UV); group "Heute": best time, a hand-drawn SVG chart of the next 24 h (temperature line, day/night shading, rain-chance bars, one rating strip) and an hour-by-hour list; group "Nächste Tage" (today + 6): word, rating, min–max bar on a shared scale, rain (chance and mm), wind, gusts, UV, sun times, hours of sunshine. Rain is named from 30 % only. Same single request as the line (`hourly`, `daily`, `forecast_days=7`, plus felt temperature, precipitation, wind, humidity, UV, sunrise/sunset, sunshine); 48 hours kept in the cache. A cached value from before the preview (or before the details) has no `hours`/`days`: the line stays as is, the open preview shows "Wird geladen" and asks once (same TTL / retry / offline rules); every detail field is optional. The place's own clock (`placeNowIso`) picks "now".
- **Airways & allergy** (`core/weather/air.ts`, `home/WeatherAir.tsx`): a second, optional request to the same provider (`air-quality-api.open-meteo.com`, same rounded position): European air quality index with its word, PM2.5 / PM10 / ozone / NO₂ / SO₂, and six pollen types (alder, birch, grasses, mugwort, olive, ragweed; **Europe only**) strongest first with a level (none / low / moderate / high / very high; limits per type are approximate) and the day pollen forecast (5 days) as a line in the day rows. Rating is deliberately careful (index > 40 or a moderate load = so-so; > 60 or a high load = unpleasant). Orientation only, the hint says "no medical advice". If the request fails the section says so calmly and the forecast stays whole; it is retried with the next regular refresh. Preview is a two-column `xl` Dialog on desktop; wind has a compass point, plus cloud cover, pressure and hours of precipitation.
- **Rating** (`rate()` in `core/weather/logic.ts`): good / so-so / unpleasant from the word, the chance of rain, wind and felt temperature (nothing against it = good, one point = so-so, two or more = unpleasant). Always shown as word + icon + colour (success / neutral / warning, never red), and the numbers stay next to it. "Beste Zeit" = longest daytime run of good hours (≥ 2 h).
- Search runs on Enter/button, never per key; up to 5 hits (name, region, country).

## What leaves the device (and what does not)

| When                                                                                                                | Sent to open-meteo.com                           | Never                                 |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------- |
| search                                                                                                              | the typed city name, UI language                 | entries, module data, IDs             |
| forecast (7 days, hourly + daily + detail values) and air quality / pollen (5 days), two requests to open-meteo.com | latitude/longitude rounded to 2 decimals (~1 km) | the place name, device or account IDs |

- Open-Meteo sees the IP like any web server. No key, no account, no cookies (plain `fetch`, 8 s timeout, no `fetchPublic` – that is for feeds).
- The place name and position live in the synced settings scope `weather` and in the local cache; they are **not** part of diagnostics (canary test in `core/diagnostics/diagnostics.test.ts`), logs or bug reports. The assistant never gets them.
- Registered as data flow `weather` ([DATA-FLOWS](../legal/DATA-FLOWS.md)) with a one-time notice before the first search.

## Attribution

Open-Meteo data is CC BY 4.0: Settings → Wetter shows "Wetterdaten von Open-Meteo.com (CC BY 4.0)" with a link (`weather-attribution`). Whether the non-commercial free tier fits stays the maintainer's call ([decisions/weather.md](../decisions/weather.md)).

## CORS

Open-Meteo documents `Access-Control-Allow-Origin: *` for browser use, so the PWA and the Tauri webview call it directly. Not verified from the build sandbox (no outbound access to the host); the E2E specs mock both hosts (`web/e2e/weather.spec.ts`). Check once with a real browser before a release.

## Code and tests

`core/weather/{api,air,cache,logic,scene,settings,useWeather}.ts`; page and widget in `modules/weather/` (`components/WeatherHero.tsx`, `HourCards.tsx`, `DaySpans.tsx`, `WeatherChart.tsx`, `WarningNotice.tsx`, `weatherIcon.ts`; `widgets/WeatherWidget.tsx`; hints `warnings.ts`, `attention.ts`, `notifications.ts`); overview line `home/WeatherGlance.tsx`; trip weather in lists `modules/lists/components/TripWeather.tsx`; settings `pages/settings/WeatherSection.tsx`; texts `strings.weather.ts` (`tx`) and `strings.weatherPage.ts` (`tp`), German and English. Parsers (Zod) are tested against fixtures in `core/weather/fixtures/` (shaped after the documented responses, no network in tests).

## The scene in the head (weather scenes 1b)

- One SVG behind the stage (`ui/weather-scene/WeatherScene.tsx`, drawing `draw.ts`, model `core/weather/scene.ts` `sceneOf`): sky by condition and phase (night, dawn, golden hour, day, dusk from today's sunrise / sunset at the place), sun on its arc, clouds by cover, rain / drizzle / snow / hail by WMO code and intensity, fog bands, a still bolt, wind lean and strokes, frost rime, snow caps and snow on the ground, season of the place (hemisphere), mountains, lake and trees. No moon yet (package 2): nights show stars only.
- Text on it takes the scene's ink (`data-ink` → `--ink-light` / `--ink-dark`); chips, the hint pill, the phone's module row and the gear are opaque with the theme ink (`--ink-theme`). Contrast per sky and theme: `ui/weather-scene/contrast.test.ts`.
- The hint of the day is a pill under the detail line ("… · berechnet, keine amtliche Warnung"); a hint that comes late sits under the head as before. Stage 280 px (desktop) / 272 px (phone), ≤ 290 / ≤ 300 with two hints. On the phone two chips stay in the stage; the third chip's fact opens the line under it.
- Motion: five seconds after opening (clouds drift, rain and snow fall, fog and trees sway), then still; paused while hidden or out of view; none with reduced motion, "Standbild", "Schlicht", "Ruhig", "Modulfarben: Aus". Setting "Bild im Wetter-Kopf": Mit Bewegung · Standbild · Schlicht (nur Himmel), in the synced `weather` scope (`scene`).
- Widget and overview line still use `Sky` until package 4.

## The moon (weather scenes 2)

- Calculated on the device (`core/sky/`, no request): phase name for the place's local day (one "Vollmond" per lunation), lit share, moonrise and moonset, next full and new moon, supermoon (≤ 361 885 km) and second full moon in a month.
- In the scene at night, dawn and dusk while it is up: true phase, tilt of the lit side, height and place from its altitude and azimuth; full moon larger with its own sky and lit ridges, supermoon larger still; a small day moon by day. Stars thin out with its light.
- On the page: the third chip at night ("Vollmond · 99 %"; on the phone the line under the stage starts with it), the card "Mond & Himmel" in the aside (named "Luft, Mond & Himmel" then), a glyph and the name at every forecast day (named "Mond: {Phase}").
- Switch "Mond und Himmelsereignisse" (Einstellungen → Verbindungen → Wetter, synced, on): off removes the moon everywhere; the night chip is the sunrise again.

## Small versions (weather scenes 4)

- **Overview line:** a 28 px round porthole of the same scene (`ui/weather-scene/ScenePorthole.tsx`, `portholeSvg` in `draw.ts`), never moving; it follows "Bild im Wetter-Kopf" ("Schlicht": sky and body only) and "Mond und Himmelsereignisse".
- **Widget:** the scene is the card's background (the one named exception in MODULE-IDENTITY "Widgets"): the full panorama scaled to the card's width with sky above (`cardFit`), text on the sky in the scene's ink, the rain hint as an opaque chip; no motion. In "Ruhig" and "Modulfarben: Aus" the plain card with a 64 px porthole (`data-variant="porthole"`).
- `Sky`, `skyKind` and the `--sky-*` tokens are gone; the head, the line and the widget all draw from `ui/weather-scene`. Performance: [perf/WEATHER-SCENES-2026-11.md](../perf/WEATHER-SCENES-2026-11.md). Pictures for PRs: [howto/pr-screenshots.md](../howto/pr-screenshots.md).

## Official warnings and aurora (weather scenes 3b)

- **Official warnings (DWD):** for the main place only, only inside Germany (`core/weather/germany.ts`, a simplified VG250 border, no box), only while "Amtliche Warnungen (Deutschland)" is on (default on). Asked with the forecast (`refreshOfficial`, about every 30 min): WFS `dwd:Warnungen_Gemeinden` at the rounded position, JSON, eight fields (event, level, urgency, onset, end, group, status, message type). Level 2 and up; no advance information, no UV. Shown as a framed pill ("Amtliche (Unwetter)Warnung: {Ereignis} · bis … · Quelle: DWD"); it replaces today's computed hint of the same kind on the page, in "Jetzt wichtig" and in the notification. At most two hint rows in the stage (safety → official → computed), the rest under the head with "+ n weitere". Never past its end, never when the last good answer is older than 60 min.
- **Aurora (NOAA SWPC):** the planetary Kp forecast, one general file without a place, at most every 3 h, only where an aurora can be seen at all (`kpNeeded`: geomagnetic latitude, ≤ Kp 9) and while "Mond und Himmelsereignisse" is on. "Polarlicht möglich" as chip, "Als Nächstes" with the hours and the source, the green curtains at night with cloud ≤ 60 %; never moves, no notification.
- Both through `getPlatform().fetch` (connection log, "Netzwerk sperren"), own cache keys (`tm-weather-official`, `tm-weather-kp`), silent on failure; both hosts send CORS `*`, so the web app asks them too.

## Sky events (weather scenes 3)

- Calculated on the device (`core/sky/`, no request): solar eclipses by search (shown from 5 % covered while the sun is up, "bis n %" is the largest coverage then), lunar eclipses from a table 2026–2050 (shown from 10 % in the umbra and 10 min with the moon up; after 2050 none is announced), six meteor showers (IMO values; the night nearest the peak, radiant ≥ 25° while the sun is below −12°), solstices and equinoxes (names swap south of the equator). From the forecast: rainbow weather (rain now, sun 3°–40°, cloud ≤ 85 %), star night (cloud ≤ 20 %, no bright moon), Saharan dust (`dust` ≥ 50 µg/m³, one more variable of the air request).
- One event at a time (`eventsFor` in `core/sky/events.ts`): the scene's picture (none of them moves), the third chip (phone: the wind chip's place), "Als Nächstes" in "Mond & Himmel" (eclipses 7 days ahead, else today's event, with the cloud sentence above 80 %), the dust row in "Atemwege & Allergie".
- Solar eclipse day: the safety sentence as a pill in the stage until the eclipse ends (desktop: with at most one weather hint; phone: the hints go under the head) and always in the card.
- All of it hangs on "Mond und Himmelsereignisse"; no reminder, no notification.

## Words, chips and hints (weather scenes 1a)

- **The word follows the WMO code** (`conditionId(code, group)` in `core/weather/scene.ts`, 22 words in `tx.conditions`): head, hour cards, day rows, widget, overview line and trip weather say the same word (code 1 = "überwiegend klar", no longer "leicht bewölkt"). `codeGroup` (nine groups) still drives the rating, icons and the cache; a value cached without a code gets its group's nearest word.
- **Data kept beside the group** (all optional, also in the cache): raw `code` (now, hour, day), `tz` (the place's IANA zone from the response), `now.snowDepth` (m; `snow_depth`, the only added variable of the forecast request).
- **Head detail line:** after the word at most one extra word: Sturmböen, windig, Schnee liegt, Frost, Hitze (`sceneAddition`, limits of the picture only).
- **Chips:** "Kein Regen in Sicht" with an umbrella; UV only between sunrise and sunset, otherwise "Sonnenaufgang hh:mm" (today's or tomorrow's).
- **Hints:** kinds storm, wind, ice (codes 56, 57, 66, 67: "gefrierender Regen, es kann glatt sein"), rain, heat, frost in that order; frost has the thermometer icon.

## More values (round 2, package B)

- **Request:** the same forecast request asks ten more hourly variables (`HOURLY_ADDED` in `core/weather/api.ts`: snowfall, snow depth, visibility, cloud in three heights, sunshine, dew point, `cape`, 0 °C level) and `minutely_15=precipitation` with 8 steps; the air request's hourly index is kept (`Air.hours`). No new host, same rounded position. Fixtures: `fixtures/*-r2.json`, recorded with `node scripts/capture-weather-fixtures.mjs`.
- **Cache:** all 168 hours from today's midnight (`HOURS_KEPT`), every new field optional; `Cached.v` (2) marks the shape, an older value stays valid and the open page asks once. About 30 KB for a week.
- **Rain in the next two hours** (`modules/weather/rainSoon.ts`, `RainSoonCard`): the first wet stretch (≥ 0.1 mm per quarter) read against the place's clock, five sentences (snow by the hour it starts in); only while it returns a value. Head chip 1 uses it before the hourly rule.
- **Hours:** "Jetzt" first, the amount beside the chance ("60 % · 0,8 mm", snow in cm); the hour line under the cards (`hourLine.ts`) starts with the gusts.
- **Curve** (`chartSeries.ts`, `WeatherChart`): select "Anzeigen" with six series, choice in `localStorage` `tm-weather-chart` (device-local, not synced, not in diagnostics); the picture is `aria-hidden`, one sentence per series; without data the series says so.
- **Mehr Werte** (`moreValues.ts`, `MoreValues`): a closed button + region, groups of COPY §6; computed values in `core/weather/derived.ts` (day length, pressure tendency – none before 03:00, the cache starts at midnight –, snowfall line, dew word, thunder tendency). "Mond & Himmel" starts with sun times, day length and civil twilight (`core/sky/twilight.ts`).

## Parked

Setup-assistant step "Stadt für das Wetter" (skippable): not built; the settings entry and the one-time hint cover it, and an extra step would add load to the first run.
