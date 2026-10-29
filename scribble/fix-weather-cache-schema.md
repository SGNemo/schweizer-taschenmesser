# fix/weather-cache-schema – for the next chat:
- `readStored` in `core/weather/cache.ts` is the one place that parses the two localStorage entries; a new field needs the Zod schema there too, else it is dropped.
