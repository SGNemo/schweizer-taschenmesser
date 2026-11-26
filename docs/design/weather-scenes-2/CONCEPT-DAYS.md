# Weather round 2 – days and hours to choose

The page always shows one moment: **now** by default, or a chosen day, or a chosen hour of the shown day. Everything on the page follows that moment. Words: [COPY §4](COPY.md). Mockups: `mockups/p4-seite-heute.html`, `p4-seite-tag.html`.

## 1. The view moment

`view = { date: 'YYYY-MM-DD', hour: 'HH' | null }` in the place's own time. Default: today, `hour: null` = now. It lives in the address and in page state only – never stored, never synced; opening the page again shows now.

| Control | Where | What it is | Does |
| --- | --- | --- | --- |
| **Day stepper** | first row under the head, at the end of the place row (phone: its own row) | `‹` · label "Heute, Do. 26. Nov." · `›` (inactive, not hidden, at the first and the last day – the row does not jump); a third button "Heute" appears only while another day is shown | one day back / on; "Heute" returns to today and now |
| **Days** | the card "7 Tage" | the seven rows are one radio group "Tag wählen" (a row = a label with a visually hidden radio); the shown day is checked | shows that day |
| **Hours** | the row of hour cards | one radio group "Stunde wählen"; first card "Jetzt" (today) is checked by default; on another day none is checked until one is chosen | shows that hour in the head |
| **Jetzt** | in the hour section's head line, only while an hour is chosen | button | back to now (today) or to the day's own view (another day) |

Why radio groups and not 31 buttons: one tab stop per group, arrow keys come with the element, the selected state is announced, and the page shows nothing it did not show before – rows and cards exist today, they only become choosable.

## 2. What the page shows for a chosen day

| Part | Today, now | Another day (no hour chosen) | A chosen hour |
| --- | --- | --- | --- |
| Scene | the current hour | the day's **middle hour**: the warmest hour between sunrise and sunset (fallback 14:00); its values drive every layer | that hour's values; sun on its arc for that time, moon from `core/sky` for that instant |
| Head: big number | temperature now | "4° / −3°" (high / low) | that hour's temperature |
| Head: detail line | "fühlt sich an wie −5° · bedeckt · Frost" | "Freitag, 27. November · Regen" (the day's word from the daily code) | "Fr. 14:00 · fühlt sich an wie 1° · Regen" |
| Hints | today's | that day's computed hints; an official warning only if its time span touches the day | as the day |
| Chips (on the phone they may take two rows when a day's chips are long) | rain / dry · wind · UV or moon | "Regen 14–18 Uhr · 4,2 mm" or "Kein Regen" · "Wind bis 28 km/h, Böen 46" · "UV bis 2" or the moon of that night | rain in that hour · wind and gusts of that hour · UV of that hour or the moon |
| Rest line | as today | hours with rain or snow · sunshine · cloud · sun times (not the high / low again – the big number says it) | the day it belongs to: high / low · hours with rain · sun times (the hour's own values stand in the hour line under the cards, once) |
| Rain in the next two hours | only while rain is near | hidden | hidden |
| Hour cards | the next 24 hours from now | 00:00–23:00 of that day | same list, the hour checked; an **hour line** under the cards names the rest of its values |
| Curve | next 24 hours | 00–24 of that day; the chosen hour gets a thin marker | marker on that hour |
| 7 Tage | today checked | that day checked | – |
| Mond & Himmel | tonight | that date: rise, set, phase, the night's event | – |
| Atemwege & Allergie | now | the day's highest index and its pollen (5 days ahead); beyond: one sentence | – |

The head never stops saying which moment it shows: the detail line starts with the day (and hour) whenever it is not now, and the stepper's label names the day.

## 3. Keys, touch, address

- **Keys:** Tab reaches the stepper buttons, the day group, the hour group, each once. In a group ← → ↑ ↓ move and choose (native radio behaviour), Home / End jump to the first / last. In the stepper ← and → work on the focused button's group too (`‹` `›`). No page-wide shortcut: the app has a global search and other pages use arrows.
- **Focus** stays on the control that was used. A polite live region says the new moment once: "Freitag, 27. November: Regen, 4° / −3°".
- **Swipe (phone):** a horizontal swipe on the picture steps one day (left = next day). It starts only inside the stage, not within 24 px of the screen edges (system back gesture), needs 56 px and twice as much sideways as vertical travel. The hour cards keep their own sideways scroll. Swipe is never the only way – the stepper sits right under the picture.
- **Address:** `/weather?place=2&day=2026-11-27&hour=14`. Absolute date, so a link means the same day tomorrow. A date outside today … today + 6 or a broken value falls back to now and is removed (`replace`). Leaving "now" pushes one history entry; further steps replace it – Back returns to now with one press, not seven.
- **Change of picture:** the scene swaps with a 200 ms cross-fade (opacity) and stands still. The five seconds of motion belong to opening the page on "now" only – stepping through seven days must not start seven animations. With reduced motion, "Standbild" or "Ruhig": no fade.

## 4. When values are missing

| Case | What shows |
| --- | --- |
| Cache from before this round (48 hours, no extra fields) | days 1–2 as far as hours exist; for a day without hours: head from the daily values, scene from the daily code (level 2, wind from the day's maximum), instead of cards the sentence "Stundenwerte für diesen Tag kommen mit der nächsten Aktualisierung.", no curve card. One refresh is asked (same TTL and offline rules) |
| Offline, stale cache | as cached, with "Stand hh:mm"; days that slid out of the cache are not offered (their radios are absent, not disabled) |
| A field the source does not deliver for that hour (visibility, snowfall line, 15-minute rain) | the line or the level is left out; the picture falls back as [CONCEPT §3](CONCEPT.md) says; never a dash in a list |
| Air beyond five days | "Für diesen Tag liegt noch keine Luftvorhersage vor." |
| Day 7 has fewer than 24 hours | the cards that exist; the curve ends where the values end |

## 5. Data this needs

All 168 hours of the forecast are kept (today 48), including today's hours since midnight, with the fields of [CONCEPT-INFO §4](CONCEPT-INFO.md); `hoursOf(forecast, date)` and `middleHour(forecast, date)` are pure functions in `core/weather/logic.ts`. `sceneOf` takes an hour row (`sceneOf({ forecast, hour, … })`) – "now" passes the current hour, so there is one path. Cache size about 48 KB.
