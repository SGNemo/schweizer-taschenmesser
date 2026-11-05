# Round 4 – Identity v3.1 on the website: diagnosis, target, two directions, catalogue

Base: `develop` 2026-11-05 (site built locally, `npm run screenshots` at 360/1280/1920, light and dark) next to the seeded Dev-Preview build of the app on the same `develop` (identity v3 pages of the group chats; the v3.1 foundation fix `feat/identity-v3-frame` is still open, so the app sheets show the v3 head band). Sheets: `round-4/site-today-{light,dark}.jpg` (1920 · 1280 · 360, first 2 600 px) and `round-4/app-develop-{light,dark}.jpg` (overview, library, calendar, finance, pantry, notes, documents, phone). Mockups: `round-4-a.html`, `round-4-b.html` (shared `round-4.css`; sheets `round-4/round-4-{a,b}.jpg`, render with `MOCKUPS=round-4-a,round-4-b SHEET_ROW=1 node ../docs/design/site/render.mjs`).

## Diagnosis – what still speaks the old language
- **Colour fields and silhouettes:** the hero sits on a warm wash (`--hero-wash`) with three fish silhouettes (`--hero-reef`). The silhouettes are the **old mark v1** (the inline `#nemo-mark` symbol in `Hero.astro` with diagonal cut bands); the header `<img>` next to it is v2. The app has no wash anywhere: identity colour sits on plates, tints, hairlines and chips only.
- **Accent as decoration:** every icon on the page (feature tiles, data nodes, focus aids, trust ticks aside) is `--accent` orange. In the app the accent is the primary action and "today"; a module icon is drawn in its hue on a solid plate (sidebar, library, head).
- **Stripes:** `.note`, `.placeholder` and the data `.aside` carry a 3 px `border-left` – banned app-wide by the stripe rule (`ui/noStripes.test.ts`).
- **Tiles:** six 16:9 tiles with zoomed screenshot crops of the **pre-v3 app** (orange module stripes, old sidebar, old attention cards); the "Alle 24 Module" fold is a plain `dl` without area tint, colour, icon or shape.
- **Sections:** `section.band` = `--surface` with hairlines, the rest `--bg`; no pattern, no group tint. The app groups modules in neutrally tinted blocks with the area pattern (library, sidebar).
- **Typography and spacing:** Inter, the h1/h2/lead scale and the block rhythm from round 3 match the app; cards use `--radius-lg/xl` and `--shadow-1` (the app's v3 cards are hairline, shadow only on heads) – minor.
- **Icons:** Lucide 1.5 px as in the app (keep); `Icon.astro` knows six hand-picked icons, none of the 24 module icons.
- **Phone (360):** one long grey column – six tiles stacked before any area; the download card fills the first screen (keep).
- **Brand:** header and favicon are v2 (`copy-brand.mjs` from `web/brand`, `web/public`). The OG image `docs/brand/social-preview.de.png` shows the v2 wordmark with a **pre-v3 app screenshot** (orange active capsule) – renew in package 2 with `npm run gen:social` after the new screenshots.
- **Tokens:** `site/src/styles/tokens.css` has none of the identity set (`--mod-*`, `--head-tint-0/1`, `--widget-tint`, `--group-tint`, `--pattern-head/widget`, area patterns, `[data-hue]`); `tokens.test.mjs` pins 14 colours plus the scale.
- **Keep:** no JS, CSP, theme switch, release data, calm wording, install accordions, Ko-fi card, focus band, comparison table, 150 ms colour transitions, reduced motion, image loading rules.

## Target in words
The website is the app's shop window and uses the app's language:
- **Surfaces, not colour fields:** `--surface`/`--surface-2` with the neutral group tint (`--group-tint` of `--text-3`, F07) for bands and area blocks; the hero wash and the silhouettes go. One accent (download, links, "today"), nothing else orange.
- **No stripes:** notes and asides become hairline cards.
- **Module cards in the module's colour:** `[data-hue]` → `--module-color` (same selectors as the app, no inline style), head zone `--head-flat` (14 % tint over `--surface`), solid plate with the icon in `--surface`, text `--text`, hover = border in the hue.
- **Area sections** as neutral group blocks with the area pattern at `--pattern-widget`, heading + count + one subtitle line (new text, five languages).
- **Head silhouettes as illustration:** the nine variants as small drawn heads (CSS and inline SVG, no JS, no text, each on its hue and area pattern).
- **Widget miniatures** as in the module library (`pages/library/WidgetMiniature`): boxes and bars in the hue, never data.
- One accent, no animation except 150 ms colour changes, `prefers-reduced-motion`, measure 68 ch, AA (text on a tint is `--text`), touch ≥ 44 px.
- Screenshots keep window bar and phone bezel; the files are renewed in package 2 (after identity packages 0–3), so `Shot` only needs the names and sizes to stay.

## Two directions
| | A – Ruhig (`round-4-a.html`) | B – Schaufenster (`round-4-b.html`) |
|---|---|---|
| Hero | copy, download card, one framed overview shot | copy, download card, overview + phone; below it the **head-silhouette strip** (nine drawn heads with captions) |
| Modules | six neutral area blocks, 24 compact cards (plate, name, state, one line) | same blocks; every card carries the **widget miniature** of its variant |
| Rest | identical: data flow as hairline cards, focus band, comparison, Ko-fi, install | identical |
| Length desktop / phone | ≈ 6 450 / ≈ 9 700 px (today 5 300 / 7 700) | ≈ 7 500 / ≈ 12 300 px |
| Strength | calmest, least CSS; one hue and one line per card; nothing to maintain when a widget changes | shows the system (colour and shape) without a screenshot; the library look a user meets in the app; survives screenshot churn |
| Risk | colour is the only module cue; the hero carries the whole proof | more elements per card (stimulus), ≈ 150 lines more CSS; the miniatures must follow `identity.widget` (catalogue field) |

**Recommendation: B.** Today the page needs six screenshots to say what Nemo is; with B the module section says it with colour and shape and no image, so package 2 only renews the hero and focus shots. The stimulus stays bounded: one hue per card, one sketch without text, the strip is one row and one component. Fallback: B without the strip (A's hero), if the strip feels like too much.

## Catalogue extension (`web/scripts/gen-module-list.mjs`)
Additive fields per module from `manifest.identity` and `manifest.icon`, so the site keeps no second truth: `hue`, `hue2` (optional), `head`, `widget`, `icon` (Lucide name as in `ui/icons.tsx`). Areas need nothing new (the pattern follows the area id). Guard: a test in `web/scripts/lib` that every module in `site/src/catalog/modules.json` carries `hue`/`head`/`widget`/`icon` from the fixed lists (`MODULE_HUES`, `HEAD_VARIANTS`, `WIDGET_VARIANTS`). Site side: `Icon.astro` gets the 24 module icons, `IdentityMini.astro` draws miniature and head from the catalogue fields, a card is `[data-hue]`/`[data-hue2]`. E-Mail moves to `schreib`/`notiz` with package 0; the JSON follows the manifest on the next `npm run gen:modules`. `widgetType` is dropped in v3.1 and not exported.

## Open for the maintainer
1. Direction A or B? Recommendation: B (fallback: B without the strip).
2. Area subtitles ("Der Tag, die Woche, die Leute." …): keep as one new line per area in five languages, or count only? Recommendation: keep.
3. The six screenshot tiles: replace them by the module cards (as mocked) or keep three above the cards? Recommendation: replace; hero and focus band keep two shots.
4. Head strip (B): under the hero as mocked, or above the module section? Recommendation: under the hero, it explains the cards that follow.
