# Hand-off 03b – aurora and official warnings (package 3b)

Concept: [CONCEPT-SOURCES](../CONCEPT-SOURCES.md). Common: [00-common](00-common.md). Words: [COPY §7](../COPY.md). Mockups: `05-ereignisse` (aurora), `10-karte` (g), `07-kopf` (7a, 7b). Builds on package 3 (event chip, "Als Nächstes", priority table).

## First step: verify the two hosts in a real browser and with the desktop fetch

Write the findings into the PR before building: DWD layer name, field names (event, severity, urgency, onset, expires), JSON output, CORS; SWPC JSON layout and CORS. Where the facts differ from [CONCEPT-SOURCES §1](../CONCEPT-SOURCES.md), the facts win. If DWD's GeoServer cannot be filtered by a point, use its bounding-box filter around the rounded position and match the polygon locally – never download all of Germany on every refresh. No CORS header → that request is skipped on the web platform (`getPlatform()` tells web from native), not sent and failed.

## Files

| File | What |
| --- | --- |
| `core/weather/germany.ts` | simplified border polygon (< 2 KB, source named) and `inGermany(lat, lon)` |
| `core/weather/warningsOfficial.ts` | `fetchOfficialWarnings(lat, lon, f)` → `OfficialWarning[] { event, level 2–4, kind?: WarningKind, onset, expires }` (Zod; unknown fields ignored; level 1, urgency "Future" and UV dropped at the parser); `displayEvent(raw)` (ordinary case); `kindOf(event)` (table of [CONCEPT-SOURCES §3](../CONCEPT-SOURCES.md)); pure `activeOfficial(warnings, nowMs, tz)` (in force now or beginning today, sorted by level then expiry); `withoutReplaced(computed, official, today)` (drops today's computed hints of a kind an official warning has) |
| `core/sky/aurora.ts` | `geomagneticLatitude(lat, lon)`; `kpNeeded(lat, lon)` (clamped 0…9, `undefined` above 9); `fetchKpForecast(f)` (both JSON layouts); pure `auroraTonight(steps, lat, lon, tz, nowMs)` → `{ from, to, kp, strength 0.4 \| 0.7 \| 1 } \| undefined` |
| cache | **own keys**, not fields of the forecast entry (which is rewritten whole on every refresh and cleared per place): `tm-weather-official` `{ key, at, warnings }` for the main place, removed by `clearCache`; `tm-weather-kp` `{ at, steps }` global, kept across place changes; each with its own retry window after a failure |
| `core/weather/settings.ts` | `officialWarnings: boolean` (default `true`, optional in the schema) |
| `modules/weather/attention.ts`, `notifications.ts`, `warningsToday.ts` | use `withoutReplaced`; attention shows official lines with the label |
| `core/net/netlog.ts`, `core/net/catalogue.ts` | the two hosts (reason `weather`) |
| scene | `event: 'aurora'`, `eventAmount = strength` – port of the mockup, never animated |
| page | official pill (`WarningNotice` gets a second variant), event chip, "Als Nächstes" (g), credits, settings switch; main place only – an extra place shows computed hints and no aurora |
| texts | every file of [CONCEPT-SOURCES §4](../CONCEPT-SOURCES.md) |

## Official pill

- Markup: `div role="note" aria-label={tp.officialLabel}` → per warning one row: icon `alert` · bold `tp.official(event)` / `tp.officialSevere(event)` (level ≥ 3) · quieter `tp.officialUntil(day, time)` or `tp.officialUntilToday(time)` · link `tp.officialSource` (`app.openUrl` to the general DWD warnings page, 44 px target on touch); `tp.officialMore(n)` at the end of the last row when rows were cut.
- Look: `background: color-mix(in srgb, var(--warning) 22%, var(--surface))`, `border: 1px solid var(--warning)`, text `var(--ink-theme)`, muted part `var(--ink-theme-muted)`; same radius and padding as the computed pill (phone: the tightened pill of `mockups/mock.css`). No stripe, no red.
- Rows: the counting rule of [CONCEPT-SOURCES §3](../CONCEPT-SOURCES.md) – at most two hint rows in the stage in total (safety → official → computed), the rest under the head.

## Edge cases

Main place outside Germany (border towns on both sides) or switch off → no request at all; answer empty → nothing; only level-1 warnings → nothing; warning expired between fetch and now → dropped; last successful fetch older than 60 min → no official pill, computed hints back in full; several warnings of one event → the one that ends last; DWD down → silent; English UI; offline; "Netzwerk sperren"; web without CORS; Kp file in the old or the new layout; a place that never needs the Kp file; polar day (no dark hours → no aurora line); viewing an extra place.

## Tests (acceptance)

1. `inGermany`: Aachen, Flensburg, Görlitz, Konstanz, Passau in; Zürich, Basel, Salzburg, Innsbruck, Prague, Strasbourg, Luxembourg, Szczecin out.
2. `warningsOfficial`: parse fixtures (hand-written in the verified shape), level mapping, dropped classes (level 1, advance information, UV), `displayEvent`, `kindOf`, `activeOfficial` (now, today, tomorrow, expired), order, the "+ n" count.
3. Replace rule per kind: official wind today hides computed wind today, keeps computed rain today and computed wind tomorrow; official fog hides nothing; no official answer → computed stay; the same in `attention.ts` and for the notification text.
4. `aurora`: geomagnetic latitude of five places (± 0.5° against a published value named in the test), `kpNeeded` (sample place 7, Tromsø 0, Singapore `undefined`), both JSON layouts, `auroraTonight` with dark hours, strength steps.
5. Requests: the DWD URL carries only the rounded position of the main place; the SWPC URL carries nothing; neither is asked when its switch is off, outside its region, offline, with "Netzwerk sperren", or for an extra place; `netlog.test.ts` files both hosts under `weather` and the catalogue test lists them.
6. Caches: own keys; `clearCache` removes the official entry and keeps the Kp entry; the 60-minute rule.
7. Pill: names, row counting with safety and computed pills, stage height ≤ 290 / ≤ 300 at 1920 and 412, contrast of the pill ≥ 4.5, axe.
8. Scene: `aurora` layer parts, no motion class, contrast of the light ink ≥ 4.5 in the text rows ([A11Y §1](../A11Y.md) has the measured values).
9. Texts: every row of the table in [CONCEPT-SOURCES §4](../CONCEPT-SOURCES.md) changed, German and English; `legal.test.ts` green with the two new flow ids; `check:readme`, `check:docs`.
