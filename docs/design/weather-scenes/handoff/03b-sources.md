# Hand-off 03b – aurora and official warnings (package 3b)

Concept: [CONCEPT-SOURCES](../CONCEPT-SOURCES.md). Common: [00-common](00-common.md). Words: [COPY §7](../COPY.md). Mockups: `05-ereignisse` (aurora), `10-karte` (g), `07-kopf` (7a–7c). Builds on package 3 (event chip, "Als Nächstes", priority table).

## First step: verify the two hosts in a real browser and with the desktop fetch

Write the findings into the PR before building: DWD layer name, field names, JSON output, CORS; SWPC JSON layout and CORS. Where the facts differ from [CONCEPT-SOURCES §1](../CONCEPT-SOURCES.md), the facts win; if DWD's GeoServer cannot be filtered by a point, use its bounding-box filter around the rounded position and match the polygon locally – never download all of Germany on every refresh.

## Files

| File | What |
| --- | --- |
| `core/weather/warningsOfficial.ts` | `fetchOfficialWarnings(lat, lon, f)` → `OfficialWarning[] { event, level 1–4, headline, onset, expires }` (Zod; unknown fields ignored); `inGermany(lat, lon)`; pure `activeOfficial(warnings, nowMs)` (in force now or beginning today in the place's zone, sorted by level then expiry) |
| `core/sky/aurora.ts` | `geomagneticLatitude(lat, lon)`; `kpNeeded(lat, lon)`; `fetchKpForecast(f)` (both JSON layouts); pure `auroraTonight(steps, lat, lon, tz, nowMs)` → `{ from, to, kp, strength 0…1 } \| undefined` |
| `core/weather/cache.ts` | both answers cached with their own timestamps (warnings with the forecast, Kp 3 h); optional fields in the schema |
| `core/weather/settings.ts` | `officialWarnings: boolean` (default `true`, optional in the schema) |
| scene | `event: 'aurora'`, `eventAmount = strength` – port of the mockup, never animated |
| page | official pill (`WarningNotice` gets a second variant), attention line, event chip, "Als Nächstes" (g), credits, settings switch |

## Official pill

- Markup: `div role="note" aria-label={tp.officialLabel}` → per warning one line: icon `alertTriangle` (or the nearest in the icon set) · bold `tp.official(event)` / `tp.officialSevere(event)` (level ≥ 3) · quieter `tp.officialUntil(day, time)` · link `tp.officialSource` (opens the DWD warning page with `app.openUrl`, 44 px target on touch).
- Look: `background: color-mix(in srgb, var(--warning) 22%, var(--surface))`, `border: 1px solid var(--warning)`, text `var(--ink-theme)`, muted part `var(--ink-theme-muted)`; same radius and padding as the computed pill. No stripe, no red.
- Order in the stage: safety pill (solar eclipse day) → official pill → computed pill (later days only). At most two lines of weather hints in the stage in total; what does not fit goes under the head like a late hint.

## Edge cases

Place outside Germany or switch off → no request at all; answer empty → nothing; warning that expired between fetch and now → dropped; forecast stale (> 60 min) → no official pill; several warnings of one event → the one that ends last; DWD down → silent, computed hints as usual (they are **not** suppressed without an official answer); English UI; offline; "Netzwerk sperren"; Kp file in the old or the new layout; a place that never needs the Kp file (|geomagnetic latitude| < 44° → Kp > 9); polar day (no dark hours → no aurora line).

## Tests (acceptance)

1. `warningsOfficial`: parse fixtures (hand-written in the verified shape), `inGermany` at the borders, `activeOfficial` (now, today, tomorrow, expired), order, the "+ n weitere" count.
2. Replace rule: official today hides computed today, keeps computed tomorrow; no official answer → computed stay.
3. `aurora`: geomagnetic latitude of five places (± 0.5° against a published value named in the test), `kpNeeded` (sample place 7, Tromsø ≤ 1, Singapore never), both JSON layouts, `auroraTonight` with dark hours, strength.
4. Requests: the DWD URL carries only the rounded position; the SWPC URL carries nothing; neither is asked when its switch is off, outside its region, offline, or with "Netzwerk sperren"; connection-log test lists exactly the two new hosts.
5. Pill: names, order with safety and computed pills, stage height ≤ 290 / ≤ 300, contrast of the pill (≥ 4.5), axe.
6. Scene: `aurora` layer parts, no motion class, contrast of the light ink ≥ 4.5 in the text rows (the measured values of the mockup are in the PR of this addendum).
7. `docs/legal/DATA-FLOWS.md` rows, privacy sentence, credits present (`check:docs`, string tests).
