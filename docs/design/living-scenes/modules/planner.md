# Living scenes – Planer: the day as a way (step 2, built last)

Drawing: `mockups/world.js` `way` (spot `way`: the meadow west of the lake); a first sketch – the package is built only after planner hub 2 is finished, because the card and the page are that round's files. Before building, the package reads hub 2's "as built" and maps the variables below onto the then-current data.

## Variables (`modules/planner/picture.ts` `wayVars(board, now)`)

| Datum | Source (today; re-check after hub 2) | In the picture |
| --- | --- | --- |
| the day's span | the planner's day begin and day end (settings), today | the way from the picture's left (begin) to its right (end) |
| today's placed things with a start time | today's `BoardDay` rows that have a time, at most 8 (earliest first) | a post on the way at `(start − begin) / (end − begin)` |
| a thing is done | the row's done state | its flag is up (colour by position) |
| now | `now()` inside the day's span | the walker stands there; before the day begins and after it ends there is no walker |
| golden hour, dusk, night | shared sky | the walker carries a lantern |
| nothing placed today | empty | the plain way through the meadow – "Heute ist frei." as a view |

`WayVars = { stations: { at: number; done: boolean }[]; now: number | null }`.

## Card and page

- Overview card "Heute" (`todos:next`, size l) is the planner's doorway: picture in the right 44 %, strip on the phone. Its texts ("in 3 Std · 13:00 Friseur", the next thing, "Anfangen") stay as they are. Fallback sign: none new (the card keeps its mark).
- "Wochenlast" gets its sign independently and earlier ([signs](signs.md)).
- Planner page: a strip of 120 px above the day's column of today, only on the tab that shows today; nothing on the week views.

## Deliberately not shown

Things without a time ("Noch ohne Tag"), how much is too much ("mehr als planbar" stays text), late things: a post that was passed without a flag is a post – no fallen flag, no red, no gap marker. Things beyond eight: the text names them. No titles on posts.

## Open for its package

Whether the planner's own settings name the day's begin and end after hub 2; whether "done" exists on a placed row or only on its source (then the planner's contribution gives it). The drawing's sizes (post 19 units, walker 17) are tuned for the 44 % panel of an l card.
