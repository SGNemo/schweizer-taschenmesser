# feat/weather-forecast – for the next chat:
- `Forecast.hours/days/time` are optional on purpose (old `tm-weather` values stay valid for the line); `useWeather(needsPreview)` refetches once when the preview is open and the cache has no preview data.
- "Now" in the preview is the place's clock (`placeNowIso`: fetched `current.time` + elapsed), not the device's.
- `settingsPath('verbindungen','weather')` is `/settings/verbindungen#weather` (hash, not a sub-path).
- Old `WeatherLine.test.tsx` offline test left `navigator.onLine` mocked; `vi.restoreAllMocks()` now in `afterEach`.
- Icons: only `sun` / `thermometer` from the existing set (no cloud/rain icon); a real set would be a separate decision.
- Open for the maintainer: Open-Meteo licence (unchanged).
