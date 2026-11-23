# Hand-off 01 – share into the planner (package 1)

Concept: [CONCEPT-INTAKE, idea 1](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/01-share.html` (412 only matters; 1920 shows the PWA page).

## Structure (`web/src/pages/ShareTarget.tsx`, as built, with one more target)

```
Teilen                                             (page title and card as built)
┌ card ───────────────────────────────────────┐
│ Fahrradträger für die Anhängerkupplung      │  title: first line, 2 lines max
│ example.org                                 │  host, normal text (links only)
│ https://example.org/…/fahrradtraeger        │  full URL, --text-meta, middle-truncated
│ Landet unter „Noch ohne Tag“.               │  S2, --text-meta
└─────────────────────────────────────────────┘
[ ] Text als Notiz                             (as built, U17, unticked; only when a rest exists)
         (•) In den Planer   ( ) Merkliste   ( ) Notiz   ( ) ToDo   ( ) Liste
Tag      [ohne Tag] [Heute] [Morgen]          (only while „In den Planer“ is chosen)
[ Ablegen ]                                    (filled primary, full width on 412)
```

- „In den Planer“ (S1) is the first choice and preselected when the planner module is on; otherwise the page is exactly as today. The targets keep the control the page has today (a column of choices, each 44 px high, on 412; one row at 1920); the empty state keeps today's sentence.
- No second question above the choices: the page's own subline („Wohin soll der geteilte Inhalt?“) already asks.
- The card shows exactly what is stored, and nothing it does not show is stored. A link's URL is always stored (the note's first line) and always shown: host in normal text, the full URL under it in `--text-meta`, middle-truncated. The rest of a shared text is stored as the note only when he ticks the page's existing, unticked choice „Text als Notiz“ (U17, as built); the card then shows the first three lines of that rest and S5 if it was cut.
- The day choice is `DateChips` with S13 „ohne Tag“ · „Heute“ · „Morgen“; default S13. `DateChips` has fixed presets today (today / tomorrow / next week, no empty entry), so package 1 adds an additive prop `presets` (a list that may hold a null entry) in `web/src/ui/DateChips.tsx`.
- S3 „Ablegen“ → `plan.requested { title, note, day, origin: 'share', answer }`, emitted after `whenServicesSettled()` (the URL is the note's first line); the button is busy until `answer` arrives – no timeout, the handler always answers. The planner's handler shows toast S4; the page itself turns into its stored state: S8 „Abgelegt.“ with „Ansehen“ (link to the row, from `answer.key`; `?item=` unfolds „Noch ohne Tag“ since 10b), „Rückgängig“ (`answer.undo`) and S9 „Fertig“ (filled, full width on 412). So the undo does not depend on a toast that times out. `answer.undo` resolves `false` when the entry is gone (the toast's „Rückgängig“ was used): the page then hides its „Rückgängig“; when the page's own undo ran, S8 becomes S14 „Zurückgenommen.“ It stays until he taps: „Fertig“ closes back to the sharing app on Android and opens the planner in the PWA. No new native command; if the build needs one, its permission is for the webview `main` only.

## The row afterwards

A normal ToDo row under „Noch ohne Tag“. A shared link shows one chip S7 („Im Browser öffnen · example.org“) in the row's existing chip line (the line that holds ≤ 2 link chips today – no new kind of control) and in the ToDos panel. The chip is a link to the URL, or a button whose accessible name contains the host. The URL comes from the ToDos source as `PlannableItem.url?`, only for a ToDo without an `origin` link (a mail-made ToDo's note line with the webmail address never becomes a chip): the todos module derives it from the first line of the task's own note when that line is one bare http/https URL – the planner never reads a ToDo's note. Scheme and host are checked when it is read, when the chip is drawn and when it is opened; the host is `new URL(…).hostname` (no user info; punycode for non-ASCII hosts); it opens the system browser only on a tap.

## States

planner off (target missing) · nothing arrived (as built) · „Text als Notiz“ ticked (the card shows the first three lines of the rest; S5 if it was cut) · storing (button busy until `answer`) · stored (`answer.ok`) · not stored (only `answer.ok` false: S6 as `role="alert"` under the button; the card and the choice stay) · day passed (the page was left open past midnight with „Heute“: the handler refuses the passed day, S6) · taken back (S14; „Rückgängig“ hidden, also when `answer.undo` answers `false`).

## Edge cases

- Text that is only a URL: title = host + first path segment, readable („example.org/fahrradtraeger“), percent-decoded first, then stripped of control and bidi characters; never fetched.
- A URL with another scheme (`intent:`, `file:`, `javascript:`): no chip; the text stays text.
- 20 000 characters: title 160; with „Text als Notiz“ ticked the note is ≤ 4 000 and S5 shows.
- Control characters and bidi overrides are stripped from the title (existing `cleanTitle` of the capture path).
- Shared while the app shows a dialog elsewhere: the share page is its own route and replaces the history entry, as built.
- Two shares in a row: each is its own page visit; nothing is queued.

## Tests

- `ShareTarget.test.tsx`: target order with planner on / off; nothing is written before „Ablegen“ (write spy); nothing the card does not show is stored (the rest only with „Text als Notiz“ ticked; the URL always, and shown); scheme gate; cut lengths; `accounts` never offered; `answer.undo` → `false` hides „Rückgängig“; a passed day → S6.
- Unit: URL → host title; stripping; `url?` of the ToDos source (bare first line only, scheme gate, never for a ToDo with an `origin` link); `DateChips` `presets` with a null entry.
- e2e seed `e2e/seed/share-planner.seed.spec.ts` (PWA path, GET `/share?title&text&url`): row appears under „Noch ohne Tag“ with the chip; „Rückgängig“ on the page removes it.
- `planner-hub-2.spec.ts` D2 re-measured (taps 2, switches 1, way back ja); its way-back reading changes: a link to the shared host or a control whose accessible name contains the host counts. Hand test on a real phone → `docs/MANUAL-TESTS.md` (id in the PR).
