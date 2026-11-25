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
| When | Sent to open-meteo.com | Never |
|---|---|---|
| search | the typed city name, UI language | entries, module data, IDs |
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

## Words, chips and hints (weather scenes 1a)
- **The word follows the WMO code** (`conditionId(code, group)` in `core/weather/scene.ts`, 22 words in `tx.conditions`): head, hour cards, day rows, widget, overview line and trip weather say the same word (code 1 = "überwiegend klar", no longer "leicht bewölkt"). `codeGroup` (nine groups) still drives the rating, icons and the cache; a value cached without a code gets its group's nearest word.
- **Data kept beside the group** (all optional, also in the cache): raw `code` (now, hour, day), `tz` (the place's IANA zone from the response), `now.snowDepth` (m; `snow_depth`, the only added variable of the forecast request).
- **Head detail line:** after the word at most one extra word: Sturmböen, windig, Schnee liegt, Frost, Hitze (`sceneAddition`, limits of the picture only).
- **Chips:** "Kein Regen in Sicht" with an umbrella; UV only between sunrise and sunset, otherwise "Sonnenaufgang hh:mm" (today's or tomorrow's).
- **Hints:** kinds storm, wind, ice (codes 56, 57, 66, 67: "gefrierender Regen, es kann glatt sein"), rain, heat, frost in that order; frost has the thermometer icon.

## Parked
Setup-assistant step "Stadt für das Wetter" (skippable): not built; the settings entry and the one-time hint cover it, and an extra step would add load to the first run.
