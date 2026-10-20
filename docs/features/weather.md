# Weather line

One calm line on the Overview: place, temperature now, a few words, a rain hint for the next hours. Switch + place in Settings → Verbindungen → Wetter. Rules: [FOCUS-GUIDELINES](../design/FOCUS-GUIDELINES.md). Decisions: [decisions/weather.md](../decisions/weather.md).

## Behaviour
- Default **on**, but nothing is shown or requested until a place is chosen. Without a place one quiet hint "Wetter: Stadt wählen" appears; "Später nicht mehr" ends it (device-local `tm-weather-hint`), after that only the settings offer it.
- The line is one element (icon + text, no colour, no motion); a tap opens the settings. Not shown when switched off or when nothing was ever fetched; never an error banner.
- Cache: device-local `localStorage` `tm-weather` (`core/weather/cache.ts`, clock `now()`): at most one request per place and 30 min, **none while offline** (`navigator.onLine`), values older than 30 min stay visible with "Stand hh:mm" (rain hint dropped, it would be stale). A failed request is remembered (`tm-weather-tried`): no retry for 5 min, and one request per place at a time. Removing the place clears both.
- Search runs on Enter/button, never per key; up to 5 hits (name, region, country).

## What leaves the device (and what does not)
| When | Sent to open-meteo.com | Never |
|---|---|---|
| search | the typed city name, UI language | entries, module data, IDs |
| forecast | latitude/longitude rounded to 2 decimals (~1 km) | the place name, device or account IDs |
- Open-Meteo sees the IP like any web server. No key, no account, no cookies (plain `fetch`, 8 s timeout, no `fetchPublic` – that is for feeds).
- The place name and position live in the synced settings scope `weather` and in the local cache; they are **not** part of diagnostics (canary test in `core/diagnostics/diagnostics.test.ts`), logs or bug reports. The assistant never gets them.
- Registered as data flow `weather` ([DATA-FLOWS](../legal/DATA-FLOWS.md)) with a one-time notice before the first search.

## CORS
Open-Meteo documents `Access-Control-Allow-Origin: *` for browser use, so the PWA and the Tauri webview call it directly. Not verified from the build sandbox (no outbound access to the host); the E2E specs mock both hosts (`web/e2e/weather.spec.ts`). Check once with a real browser before a release.

## Code and tests
`core/weather/{api,logic,cache,hint,settings,useWeather}.ts`, `home/WeatherLine.tsx`, `pages/settings/WeatherSection.tsx`, texts `strings.weather.ts` (5 languages). Parsers (Zod) are tested against fixtures in `core/weather/fixtures/` (shaped after the documented responses, no network in tests).

## Parked
Setup-assistant step "Stadt für das Wetter" (skippable): not built; the settings entry and the one-time hint cover it, and an extra step would add load to the first run.
