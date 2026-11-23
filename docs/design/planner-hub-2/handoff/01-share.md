# Hand-off 01 – share into the planner (package 1)

Concept: [CONCEPT-INTAKE, idea 1](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/01-share.html` (412 only matters; 1920 shows the PWA page).

## Structure (`web/src/pages/ShareTarget.tsx`, as built, with one more target)

```
Teilen                                             (page title and card as built)
┌ card ───────────────────────────────────────┐
│ Fahrradträger für die Anhängerkupplung      │  title: first line, 2 lines max
│ example.org                                 │  host as text, --text-3 (links only)
│ Landet unter „Noch ohne Tag“.               │  S2, --text-meta
└─────────────────────────────────────────────┘
         (•) In den Planer   ( ) Merkliste   ( ) Notiz   ( ) ToDo   ( ) Liste
Tag      [ohne Tag] [Heute] [Morgen]          (only while „In den Planer“ is chosen)
[ Ablegen ]                                    (filled primary, full width on 412)
```

- „In den Planer“ (S1) is the first choice and preselected when the planner module is on; otherwise the page is exactly as today. The targets keep the control the page has today (a column of choices, each 44 px high, on 412; one row at 1920); the empty state keeps today's sentence.
- No second question above the choices: the page's own subline („Wohin soll der geteilte Inhalt?“) already asks.
- The day choice is the shared `DateChips` with the fixed set S13 „ohne Tag“ · „Heute“ · „Morgen“; default S13.
- S3 „Ablegen“ → `plan.requested { title, note, day, origin: 'share', answer }`, emitted after `whenServicesSettled()` (the URL is the note's first line); the button is busy until `answer` arrives – no timeout, the handler always answers. The planner's handler shows toast S4; the page itself turns into its stored state: S8 „Abgelegt.“ with „Ansehen“ (link to the row, from `answer.key`), „Rückgängig“ (`answer.undo`) and S9 „Fertig“ (filled, full width on 412). So the undo does not depend on a toast that times out. It stays until he taps: „Fertig“ closes back to the sharing app on Android and opens the planner in the PWA. No new native command; if the build needs one, its permission is for the webview `main` only.

## The row afterwards

A normal ToDo row under „Noch ohne Tag“. A shared link shows one chip S7 („Im Browser öffnen · example.org“) in the row's existing chip line (the line that holds ≤ 2 link chips today – no new kind of control) and in the ToDos panel. The chip is a link to the URL, or a button whose accessible name contains the host. The URL comes from the ToDos source as `PlannableItem.url?`: the todos module derives it from the first line of the task's own note when that line is one bare http/https URL – the planner never reads a ToDo's note. Scheme and host are checked when it is read, when the chip is drawn and when it is opened; the host is `new URL(…).hostname` (no user info; punycode for non-ASCII hosts); it opens the system browser only on a tap.

## States

planner off (target missing) · nothing arrived (as built) · long text (S5 under the card) · storing (button busy until `answer`) · stored (`answer.ok`) · not stored (only `answer.ok` false: S6 as `role="alert"` under the button; the card and the choice stay).

## Edge cases

- Text that is only a URL: title = host + first path segment, readable („example.org/fahrradtraeger“), percent-decoded first, then stripped of control and bidi characters; never fetched.
- A URL with another scheme (`intent:`, `file:`, `javascript:`): no chip; the text stays text.
- 20 000 characters: title 160, note 4 000, S5 shown.
- Control characters and bidi overrides are stripped from the title (existing `cleanTitle` of the capture path).
- Shared while the app shows a dialog elsewhere: the share page is its own route and replaces the history entry, as built.
- Two shares in a row: each is its own page visit; nothing is queued.

## Tests

- `ShareTarget.test.tsx`: target order with planner on / off; nothing is written before „Ablegen“ (write spy); scheme gate; cut lengths; `accounts` never offered.
- Unit: URL → host title; stripping; `url?` of the ToDos source (bare first line only, scheme gate).
- e2e seed `e2e/seed/share-planner.seed.spec.ts` (PWA path, GET `/share?title&text&url`): row appears under „Noch ohne Tag“ with the chip; „Rückgängig“ on the page removes it.
- `planner-hub-2.spec.ts` D2 re-measured (taps 2, switches 1, way back ja); its way-back reading changes: a link to the shared host or a control whose accessible name contains the host counts. Hand test on a real phone → `docs/MANUAL-TESTS.md` (id in the PR).
