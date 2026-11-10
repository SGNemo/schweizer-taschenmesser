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

Render the sheets (desktop 1280 + phone 360, dark and light) from `site/`:
`node ../docs/design/site/render.mjs` → `out/*.png` (git-ignored); `MOCKUPS=round-5-a,round-5-b` picks sheets, `SHEET_ROW=1` for long pages.

Since round 4 the site speaks identity v3.1: the module palette, tints and area patterns are part of the pinned token subset (`site/src/styles/tokens.css`, `identity.css`), module cards and the nine head shapes are drawn by `IdentityMini.astro` from `site/src/catalog/modules.json` (icon, hue, head, widget per module, written by `npm run gen:modules` in `web/`), so the site keeps no module list of its own. Screenshots are renewed in package 2.
