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

Render the sheets (desktop 1280 + phone 360, dark and light) from `site/`:
`node ../docs/design/site/render.mjs` → `out/*.png` (git-ignored); `SHEET_ROW=1` for long pages.
