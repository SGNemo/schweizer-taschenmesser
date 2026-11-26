# Hand-off B – more data and values

Concept: [CONCEPT-INFO](../CONCEPT-INFO.md), [ANALYSIS §2](../ANALYSIS.md). Words: [COPY §2, §3, §5–§7](../COPY.md). Mockups: `mockups/p4-seite-heute.html`, `p4-seite-heute-regen.html`, `p4-zustaende.html`.

## Scope

`core/weather/api.ts` (request, parser, types), `cache.ts` (schema, all 168 hours, today's past hours), `logic.ts` (helpers), `air.ts` (hourly index kept), `core/sky` (civil twilight search), new `modules/weather/rainSoon.ts`, `components/HourCards.tsx` (amount; hour line for "Jetzt"), `WeatherChart.tsx` (select and series), new `components/MoreValues.tsx`, `MoonCard.tsx` (first line), page layout, strings, fixtures, DATA-FLOWS row, `docs/features/weather.md`.

## Steps

1. **One real request per added variable** (CONCEPT-INFO §4) from a machine that reaches the host; build the fixtures from the answers. A variable the source does not deliver as documented is dropped with its line and named in the PR – no workaround, no second source.
2. Request, parser (Zod), `HourRow` / `Forecast` / cache schema with the names of [00-common](00-common.md); keep all hours; cache size test (≤ 64 KB for the main place).
3. `rainSoon(forecast, now)` → `{ kind, from, until, minutes, mm } | null` as a pure function with a table test for the five sentences of COPY §2; head chip 1 uses it; the block with eight bars appears only when it returns a value.
4. Hour cards: amount beside the chance; the hour line under the cards (for now: "Jetzt").
5. Curve: the select and its six series; the choice in `localStorage` (`tm-weather-chart`), not synced, not in diagnostics; every series has its one-sentence text alternative.
6. "Mehr Werte": `<details>`-like disclosure with the groups of COPY §6; lines without a value are left out; a group without lines is left out.
7. Computed values: day length, civil twilight, pressure tendency, snowfall line – pure functions with tests.
8. DATA-FLOWS: the `weather` row's list of values; no new row.

## Edge cases

Old cache (no new fields): every new part is simply absent; one refresh is asked. Places outside Central Europe and North America: 15-minute values are interpolated – the sentences say "etwa". Air beyond five days: series "Luftqualität" ends there. Imperial or other units: none exist in the app.

## Not in this package

The picture (A) – the new fields only flow into `sceneOf` once A has landed (whoever lands second wires the hour row through and says so in "as built"). Choosing days or hours, the stepper, the "Jetzt" button (C). The DWD description text.

## Acceptance

Parser tests against real fixtures · cache keeps 168 hours and stays under the size limit · `rainSoon` table · chart series each with data, without data, and its text alternative · `privacy.test.ts`, connection-log tests: unchanged and green; the request's host and position rounding asserted unchanged · `check:stimulus`: no hit from this package but the page height (named) · `check:i18n`.
