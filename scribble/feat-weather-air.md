# feat/weather-air – for the next chat:
- Air request is fired in parallel inside `fetchForecast` (`api.ts`), failure => `air` undefined; old cache without `air` gets it at the next TTL refresh (not forced by the open preview: a failing air request would loop).
- Pollen limits in `core/weather/air.ts` `LIMITS` are approximate; tune there. Pollen exists for Europe only.
- Possible next: choose pollen types to watch, notification-free "today is a bad pollen day" line on the Overview (needs the focus checklist).
