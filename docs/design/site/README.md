# Website design rounds (`site/`)

Design work for the download website, done in rounds with the maintainer choosing between
variants. Rules: [DESIGN-SPEC](../DESIGN-SPEC.md), [FOCUS-GUIDELINES](../FOCUS-GUIDELINES.md),
`site/README.md`. Mockups are standalone HTML (tokens = `site/src/styles/tokens.css`, fonts from
`../mockups/fonts`, screenshots with test data only in `assets/`).

| Round | File | Result |
|---|---|---|
| 1 Diagnosis and direction | [ROUND-1-DIAGNOSIS.md](ROUND-1-DIAGNOSIS.md), `direction-{a,b,c}.html` | open |

Render the sheets (desktop 1280 + phone 360, dark and light) from `site/`:
`node ../docs/design/site/render.mjs` → `out/*.png` (git-ignored).
