# Hand-off 01a – data, words, hint logic (package 1a)

No picture yet: everything the scene needs underneath, and the finds that are wrong words or icons. Concept: [CONCEPT §1 (new data), §3](../CONCEPT.md). Common: [00-common](00-common.md). Words: [COPY §1, §2](../COPY.md).

## Data (additive, all optional)

| Field | Where | From |
| --- | --- | --- |
| `tz?: string` | `Forecast` | the response's `timezone` (IANA name; `timezone=auto` is already requested) |
| `code?: number` | `Forecast`, `HourRow`, `DayRow` | the WMO code already fetched (`weather_code`), kept beside `group` |
| `now.snowDepth?: number` (m) | `NowDetail` | new variable `snow_depth` in `current` of the existing forecast request |
| cache | `core/weather/cache.ts` `forecastSchema` | add the fields as optional, or they are stripped on read; an entry without them stays valid; no refetch rule for the new fields |

`CodeGroup` keeps its nine members (the cache validates against them and the frozen languages have their words).

## Words

- `conditionId(code, group)` → the id of [COPY §1](../COPY.md); without a code the group's nearest id (`rain` → `rain`, `snow` → `snow`, `showers` → `showers`, `partly` → `partly` …).
- `tx.conditions[id]` replaces `tx.codes[group]` **everywhere a word is shown**: `WeatherHero` detail line, `HourCards`, `DaySpans`, `WeatherWidget`, `home/WeatherGlance`, `modules/lists/components/TripWeather.tsx`. `tx.codes` stays in the bundle (cache validation reads its keys).
- Detail-line additions (`tp.sceneStorm` …): at most one, by the priority of COPY §1, in the hero only.

## Chips (finds A5, A11)

- Dry chip icon `umbrella` (hero; the widget has no icon).
- UV chip only between sunrise and sunset of the place's day; otherwise the third chip is `tp.keySunrise` with the next sunrise.
- Frost hint icon `thermometer` in `WarningNotice` **and** in `modules/weather/attention.ts` (its own icon map).

## Hint kind `ice`

- `weatherWarnings`: a day whose `code` is 56, 57, 66 or 67 → `{ kind: 'ice', date }`; order storm, wind, ice, rain, heat, frost; still at most two in the head, five in `warningsNow`.
- Every consumer learns the kind: `WarningNotice` (line `tp.warn.ice`, icon `cloudDrizzle`), `attention.ts` (`warningLine`, icon), `notifications.ts` (the `warnNotify` notification), `tp.warnNotifyHelp` (COPY §2).
- The bar above the head stays where it is in this package (its sentence stays too); package 1b moves it.

## Tests (acceptance)

1. `api.test.ts` / `cache.test.ts`: the new fields parse, survive a cache round trip, and an old entry without them is still valid; the request URL differs from today's only by `snow_depth`.
2. `conditionId` for every WMO code of the Open-Meteo set and for every group without a code; German and English word for every id.
3. Words agree: head, hour card, day row, widget and overview line show the same word for the same code (code 1 → "überwiegend klar" in all five).
4. Chips: dry icon; UV hidden at night, sunrise chip instead (the analysis fixture: 02:50 → "Sonnenaufgang 07:38").
5. Warnings: `ice` from each of the four codes; order; `attention.ts` line and icon; the notification text.
6. `privacy.test.ts` and the connection-log tests unchanged and green.
