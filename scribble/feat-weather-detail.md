# feat/weather-detail – for the next chat:
- Preview v2: `home/WeatherChart.tsx` (hand-drawn SVG, measures its width with ResizeObserver, fixed guess in tests), `rate()`/`bestWindow()` in `core/weather/logic.ts` (thresholds are a judgement call, easy to tune), weather icons added to `ui/icons.tsx`.
- Every new `Forecast`/row field is optional (old `tm-weather` values stay valid); new fields need the Zod schema in `cache.ts` too.
- Rating colours: success / neutral / warning only (no red by design); always with word + icon.
- Possible next: wind direction, air quality, "feels like" per day chart, Android widget.
