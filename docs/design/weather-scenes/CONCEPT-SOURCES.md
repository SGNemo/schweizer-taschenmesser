# Weather scenes – concept: aurora and official warnings (package 3b)

The maintainer allowed new data sources for these two (2026-11-24, after the design PR). This is the one place of the round where the app talks to new hosts; everything else stays as in [CONCEPT §0](CONCEPT.md). Words: [COPY §7](COPY.md). Hand-off: [handoff/03b-sources](handoff/03b-sources.md).

## 1. Two sources, the smallest possible data

| | Aurora | Official warnings |
| --- | --- | --- |
| Source | NOAA Space Weather Prediction Center: the planetary K index forecast, `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` (three days in 3-hour steps; a US government product, no key) | Deutscher Wetterdienst: the warning layer of its GeoServer (`https://maps.dwd.de/geoserver/dwd/ows`, WFS `GetFeature` on the municipality warning layer with `outputFormat=application/json`, filtered to the place's point); terms: DWD copyright page / GeoNutzV, source credit required |
| What leaves the device | **nothing about the user**: one GET of a global file, the same for everyone; the IP is visible | the main place's position rounded to ~1 km (as for Open-Meteo), the IP; no app data |
| For which place | the main place only | the main place only, and only if it lies **inside Germany** – decided on the device with a shipped simplified border polygon (< 2 KB), not a bounding box (a box would send Zürich, Salzburg or Prague to the DWD) |
| When | at most every 3 h, only while "Mond und Himmelsereignisse" is on and the main place can see an aurora at all (rule below) | with the forecast of the main place (about every 30 min while the page or overview is open), only while the switch "Amtliche Warnungen" is on |
| Never | offline, with "Netzwerk sperren", for extra places | same; outside Germany nothing is asked and the computed hints stay as they are. Other countries (MeteoAlarm) are not part of this package |
| Why this source | global, tiny, sends no position; an aurora "oval" file would be 900 KB every few minutes | the authority itself, no third party in between |

**To verify live by the package before anything is built on it** (this round could not reach either host): the exact layer name and fields of the DWD GeoServer (`GetCapabilities`; older documentation names `dwd:Warnungen_Gemeinden`, a newer report `Warnungen_Gemeinden_vereinigt`), that it returns JSON and sends CORS headers for the PWA, the JSON layout of the SWPC file (SWPC announced a move from "first row = keys" to objects: parse both) and its CORS headers. **If a host sends no CORS header, the web platform does not ask it at all** (a blocked request would still carry the position and fill the log); the feature then exists in the desktop and Android apps only. No proxy is built for it.

Both go through `getPlatform().fetch` (connection log, "Netzwerk sperren"), are validated with Zod, cached under their own keys, and fail silently: without an answer the page looks as it does without the feature.

## 2. Aurora

- **Rule (local, no position sent):** geomagnetic latitude of the main place from the centred dipole (pole 80.8° N, 72.8° W; its absolute value covers both hemispheres, no second pole). Needed index `kpNeeded = clamp(ceil((62 − |geomagnetic latitude|) / 2), 0, 9)` – the usual rule of thumb that the oval's edge moves about 2° toward the equator per Kp step and a display is seen low on the horizon a few degrees beyond it; the test names its published source and the package may tighten the constant, never loosen it. An aurora is "possible" in a 3-hour step when the forecast Kp ≥ `kpNeeded`, the sun is lower than −12° in that step, and the step lies in tonight's dark hours. The sample place (geomagnetic 49.7°) needs Kp 7; Tromsø 0. A place that would need more than 9 never asks the file.
- **Shown:** on the evening and night of such a step: event chip "Polarlicht möglich", the card's "Als Nächstes" block with the hours and the source line, and at night with cloud ≤ 60 % the picture: soft green curtains low over the mountains (`eventAmount` 0.4 when Kp just reaches the need, 0.7 at +1, 1.0 at +2 or more). Clouds add the usual sentence. Priority in [CONCEPT-EVENTS §2](CONCEPT-EVENTS.md): after a running eclipse, before rainbow weather.
- **Honest words:** "möglich", never "heute Nacht Polarlicht"; no notification. "Blick nach Norden" north of the equator, "nach Süden" south of it.

## 3. Official warnings

- **Which warnings count** (FOCUS: the computed hints are deliberately rare, an always-on warning line would undo that): only warnings in force now or beginning today at the main place, of **DWD level 2 and higher** ("markantes Wetter", "Unwetter", "extremes Unwetter"; CAP severity Moderate, Severe, Extreme → levels 2, 3, 4). Level 1 (Minor: light frost, fog, gusts – almost every winter night), advance information (CAP urgency "Future" / "Vorabinformation") and UV warnings are ignored. Heat warnings count.
- **What is taken:** the event name, the level, onset, expiry. The event is shown in ordinary case (DWD writes "FROST", "ORKANARTIGE BÖEN": lower-case it and capitalise each word – "Frost", "Orkanartige Böen"); nothing else is reworded. Headline and description are not taken.
- **In the head:** a filled pill in the hint's place, visibly more official than a computed hint (stronger tint, hairline, no "berechnet" suffix): "Amtliche Warnung: {Ereignis}" or, from level 3, "Amtliche Unwetterwarnung: {Ereignis}", then "bis {Wochentag} {Uhrzeit}" (today: "bis {Uhrzeit}") "· Quelle: DWD". Never red, no blinking; the level is a word, not a colour. "Quelle: DWD" opens `https://www.dwd.de/DE/wetter/warnungen/warnWetter_node.html` in the system browser on a click – a general page, the link carries no place.
- **Together with computed hints – per kind:** each DWD event belongs to one of the hint kinds or to none (thunderstorm → `storm`; gusts, gale, hurricane-force → `wind`; heavy or persistent rain → `rain`; heat → `heat`; frost → `frost`; black ice, freezing rain → `ice`; snow, fog, thaw → none). An official warning **replaces today's computed hint of the same kind** and nothing else; computed hints of other kinds and of later days stay. No official answer (outside Germany, switch off, request failed) → the computed hints are untouched. The same rule holds in "Jetzt wichtig" and for the `warnNotify` notification (a computed hint that an official warning replaces is not sent; official warnings themselves send no notification in this package).
- **Rows in the stage – one counting rule:** the stage shows at most two hint rows in total, taken in this order: the safety sentence of a solar eclipse day, official warnings (highest level first, then the earliest end), computed hints. Official and computed rows sit in their own pills (never mixed). Whatever does not fit goes under the head, where a late hint goes; if official warnings are among it, the official pill's last row ends with "+ {n} weitere". Phone: each official row is two lines (name; "bis … · Quelle: DWD"). Stage heights as for two hints (≤ 290 / ≤ 300).
- **Elsewhere:** the same line in "Jetzt wichtig" with the label "Amtliche Warnung".
- **Languages:** DWD's event names are German; in the English UI the label is English ("Official warning") and the event stays as issued.
- **Never outdated:** a warning is not shown past its expiry, and not when the warnings' own last successful fetch is older than 60 minutes (better none than an outdated one).
- **Scene:** unchanged by a warning (the picture shows the weather now).

## 4. Privacy and every text that names where weather data goes

A new network destination must be declared everywhere the old sentence stands (`docs/legal/DATA-FLOWS.md` says so in its head). The package updates all of them, German and English:

| Where | Change |
| --- | --- |
| `docs/legal/DATA-FLOWS.md` | two new rows: `weather-warnings` → maps.dwd.de (position of the main place ~1 km, only in Germany), `weather-aurora` → services.swpc.noaa.gov (no position); `[[RECHTSGRUNDLAGE]]` left for the maintainer like the other rows |
| `web/src/strings.legal.ts` | `tLegal.flows` entries for the two new ids; the `weather` flow text and the notice "Dein Wetter-Ort wird abgefragt" name the DWD |
| `web/src/strings.weather.ts`, `strings.weatherPage.ts` | `tx.privacy`, the "needs a place" sentence, credits ([COPY §7](COPY.md)); credits shown beside the Open-Meteo credit in `pages/settings/WeatherSection.tsx` |
| `web/src/core/net/netlog.ts`, `core/net/catalogue.ts` | both hosts in `HOST_REASONS` (reason `weather`) and in the `weather` row of `NET_CATALOGUE` – otherwise "Was geht ins Netz" files them as "other" and no test notices |
| `site/src/pages/datenschutz.astro`, `site/src/pages/en/privacy.astro`, `site/src/i18n/de.ts`, `en.ts` | the weather sentence |
| `docs/user/security.md` + `security.de.md`, `docs/features/connection-log.md`, `docs/features/weather.md` | the weather sentence |

- Switches (shared `weather` scope): "Amtliche Warnungen (Deutschland)" – **on by default** (the maintainer asked for the feature; it sends the same class of data as the forecast and only for a place he chose); aurora rides on "Mond und Himmelsereignisse".
- `privacy.test.ts` (AI): unchanged – none of this reaches a model.
