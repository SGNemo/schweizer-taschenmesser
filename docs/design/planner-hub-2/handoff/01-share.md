# Hand-off 01 – share into the planner (package 1)

Concept: [CONCEPT-INTAKE, idea 1](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/01-share.html` (412 only matters; 1920 shows the PWA page).

## Structure (`web/src/pages/ShareTarget.tsx`, as built, with one more target)

```
Geteilt                                            (page title, as built)
┌ card ───────────────────────────────────────┐
│ Fahrradträger für die Anhängerkupplung      │  title: first line, 2 lines max
│ example.org                                 │  host as text, --text-3 (links only)
│ Landet unter „Noch ohne Tag“.               │  S2, --text-meta
└─────────────────────────────────────────────┘
Wohin?   (•) In den Planer   ( ) Merkliste   ( ) Notiz   ( ) ToDo   ( ) Liste
Tag      [ohne Tag] [Heute] [Morgen]          (only while „In den Planer“ is chosen)
[ Ablegen ]                                    (filled primary, full width on 412)
```

- „In den Planer“ (S1) is the first choice and preselected when the planner module is on; otherwise the page is exactly as today.
- The day choice is the shared `DateChips` with three chips; default „ohne Tag“.
- S3 „Ablegen“ → `plan.requested { title, day }` + note / URL on the ToDo → toast S4 → Android: the activity finishes back to the sharing app after the toast's first second; PWA: stays.

## The row afterwards

A normal ToDo row under „Noch ohne Tag“. A shared link shows one chip S7 („Im Browser öffnen · example.org“) in the row's chip line and as first entry of the default panel; it opens the system browser only on a tap.

## States

planner off (target missing) · nothing arrived (as built) · long text (S5 under the card) · storing (button busy) · stored · failed (S6 as `role="alert"` under the button; the card and the choice stay).

## Edge cases

- Text that is only a URL: title = host + first path segment, readable („example.org/fahrradtraeger“); never fetched.
- A URL with another scheme (`intent:`, `file:`, `javascript:`): no chip; the text stays text.
- 20 000 characters: title 160, note 4 000, S5 shown.
- Control characters and bidi overrides are stripped from the title (existing `cleanTitle` of the capture path).
- Shared while the app shows a dialog elsewhere: the share page is its own route and replaces the history entry, as built.
- Two shares in a row: each is its own page visit; nothing is queued.

## Tests

- `ShareTarget.test.tsx`: target order with planner on / off; nothing is written before „Ablegen“ (write spy); scheme gate; cut lengths; `accounts` never offered.
- Unit: URL → host title; stripping.
- e2e seed `e2e/seed/share-planner.seed.spec.ts` (PWA path, GET `/share?title&text&url`): row appears under „Noch ohne Tag“ with the chip; undo removes it.
- `planner-hub-2.spec.ts` D2 re-measured. Hand test on a real phone → `docs/MANUAL-TESTS.md` (id in the PR).
