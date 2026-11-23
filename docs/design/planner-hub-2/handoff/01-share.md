# Hand-off 01 – share into the planner (package 1)

Concept: [CONCEPT-INTAKE, idea 1](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/01-share.html` (412 only matters; 1920 shows the PWA page).

## Structure (`web/src/pages/ShareTarget.tsx` as built – three blocks; what is new is marked)

```
Teilen · Wohin soll der geteilte Inhalt?           (page head as built)
┌ Geteilt ────────────────────────────────────┐
│ Fahrradträger für die Anhängerkupplung      │  the whole shared content, as built
│ https://example.org/fahrradtraeger          │  (nothing stored is hidden)
└─────────────────────────────────────────────┘
┌ Vorschlag ──────────────────────────────────┐
│ [ ] Text als Notiz                          │  as built (U17), unticked, only with a rest
│ CaptureForm (oneEntry, initialText = line)  │  line as built (`sharedLine`); NEW: initialType="plan" while the planner is on
│   … its target word S1 „Planer“, its fields │
│   … its own [ Speichern ]                   │  as built: stores on this tap (U17)
│ Landet im Planer unter „Noch ohne Tag“.     │  NEW S2, only while the type is `plan`
│ Der Link wird mit abgelegt: example.org     │  NEW S16, only for a link and only while the type is `plan`
└─────────────────────────────────────────────┘
oder im Modul öffnen                               (as built: links that open a module's form)
```

- With the planner on, the form starts with `initialType="plan"` (a ToDo plus its planner item, the capture target `plan` in `quickCapture/targets/adapters.ts`; a thing that comes into the plan this way has no planner day and lies under „Noch ohne Tag“; under `plan` the form parses as built, so a typed day word becomes the ToDo's own date, not a planner day). The line is as built (`sharedLine`); the built parser takes an address out of the title. He can change the kind in the form as built – then S2 and S16 go and the page behaves exactly as built (other capture targets drop `extra.note`). Planner off: the page is exactly as today.
- No new target list, no radio group, no day chips, no new button: the button is the form's own „Speichern“. No bus event is involved.
- S2 under the form while the type is `plan`. For shared content with an http/https address of ≤ 2 048 characters, S16 names the host, only while the type is `plan`: the address is then stored as the first line of the ToDo's note (`extra.note`) – also without the tick. A longer or non-http address is not stored as a link (it stays part of the text).
- „Text als Notiz“ as built for the rest: the rest is cut to 4 000 characters minus the address line (S5 says so when it cuts). The „Geteilt“ card shows the whole shared content as built, so every stored field is shown on the page: the title in the form, the address and the rest in the „Geteilt“ card, S16 names that the address is stored, S5 when the rest was cut.
- After „Speichern“ (`onSaved(saved)`; `saved` has `id`, `type`, `moduleId`, `undo()`): the page no longer navigates home. It shows S8 „Abgelegt.“ with „Ansehen“ (link `/planner?item=todos:<id>`, no day; 10b's `?item=` unfolds „Noch ohne Tag“), „Rückgängig“ (`saved.undo()`) and S9. One undo, kept in step: the page follows the saved ToDo live – when it is gone (the page's own „Rückgängig“ or the capture toast's) it shows S14 „Zurückgenommen.“ and no „Ansehen“ / „Rückgängig“; S9 „Fertig“ is filled, full width on 412 ( Android: back to the sharing app, PWA: opens the planner). The capture's own toast stays as built (`announceSaved`). No new native command; if the build needs one, its permission is for the webview `main` only.

## The row afterwards

A normal ToDo row under „Noch ohne Tag“. A shared link shows one chip S7 („Im Browser öffnen · example.org“) in the row's existing chip line (the line that holds ≤ 2 link chips today – no new kind of control) and in the ToDos panel. The ToDos source hands the address over as `PlannableItem.url?` only when the task's own note starts with one bare http/https address of ≤ 2 048 characters **and** the task has no legacy `links[]` entry and no `origin` link row (a mail-made ToDo's webmail address never becomes a chip). Scheme and host are checked when it is read, when the chip is drawn and when it is opened; the host is `new URL(…).hostname` (no user info; punycode for non-ASCII hosts). The chip is a link, or a control whose accessible name contains the host; it opens the system browser only on a tap. The planner never reads a ToDo's note. `url?` is display only: used for the chip, never part of the input hash, never in „Plan als Text kopieren“, the calendar chip, the widget or run titles.

## States

planner off (the page as today) · nothing shared (today's sentence) · link (S2 + S16 while the type is `plan`) · text with a rest (the tick; S5 when cut) · another kind chosen (S2 / S16 gone, the page as built) · stored (S8 with „Ansehen“, „Rückgängig“, S9) · undone (S14, no „Ansehen“ – also when the capture toast's „Rückgängig“ was used) · save failed (the form's own error as built; the card and the text stay).

## Edge cases

- Text that is only a URL: the form's line as built (the parser takes the address out of the title); S16 names the host; never fetched.
- A URL with another scheme (`intent:`, `file:`, `javascript:`) or longer than 2 048 characters: no S16, no chip; it stays text.
- 20 000 characters: the form's line as built; with the tick the rest is ≤ 4 000 minus the address line and S5 shows.
- Shared while the app shows a dialog elsewhere: the share page is its own route and replaces the history entry, as built.
- Two shares in a row: each is its own page visit; nothing is queued.

## Tests

- `ShareTarget.test.tsx`: `initialType="plan"` with the planner on, the page unchanged with it off; nothing is written before „Speichern“ (write spy); **every stored field is shown on the page** (title = the form's parsed title; address = S16; rest = the tick); the address and S16 only for http/https ≤ 2 048 and only while the kind is `plan` (another kind: `extra.note` as built); S8 → „Rückgängig“ → S14; the toast's „Rückgängig“ also turns the page to S14 without „Ansehen“; `accounts` never offered.
- Unit: `url?` of the ToDos source – a bare first note line of ≤ 2 048 characters only, scheme gate, never for a task with a `links[]` entry or an `origin` link row (a mail ToDo with `links[]` but no `_links` row yet gives no chip); display only: a `linksDisplayOnly`-style test (never in the input hash) and a `copyInput` case (never in „Plan als Text kopieren“).
- e2e seed `e2e/seed/share-planner.seed.spec.ts` (PWA path, GET `/share?title&text&url`): „Speichern“, the row appears under „Noch ohne Tag“ with the chip; „Rückgängig“ on the page removes it.
- `planner-hub-2.spec.ts` D2 re-measured (taps 2: „Speichern“, „Ansehen“; switches 1; way back ja); its way-back reading changes: a link to the shared host or a control whose accessible name contains the host counts. Hand test on a real phone → `docs/MANUAL-TESTS.md` (id in the PR).
