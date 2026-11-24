# Weather scenes – concept: aurora and official warnings (package 3b)

The maintainer allowed new data sources for these two (2026-11-24, after the design PR). This is the one place of the round where the app talks to a new host; everything else stays as in [CONCEPT §0](CONCEPT.md). Words: [COPY §7](COPY.md). Hand-off: [handoff/03b-sources](handoff/03b-sources.md).

## 1. Two sources, the smallest possible data

| | Aurora | Official warnings |
| --- | --- | --- |
| Source | NOAA Space Weather Prediction Center: the planetary K index forecast, `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` (three days in 3-hour steps; a US government product, no key) | Deutscher Wetterdienst: the warning layer of its GeoServer (`https://maps.dwd.de/geoserver/dwd/ows`, WFS `GetFeature` on the municipality warning layer with `outputFormat=application/json`, filtered to the place's point); terms: DWD copyright page / GeoNutzV, source credit required |
| What leaves the device | **nothing about the user**: one GET of a global file, the same for everyone; the IP is visible | the place's position rounded to ~1 km (as for Open-Meteo), the IP; no app data |
| When | at most every 3 h, only while "Mond und Himmelsereignisse" is on, a place is chosen, and the place can see an aurora at all (rule below); never while offline or with "Netzwerk sperren" | with the forecast (about every 30 min while the page or overview is open), only for places inside Germany (bounding box 47.2–55.1° N, 5.8–15.1° E, then the answer decides), only while the switch "Amtliche Warnungen" is on |
| Where it is not available | – | outside Germany: no official warnings; the computed hints stay as they are. Other countries (MeteoAlarm) are not part of this package |
| Why this source | global, tiny, sends no position; an aurora "oval" file would be 900 KB every few minutes | the authority itself, no third party in between (Bright Sky would be simpler but is one more operator) |

**To verify live by the package before anything is built on it** (this round could not reach either host): the exact layer name and fields of the DWD GeoServer (`GetCapabilities`; older documentation names `dwd:Warnungen_Gemeinden`, a newer report `Warnungen_Gemeinden_vereinigt`), that it returns JSON and sends CORS headers for the PWA, the JSON layout of the SWPC file (SWPC announced a move from "first row = keys" to objects: parse both) and its CORS headers. If a host sends no CORS header, that feature works in the desktop and Android apps only (their requests do not need it) and the PWA says nothing; no proxy is built for it.

Both go through `getPlatform().fetch` (connection log, "Netzwerk sperren"), are cached beside the forecast, validated with Zod, and fail silently: without an answer the page looks as it does without the feature.

## 2. Aurora

- **Rule (local, no position sent):** geomagnetic latitude of the place from the dipole pole (80.8° N, 72.8° W); an aurora is "possible" in a 3-hour step when the forecast `Kp ≥ ceil((62 − |geomagnetic latitude|) / 2)`, the sun is lower than −12° in that step, and the step lies in tonight's dark hours. For the sample place (geomagnetic ≈ 49°) that needs Kp 7; for Tromsø Kp 0–1. Places that would need Kp > 9 never ask the file.
- **Shown:** on the evening and night of such a step: event chip "Polarlicht möglich", the card's "Als Nächstes" block with the hours and the source line, and at night with cloud ≤ 60 % the picture: soft green curtains low over the mountains (strength from how far Kp exceeds the need: just reached = a faint glow on the horizon, +2 or more = high curtains). Clouds add the usual sentence. Priority in [CONCEPT-EVENTS §2](CONCEPT-EVENTS.md): after a running eclipse, before rainbow weather.
- **Honest words:** "möglich", never "heute Nacht Polarlicht"; no notification.
- **Southern hemisphere:** the same rule with the southern pole; the word stays "Polarlicht" / "aurora".

## 3. Official warnings

- **What is taken from a warning:** event name, severity (four DWD levels), headline, onset, expiry – nothing is rewritten. The description text is not shown in the head (a link "Quelle: DWD" opens the DWD warning page in the system browser, on a click).
- **In the head:** a filled pill in the hint's place, visibly more official than a computed hint (stronger tint, hairline, no "berechnet" suffix): "Amtliche Warnung: {Ereignis}" or, from level 3, "Amtliche Unwetterwarnung: {Ereignis}", then "bis {Wochentag} {Uhrzeit} · Quelle: DWD". Never red, no blinking; the level is a word, not a colour.
- **Together with computed hints:** an official warning that is in force now or begins today **replaces today's computed hints**; computed hints for later days stay below it in their own pill. At most two official warnings in the stage (highest level first, then the earliest end); more are counted: "+ {n} weitere" links to the DWD page. Stage heights as for two hints.
- **Elsewhere:** the same line in "Jetzt wichtig" (the attention card that shows computed hints today) with the label "Amtliche Warnung"; the `warnNotify` notification keeps using the computed hints in this package (an official-warning notification is a decision of its own: notification limits).
- **Languages:** DWD's event names and headlines are German; in the English UI the label is English ("Official warning") and the event stays as issued.
- **Stale:** a warning is never shown past its expiry, and never from a forecast older than 60 minutes ("Stand …" forecasts show no official warning – better none than an outdated one).
- **Scene:** unchanged by a warning (the picture shows the weather now).

## 4. Privacy and documents the package updates

- `docs/legal/DATA-FLOWS.md`: two new rows (`weather-warnings` → maps.dwd.de, position ~1 km; `weather-aurora` → services.swpc.noaa.gov, no position), `[[RECHTSGRUNDLAGE]]` left for the maintainer like the other rows.
- The weather privacy sentence (`tx.privacy`) and the settings section name the two hosts; credit lines "Warnungen: Deutscher Wetterdienst" and "Polarlicht-Vorhersage: NOAA SWPC" beside the Open-Meteo credit.
- Switches (shared `weather` scope): "Amtliche Warnungen (Deutschland)" – **on by default**; aurora rides on "Mond und Himmelsereignisse". Default on is the maintainer's call to confirm (same class of data as the forecast itself); the alternative is off with one line in the settings.
- Connection-log and privacy tests grow by the two hosts; nothing else may appear.
- `privacy.test.ts` (AI): unchanged – none of this reaches a model.
