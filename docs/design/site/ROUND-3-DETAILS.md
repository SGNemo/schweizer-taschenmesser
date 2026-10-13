# Round 3 – Details, micro-interactions, screenshot automation

Chosen in round 2: **Layout 1 (Bänder)** with the "Jetzt dran" crop in the focus band, comparison
column "Übliche Apps", **no video section for now** (recording guide goes into the PR as an open
point). `round-3.html` is the refined page, `round-3-details.html` the alternatives below.

## What changed in the refinement (`round-3.html`)
- **Real screenshots** from the seeded app build (`site/scripts/app-screenshots.mjs`, see below):
  hero (1280×720) and phone (412×915) in the hero, six per-module shots behind the tiles, the
  "Jetzt dran" crop in the focus band. The only cosmetic change is the hidden "Dev" badge.
- **Typography:** H1 `clamp(2.125rem, 1.4rem + 2.8vw, 3.25rem)`, `text-wrap: balance`; H2
  `clamp(1.5rem, 1.2rem + 1.2vw, 2rem)`, max 28ch; lead 17–19 px, max 42ch; all body copy
  ≤ 60ch. Tabular numbers in the download buttons.
- **Spacing:** one block rhythm `clamp(3.5rem, 7vw, 6rem)`; bands alternate surface/background
  with a hairline; inner gaps from the 4/6/8 steps of the token scale only.
- **Download card:** both buttons filled and equal width, version line, then the trust line with
  three ticks (Open Source MIT · Kein Konto · Kostenlos, kein Tracking) separated by a hairline.
- **Tiles:** image top (16:9, `object-position` per module), icon + title, two lines; hover only
  changes the border colour (150 ms). No lift, no shadow change.
- **Frames:** desktop = thin window bar with three dots, phone = 0.3 rem bezel, both from tokens;
  no perspective, no device artwork.
- **Micro-interactions:** colour/background/border transitions at 150 ms on links, buttons, tiles,
  header controls and accordions; nothing moves; `prefers-reduced-motion` sets all durations to 0.
- **Loading:** hero image eager with `fetchpriority="high"`, everything below `loading="lazy"`
  and `decoding="async"`; one image per theme is requested (the other stays `display: none`).
  AVIF/WebP via Astro's `<Picture>` as today. Budget stays under 400 KB for the first view.
- **Header:** nav gains "Datenschutz" (anchor to the data-flow band); theme and language controls
  unchanged (see alternatives).

## Alternatives on the details sheet (`round-3-details.html`)
| # | A (recommended) | B | C |
|---|---|---|---|
| 1 Tiles | Image top, text below | Icon beside the text | – |
| 2 Frame | Window bar with three dots | No frame, shadow only | – |
| 3 Header | Icon theme switch + DE/EN pill (as today) | Labelled "Dunkel" button, language as text links | – |
| 4 Download buttons | Two lines, 12 px radius | Two lines, pill | One line, size at the end |

## Screenshot automation (built, in `site/`)
`npm run app:screenshots` builds `web/dist-e2e-seed` if missing, serves it on :4174, loads the
seed "medium" through Settings → Entwickler (same steps as the app's own capture spec), fixes
the clock to the seed date, hides the Dev badge and writes `src/assets/screens/<page>-<scheme>.png`
for light and dark: `home`, `phone`, `calendar`, `todos`, `finance`, `vault`, `reminders`.
`APP_URL=…` reuses a running preview, `SCREENS_PAGES=<regex>` filters. The app UI is German only,
so one set serves `/` and `/en`; only the alt texts differ. Open: the reminders page shows the
"Noch nicht aktiviert" notification banner (crop it or grant the permission in the context); the
vault shot shows "Unterlagen" because the accounts tab needs the demo passphrase.

## Open for the maintainer
1. Details 1–4: A everywhere, or a different pick in one row?
2. Tile set: the six above, or swap "Erinnerungen" for "Notizen/Listen"? Recommendation: keep,
   reminders are a focus feature.
3. Header nav: "Datenschutz" as fourth item, or keep three (Funktionen · Installation ·
   Unterstützen)? Recommendation: four, the privacy band is the page's second argument.
