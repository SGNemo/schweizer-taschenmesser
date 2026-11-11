# Website picture slots – hand-over for the screenshot chat

The site runs without a single app picture ([RETHINK.md](RETHINK.md)). Every picture place is a **slot**: a named
place with a fixed aspect ratio. A drawing fills it today; an app picture of the same ratio drops in later and
nothing around it moves (measured: all slot boxes and page heights identical with and without pictures).

Source of truth: `site/src/slots.js` (names, ratios, capture sizes, app targets). Component: `site/src/components/Slot.astro`.
Checked by `site/scripts/catalog.test.mjs` (ratio known to the stylesheet, capture size has the ratio, none or all four files).

## What the screenshot chat does

1. Wait until the app's UI is final (identity decision of `review/ui-audit-2026-11` built).
2. In `site/src/slots.js`: for every slot with `app.todo`, add the missing step to `site/scripts/app-screenshots.mjs`
   (open focus mode, type into quick capture) and set `app.clip` to the selector of the element the picture shows.
3. `cd site && npm run app:screenshots` (seeded Dev-Preview build, invented data only). It writes
   `site/src/assets/slots/<name>-{desk,phone}-{light,dark}.png`.
4. Rewrite the slot's alt text in `site/src/i18n/{de,en}.ts` (rule below), delete the drawing's markup and styles
   from the page component once all slots of that page have pictures.
5. `npm test`, `npm run build`, `npm run a11y`, `npm run lighthouse` (+ `-- --dark`).

A slot shows pictures only when all four files exist; one to three files fail the build and the test.

## The slots

Rendered size = the slot's box in CSS px at that viewport width (measured on the built page). Capture size is what
`app-screenshots.mjs` shoots (desktop at 1×, phone at 2×).

| Slot | Page | Shows | Ratio ≥ 48rem | Ratio < 48rem | 360 | 768 | 1280 | 1920 | Capture desk | Capture phone | App target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `now` | start, hero | the card "Jetzt dran" with first step and duration | 4:3 | 4:5 | 328×410 | 729×547 | 581×436 | 600×450 | 1280×960 | 412×515 | `/`, cut to the card (todo) |
| `plan` | start, 07:40 | the plan for today on the overview | 4:3 | 4:3 | 328×246 | 345×259 | 467×350 | 479×359 | 1280×960 | 412×309 | `/`, cut to the plan (todo) |
| `focus` | start, 10:15 | focus mode: task, steps, ring timer | 4:3 | 4:3 | 328×246 | 345×259 | 467×350 | 479×359 | 1280×960 | 412×309 | `/`, focus mode opened (todo) |
| `capture` | start, 13:05 | quick capture with „morgen 15 Uhr Zahnarzt“ and the recognised entry | 4:3 | 4:3 | 328×246 | 345×259 | 467×350 | 479×359 | 1280×960 | 412×309 | `/`, quick capture opened (todo) |
| `money` | start, 18:30 | budgets with their bars | 4:3 | 4:3 | 328×246 | 345×259 | 467×350 | 479×359 | 1280×960 | 412×309 | `/budgets` |
| `library` | modules, head | the module library with its switches | 4:3 | 4:3 | 328×246 | 729×547 | 516×387 | 533×400 | 1280×960 | 412×309 | `/library` |

Under 48rem the phone capture is shown, from 48rem the desktop capture. A 1280-px capture is shown at about
470–730 px: app text of 14 px lands near 5–8 px, so **cut to the element** (`app.clip`) instead of shooting a whole
page; the picture should hold one thing, as the drawing does.

## Rules for a picture

- **Ratio:** exactly the slot's; the stylesheet crops with `object-fit: cover`, so a wrong ratio loses its edges.
- **Themes:** always both, light and dark. The page shows the one that matches the visitor's theme; the other is
  never requested.
- **Content:** seeded test data only (`web` seed "medium"), fixed clock, no Dev badge, no personal data, no
  preview module. What the picture shows must be what the text beside it says.
- **Corners and frame:** none in the file. The slot rounds the corners (`--radius-xl`) and needs no bezel.
- **Formats:** PNG in the repository; the build makes AVIF and WebP in several widths.
- **Loading:** lazy; the box has its size before the picture arrives (no layout shift).

## Alt text

- Today (drawing): describes the drawing and ends with "Gezeichnet, kein Bild aus der App." / "Drawn, not a
  picture of the app."
- With a picture: one sentence that says what is on it and that the data is invented, for example „Die Karte
  ‚Jetzt dran‘ mit erfundenen Beispieldaten: eine Aufgabe, der Knopf ‚Anfangen · 5 Min‘ und ‚Später‘.“ No "Bild von",
  no file names, both languages, at most about 200 characters.
- The sentence next to the slot must stand without the picture; the alt text never carries a fact the text lacks.

## Not a slot

The diagram "Bei dir / Internet" on `/daten` is a drawing with a text alternative and stays one. The social
preview (`docs/brand/social-preview.de.png`) and the README pictures are outside this table.
