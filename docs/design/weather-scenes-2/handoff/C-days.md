# Hand-off C – choosing days and hours

Concept: [CONCEPT-DAYS](../CONCEPT-DAYS.md) (all of it), [CONCEPT-INFO §5](../CONCEPT-INFO.md). Words: [COPY §3, §4](../COPY.md). Mockups: `mockups/p4-seite-tag.html`, `p4-seite-tag-fern.html`, `p4-zustaende.html`.

## Scope

A view moment for the weather page (`modules/weather/useViewMoment.ts`: address ↔ state), `logic.ts` (`hoursOf`, `middleHour`, day summaries), the day stepper (new component), `DaySpans.tsx` and `HourCards.tsx` as radio groups, every part of the page reading the moment (hero, hints, chips, rest line, chart, moon card, air card), the swipe on the stage, the live region, strings.

## Steps

1. `useViewMoment`: parse and validate `day` / `hour`, fall back to now, write with one push when leaving now and replace after; the place's own date.
2. Pure selectors with table tests: `hoursOf`, `middleHour` (warmest daylight hour, fallback 14:00), the day's chips, the day's hints.
3. Radio groups (native inputs, visually hidden, the row / card is the label); roving comes for free; `:focus-visible` ring on the label; selected look per mockup (tint, 2 px frame, check mark).
4. Stepper; "Heute" only away from today; "Jetzt" / "Ganzer Tag" only while an hour is chosen.
5. Scene for the moment: `sceneOf({ hour })`, sun position and moon for that instant; cross-fade 200 ms, no opening motion.
6. Swipe on the stage with the limits of CONCEPT-DAYS §3.
7. Live region (polite, one sentence per change, not on first render).
8. Missing values (CONCEPT-DAYS §4).

## Edge cases

`hour=HH` is the place's wall-clock hour; on the 25-hour day the first of the two equal hours is meant, on the 23-hour day the missing hour falls back to the next · midnight passes while the page is open on "today" · a link to a day that has slid out · the place changes while another day is shown (the day is kept if it exists there, else now) · daylight saving day (23 or 25 hours) · day 7 with fewer hours · screen reader: group name, checked state, the hour line's label · keyboard only: every control reachable, nothing trapped.

## Not in this package

New data (B), drawing changes (A), small versions (D). No persistence of the chosen day. No notification changes.

## Acceptance

Selector tables · e2e: step through seven days with the keyboard only, each shows its own head, cards, curve, moon; "Heute" returns; Back from another day returns to now with one press · swipe e2e on the phone profile · the address round trip · reduced motion: no fade · `design:accessibility-review` on the two groups and the stepper · `check:stimulus`: the buttons hit of CONCEPT-INFO §5 named, waiting for the label · privacy tests unchanged.
