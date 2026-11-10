# Website design rounds (`site/`)

Design work for the download website, done in rounds with the maintainer choosing between
variants. Rules: [DESIGN-SPEC](../DESIGN-SPEC.md), [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md),
`site/README.md`. Mockups are standalone HTML (tokens = `site/src/styles/tokens.css`, fonts from
`../mockups/fonts`, screenshots with test data only: `assets/` for rounds 1–2, `site/src/assets/screens` from round 3).

| Round | File | Result |
|---|---|---|
| 1 Diagnosis and direction | [ROUND-1-DIAGNOSIS.md](ROUND-1-DIAGNOSIS.md), `direction-{a,b,c}.html` | C + tiles from B, claim C, both buttons filled |
| 2 Full page layout | [ROUND-2-LAYOUT.md](ROUND-2-LAYOUT.md), `layout-{1,2}.html` | Layout 1, "Übliche Apps", video later |
| 3 Details and automation | [ROUND-3-DETAILS.md](ROUND-3-DETAILS.md), `round-3.html`, `round-3-details.html` | open |
| 4 Identity v3.1 (diagnosis, target, directions, catalogue) | [ROUND-4-IDENTITY-V3.md](ROUND-4-IDENTITY-V3.md), `round-4-{a,b}.html` (+ `round-4.css`), sheets in `round-4/` | B „Schaufenster“, area subtitles, cards replace the tiles, head strip under the hero; built (package 1), screenshots in package 2 |
| 5 After Identity 4.0 (re-measurement of W1–W6, flat vs. depth) | [ROUND-5.md](ROUND-5.md), `round-5-{a,b}.html` (+ `round-5.css`) | B „Tiefe“ with the anchor bar from A, one entrance movement, preview modules as one row; packages 2–4 built (result table in ROUND-5.md), pictures after 0b-8 |
| Rethink, raw phase without app pictures | [RETHINK.md](RETHINK.md), picture slots [SLOTS.md](SLOTS.md) | C „Ein Tag“ with the ledger from B, statement „Eine Sache zuerst.“, tone "show"; built on every page, no app picture; pictures later through the slots |

Render the sheets (desktop 1280 + phone 360, dark and light) from `site/`:
`node ../docs/design/site/render.mjs` → `out/*.png` (git-ignored); `MOCKUPS=round-5-a,round-5-b` picks sheets, `SHEET_ROW=1` for long pages.

Since round 4 the site speaks identity v3.1: the module palette, tints and area patterns are part of the pinned token subset (`site/src/styles/tokens.css`, `identity.css`), module cards and the nine head shapes are drawn by `IdentityMini.astro` from `site/src/catalog/modules.json` (icon, hue, head, widget per module, written by `npm run gen:modules` in `web/`), so the site keeps no module list of its own. Screenshots are renewed in package 2.

## Building blocks of the site (since the rethink round)

Tokens: `site/src/styles/tokens.css` = the app's colours and scale (pinned by `scripts/tokens.test.mjs`) plus the
site-only tokens listed there as `SITE_ONLY` (`--font-site`, `--weight-heavy`, `--text-display`, `--text-time`,
`--text-lead`, `--section`, `--line`, `--rule`, `--content-w`, `--gutter`, `--block`, `--text-h2`) and the five
`--palette-*` accents (pinned to `web/src/ui/supporterThemes.css`). No colour literal and no inline style anywhere
else (test). One typeface: Atkinson Hyperlegible Next, weight 800 for headlines and times.

| Block | Where | Use | Rules |
|---|---|---|---|
| Slot | `components/Slot.astro`, `src/slots.js` | every picture place | fixed ratio per breakpoint, one alt text; drawing now, picture later ([SLOTS.md](SLOTS.md)) |
| Stage | `.stage` (`global.css`) | ground of a drawn placeholder | neutral surface with a trace of one module colour (`data-hue`), text AA on it |
| Downloads | `components/Downloads.astro` | both download buttons | always with version, the sentence about the install warning and the link to `/install` |
| Ledger | `components/Ledger.astro`, i18n `ledger` | "what goes online" | table from 48rem, labelled blocks below; `short` on the start page; rows follow `docs/user/security.md` |
| Time rail | `components/Home.astro` (`.moment`) | the day on the start page | time in `--text-time`, one scene, one slot; a rule (`--rule`) opens each moment |
| Ruled section | `.ruled` | every section of an inner page | opens with a `--rule` line in text ink; heading left, content right from 64rem |
| Page head | `.page-head`, `.lead` | inner pages | one `h1`, one lead; optional slot or diagram beside it |
| Dot / chip | `.dot`, `.chip` | module and area names | the only place a module colour appears, always next to the name |
| Buttons, links | `.btn`, `.more` | actions | accent only here and on the "start" pill; 44 px high; hover and focus change colour only |

Checks: `npm test` (tokens, slots, catalogue, links, legal), `npm run a11y` (axe WCAG 2.1 AA plus contrast inside
drawings, target size, overflow, heading order; all pages, 360 and 1280, light and dark), `npm run lighthouse`.
