# Hand-off 01 – share into the planner (package 1)

Concept: [CONCEPT-INTAKE, idea 1](../CONCEPT-INTAKE.md). Common parts: [00-common](00-common.md). Mockup: `../mockups/01-share.html` (412 only matters; 1920 shows the PWA page).

## Structure (`web/src/pages/ShareTarget.tsx` as built – three blocks; what is new is marked)

```
Teilen · Wohin soll der geteilte Inhalt?           (page head as built)
┌ Geteilt ────────────────────────────────────┐
│ Fahrradträger für die Anhängerkupplung      │  the raw content, as built
│ https://example.org/fahrradtraeger          │
│ + 3 weitere Zeilen                          │  NEW S17: what the card does not show
└─────────────────────────────────────────────┘
┌ Vorschlag ──────────────────────────────────┐
│ [ ] Text als Notiz                          │  as built (U17), unticked, only with a rest
│ CaptureForm (oneEntry, initialText = line)  │  NEW: initialType="plan" while the planner is on
│   … its target word S1 „Planer“, its fields │
│   … its own [ Speichern ]                   │  as built: stores on this tap (U17)
│ Landet im Planer unter „Noch ohne Tag“.     │  NEW S2, only while the type is `plan`
│ Der Link wird mit abgelegt: example.org     │  NEW S16, only for a link
└─────────────────────────────────────────────┘
oder im Modul öffnen                               (as built: links that open a module's form)
```

- With the planner on, the form starts with `initialType="plan"` (a ToDo plus its planner item, the capture target `plan` in `quickCapture/targets/adapters.ts`; a thing that comes into the plan this way has no day and lies under „Noch ohne Tag“). He can change the kind in the form as built; a day is typed in the line as everywhere in quick capture („… morgen“). Planner off: the page is exactly as today.
- No new target list, no radio group, no day chips, no new button: the button is the form's own „Speichern“. No bus event is involved.
- S2 under the form while the type is `plan`. For shared content with an http/https address of ≤ 2 048 characters, S16 names the host: the address is stored as the first line of the ToDo's note (`extra.note`) – always, also without the tick. A longer or non-http address is not stored as a link (it stays part of the text).
- „Text als Notiz“ as built for the rest: the rest is cut to 4 000 characters minus the address line (S5 says so when it cuts). The „Geteilt“ card names what it does not show with S17.
- After „Speichern“ (`onSaved(saved)`; `saved` has `id`, `type`, `moduleId`, `undo()`): the page no longer navigates home. It shows S8 „Abgelegt.“ with „Ansehen“ (link `/planner?item=<row key from saved>`; 10b's `?item=` unfolds „Noch ohne Tag“), „Rückgängig“ (`saved.undo()`, then S14 „Zurückgenommen.“ and the buttons go) and S9 „Fertig“ (filled, full width on 412; Android: back to the sharing app, PWA: opens the planner). The capture's own toast stays as built (`announceSaved`). No new native command; if the build needs one, its permission is for the webview `main` only.

## The row afterwards

A normal ToDo row under „Noch ohne Tag“. A shared link shows one chip S7 („Im Browser öffnen · example.org“) in the row's existing chip line (the line that holds ≤ 2 link chips today – no new kind of control) and in the ToDos panel. The ToDos source hands the address over as `PlannableItem.url?` only when the task's own note starts with one bare http/https address **and** the task has no legacy `links[]` entry and no `origin` link row (a mail-made ToDo's webmail address never becomes a chip). Scheme and host are checked when it is read, when the chip is drawn and when it is opened; the host is `new URL(…).hostname` (no user info; punycode for non-ASCII hosts). The chip is a link, or a control whose accessible name contains the host; it opens the system browser only on a tap. The planner never reads a ToDo's note.

## States

planner off (the page as today) · nothing shared (today's sentence) · link (S2 + S16) · text with a rest (the tick; S17 on the card; S5 when cut) · stored (S8 with „Ansehen“, „Rückgängig“, S9) · undone (S14, buttons gone) · save failed (the form's own error as built; the card and the text stay).

## Edge cases

- Text that is only a URL: the form's line is the URL as built; S16 names the host; never fetched.
- A URL with another scheme (`intent:`, `file:`, `javascript:`) or longer than 2 048 characters: no S16, no chip; it stays text.
- 20 000 characters: the form's line as built; with the tick the rest is ≤ 4 000 minus the address line and S5 shows.
- Shared while the app shows a dialog elsewhere: the share page is its own route and replaces the history entry, as built.
- Two shares in a row: each is its own page visit; nothing is queued.

## Tests

- `ShareTarget.test.tsx`: `initialType="plan"` with the planner on, the page unchanged with it off; nothing is written before „Speichern“ (write spy); **every stored field is shown or named on the page** (title = the form's line, address = S16, rest = the tick with S17); the address only for http/https ≤ 2 048; S8 → „Rückgängig“ → S14; `accounts` never offered.
- Unit: `url?` of the ToDos source – a bare first note line only, scheme gate, never for a task with a `links[]` entry or an `origin` link row (a mail ToDo with `links[]` but no `_links` row yet gives no chip).
- e2e seed `e2e/seed/share-planner.seed.spec.ts` (PWA path, GET `/share?title&text&url`): „Speichern“, the row appears under „Noch ohne Tag“ with the chip; „Rückgängig“ on the page removes it.
- `planner-hub-2.spec.ts` D2 re-measured (taps 2: „Speichern“, „Ansehen“; switches 1; way back ja); its way-back reading changes: a link to the shared host or a control whose accessible name contains the host counts. Hand test on a real phone → `docs/MANUAL-TESTS.md` (id in the PR).
