# Living scenes – Gewohnheiten: the garden (step 2)

Mockup: `mockups/p2-habits.html`; drawing: `mockups/world.js` `garden` (spot `garden`: the meadow in front of the cabin's fence). Liked at the stop because it follows the weather and the hour.

## Variables (`modules/habits/picture.ts` `gardenVars(goals, entries, day)`)

| Datum | Source | In the picture |
| --- | --- | --- |
| goals scheduled today, not archived | `goalRepo.active()` + `isScheduled(g, day)`, order `order` – exactly the list of the page's tab "Heute" | one plant per goal, in that order; at most 12 (from 7 in two rows); the summary line names the full number |
| place in the list (index mod 6) | the order above | the bloom's colour |
| `dayState(g, entry, day)` = `open` | `modules/habits/logic.ts` | closed bud with a tip of its colour |
| `partial` | same | half open |
| `done` | same | open bloom |
| rest day (`entry.skipped`) | entry | closed bud, as `open` |
| days the goal was ever done | count of entries with `dayState === 'done'` (one indexed count per goal, cached per day) | growth 0–3 at 0 · 3 · 10 · 30 days: sprout, young plant, grown plant, bush. Only rises; archiving and un-archiving keeps it |
| every scheduled goal done (and at least one goal) | derived | the lantern on the fence post is lit at golden hour, dusk and night; by day two butterflies sit over the bed |
| no goal scheduled today but goals exist | derived | the bed with the plants of all active goals as closed buds (a free day is a quiet garden) |
| no goal at all | derived | the turned bed, a watering can, a name stick |

`GardenVars = { plants: { state: 'bud' | 'half' | 'open'; growth: 0 | 1 | 2 | 3 }[]; allDone: boolean; empty: boolean }` – no string, no number a person typed.

## Card on the overview ("Heute geschafft")

All of today's content stays (summary, rings with names and details, the one-tap button). The picture: right 44 % on a card of two columns or more, a strip of 112 px on a one-column card and the phone. Fallback sign (scene cap reached, "Bilder: Dezent"): a ring whose arc is done / scheduled. A tick in the card makes the bloom open with the 300 ms fade.

## Module page

Tab "Heute": the picture is the first block beside the list – a panel of 340 × 250 at the right at 1920 (above the detail column when a goal is open: the panel gives way and is hidden while the detail is open), a strip of 120 px above the list at 412. Tabs "Verlauf" and "Archiv": no picture. The head stays `standard`.

## States

leer · wenig (one sprout) · normal · viel (ten, two rows) · besonders (all done) · Pausentag · free day; each under day, golden hour, dusk, night, rain, snow (the shared sky). Blooms take a third of the night's darkening so the day stays readable.

## Deliberately not shown

Names, numbers and units · missed days, gaps, streaks (`focus.streaks` stays the text feature it is) · the weekly count of "x times a week" goals beyond today's state · anything that shrinks, wilts or dries. The Sternbild idea from the stop went to ToDos ([todos](todos.md)): the garden's night already has its lantern.
