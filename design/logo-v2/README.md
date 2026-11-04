# Logo v2 – design rounds

Workshop for the new mark, wordmark and app icons (branch `design/logo-v2`). Nothing here is imported by the app; the final assets are exported from the master after "Logo final". The previous logo workshop stays in [`../icon/`](../icon/) until the assets are replaced.

## Files
| File | What |
|---|---|
| `mark.mjs` | parametric master: four directions (`tile`, `head`, `bands`, `line`), each built from a few shapes in a 512 canvas; `buildLayers(direction, params)` returns mark, one-colour, app tile, Android layers and the mark's box. Colours default to the accent tokens (`COLORS`). |
| `wordmark.mjs` | "Nemo"/"nemo" set in Inter from `glyphs-inter.json` (outlines, no font at run time): `wordPath`, `wordSvg`, `lockupSvg` (mark + word, aligned on the cap or x-height). |
| `glyphs-inter.json` | Inter and Inter Display 500/600/700/800 outlines of N n e m o (1000 units per em; `tools/extract-glyphs.mjs`, needs `npm i` here for opentype.js and the Inter OTFs). |
| `render.mjs` | renders a round: `node render.mjs rounds/<n>` reads `rounds/<n>/variants.mjs`, writes every variant's SVG layers, lockups and `sheet.png` (sizes 16–512 light/dark, one-colour, true pixels, the mark in the real shell, taskbar/tray, Android masks + safe zone + themed icon, favicon tab, palette check). Uses Playwright's Chromium from `web/node_modules` (`cd web && npm ci` first). |
| `tools/app-shots.mjs` | screenshots of the seeded Dev-Preview app with the brand image hidden (`context/`, boxes in `boxes.json`), so the sheet can montage a candidate into the sidebar (wide + rail), and the phone top bar. `cd web && npm run build:e2e-seed && npm run preview:e2e-seed`, then `npm run shots`. |
| `rounds/<n>/` | one folder per feedback round: `variants.mjs` (parameters), `sheet.png`, `<label>/` with the SVG layers + `params.json`. Older rounds move to `rounds/archive/` at the end. |

## Rounds
- **Round 1 (2026-11-04):** diagnosis of the current logo (wordmark Q2 + tile fish C12 in #E0550F) and four directions: A tile fish, B head and eye, C bands and fin (geometric), D line fish in the icon stroke; wordmark settings W1–W4 (Inter 600/700, Display 500; "Nemo"/"nemo"). Waiting for feedback.
