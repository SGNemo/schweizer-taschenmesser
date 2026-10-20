# feat/weather-followup

for the next chat:
- The weather line itself was already in `develop` (#206); this branch added the cache module (`core/weather/cache.ts`: no request offline, "Stand hh:mm" for old values), the one-time hint "Wetter: Stadt wählen" (`hint.ts`, `tm-weather-hint`), Zod parsers with fixtures, and the diagnostics canary. Details: `docs/features/weather.md`.
- The fixtures are hand-written in the documented Open-Meteo shape: the build sandbox cannot reach open-meteo.com (proxy 403), so CORS was **not** verified live. Check once with a real browser.
- Not built: setup-assistant step "Stadt für das Wetter" (parked, see feature note).
- The line now sits under "Jetzt wichtig" (from #206), not above the Heute card; unchanged on purpose.
- Gotcha: `git stash -u` while a background Playwright run is active breaks that run; also `pkill -f` kills your own shell.
