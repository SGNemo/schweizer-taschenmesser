# Living scenes – signs (step 1)

A sign replaces the grey 20 px mark at the end of a card's head with a 32 px drawing in the module's hue that reads **one** datum. Mockup: `mockups/signs.js`. Rules for all: one hue (`--module-color`) – what is there is filled, what is not is the card surface or a 1.5 px outline in the hue; ≥ 3:1 against the toned card; `aria-hidden` (the datum stands as text in the card); grey in colour mode "Ruhig"; with "Bilder: Aus" the old mark. A sign never shows a backlog, never turns red, never empties because something was not done.

## Group A – blocks that exist and wait for data (`web/src/ui/identity/blocks.tsx`)

| Card | Sign | Datum → picture | Source |
| --- | --- | --- | --- |
| Planer "Wochenlast" | seven bars, a dot under today | load per day 0…1 = planned / usable, capped at 1 → bar height (0 = an outline stub) | `BoardDay.planned / usable` (the unfed `WeekBars fill`) |
| Budgets "Budgets & Sparziele" | envelope | spent share of all budgets this month 0…1, capped at 1 → fill level. Over the limit is said by the card's red text as today, not by the sign | the unfed `Envelope fill` |
| Downloads "Laufende Downloads" | arrow band | overall progress 0…1 → the band's fill; nothing running → outline | `summary.percent` (the unfed `ArrowBand value`) |

## Group B – new small drawings

| Card | Sign | Datum → picture | Source |
| --- | --- | --- | --- |
| Zeiterfassung | dial | minutes today / 8 h (capped) → arc; a timer runs → a hand at 12 | `sessionMinutes` today, running flag |
| Vorräte | shelf of three boards | per storage place (the three with the most items): stocked share in thirds → 0–3 jars | counts per place, `count ≥ minCount` |
| Routinen "Heute dran" | house with four windows | rooms whose routines for today are all done → lit (filled) windows, up to four rooms by order | `lastDoneOn === today` per `room` |
| Einkauf | basket | open items 0 · 1–5 · 6+ → empty, some, many | open count |
| Personen "Nächste Geburtstage" | ring with a candle | a birthday today → the candle; else days to the next one (≤ 30) → arc | `nextBirthday` |
| Fitness | a hill with flags | sessions this week k of the week's goal → k flags on the path (at most 7) | `data.week.count`, `prefs.weekSessions` |
| Kalender "Heute" | the leaf | today's date on the leaf (built: `CalendarLeaf`) | – |
| Dieser PC | – | the cards' rings already read load and space: no new sign | – |

## Fallback signs of scene cards

Habits: a ring, arc = done / scheduled. ToDos: the today card with 0–3 ticks (things done today, 3 = three or more). Planner "Heute": its mark.

## Later, not in these packages

Music (the cover's tone as the card's backdrop – its head already has it; needs a connected account) · Fitness as a scene (the trail up the hill) once the garden and the lake have been lived with.
