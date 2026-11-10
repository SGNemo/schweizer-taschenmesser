# Logo v2 – workshop

Parametric master of the Nemo logo and the tools that turn it into every brand asset. Nothing here is imported by the app. The how-to (regenerate, what the export touches) is [docs/howto/design-brand.md](../../docs/howto/design-brand.md); the decision is in [docs/decisions/ui-brand.md](../../docs/decisions/ui-brand.md) ("Logo v2").

**Mark v2.1 (2026-11-10, round 10):** the silhouette of A2b revised – pinched tail stalk and a two-lobed fan instead of the cone (`tail.style: 'lobe'`), bands that stop before the outline (`stripes.rim`), so the fish stays one piece. Everything else is as in v2: one colour, white on the accent tile, the mark in the accent token, lettering and pill unchanged. Decision: [docs/decisions/ui-brand.md](../../docs/decisions/ui-brand.md) ("Logo v2.1").

- *Why:* at 16–32 px the app icon read as a speaker symbol: bands and eye were cut through the outline, so the fish fell apart into a cone, a bar and a D.
- *How:* the two bands are cut inside the body only (clip path = the body) and a stroke of `stripes.rim` on the body outline puts the rim back – in every file that draws the fish (tile, mark, splash, Android layers).
- *Rejected:* a two-colour app icon (accent fish with white filled bands on the ocean gradient): built first, dropped by the maintainer as too 3D – the icon stays as simple as before; the old shape with turned colours; two bands cut through (three pieces); one band; head only (one colour it becomes a play symbol; rejected in v2 already).
- *Open:* README, website and social-preview screenshots show the old pill until they are retaken after Identity 4.0.

**Final of rounds 1–9 (2026-11-04):** mark **A2b** (an upright, rounded clownfish on an accent tile), name **NEMO** in an own rounded monoline lettering, both on an accent **pill** in the sidebar head. The colour is the accent token (`--accent` `#b5430c` light, `#ff9a57` dark), never a hand-picked orange.

## Files
| File | What |
|---|---|
| `final.params.mjs` | the chosen parameters (mark, lettering, pill, safe-zone radii, wordmark box); the export reads only this file |
| `mark.mjs` | parametric mark: `buildLayers(params)` for the sheets, `markGeometry(params)` for the export (exact bounding box by sampling the curves, safe-zone radius) |
| `wordmark.mjs` | the NEMO lettering (strokes, no font) and `lockupSvg` (mark + name, optionally on the pill) |
| `export.mjs` | writes `web/brand/*.svg`, the generated block in `web/src/ui/Logo.tsx` and the splash in `web/index.html`; verifies the files against the master by rendering both (`cd web && npm ci` first) |
| `render.mjs` | `node render.mjs rounds/<n>` renders a round's `variants.mjs` into SVG layers and `sheet.png` (16–512 px, light/dark, true pixels, the mark in the real sidebar and phone top bar, taskbar/tray, Android masks + safe zone + themed icon, favicon tab, palette check) |
| `tools/app-shots.mjs` | screenshots of the seeded Dev-Preview app with the brand hidden (`context/`, with boxes in `boxes.json`; the `-current` files are the old logo, the "before") |
| `tools/app-after.mjs` | screenshots of the running app with the logo in place (`rounds/9/screens/`) |
| `tools/compose.mjs` | before/after sheets from two `app-after` runs (a build of the base branch and of this branch) |
| `tools/os-mock.mjs` | mock of the shipped rasters in taskbar, tray, tab strip, PWA, Android masks and themed icon |
| `rounds/9/` | the final sheet, the final layers (`Final/`, `F4/`), the app screenshots (`screens/`) |
| `rounds/archive/` | exploration rounds 1–8 (sheets and parameters; see its README) |

## Commands
```bash
cd design/logo-v2 && node export.mjs          # brand SVGs + Logo.tsx block + splash (then prettier on index.html and Logo.tsx)
cd ../../web && npx tauri icon brand/app-icon.svg && npm run gen:icons
cd ../design/logo-v2 && node render.mjs rounds/9   # preview sheet of a round
```

## Rounds
1. Diagnosis of the old logo and four directions (A tile fish, B head and eye, C bands and fin, D line fish). Feedback: none convinces, A is best, the wordmark must not be plain type.
2. A refined (rounder body and fan tail, fins, bigger eye and curved bands, lean, bleed off the tile); the name as a fish. Feedback: A2 (with fins); no fish-word.
3. A2 one change at a time; sidebar head without a fish-word: pill, mark only, own rounded lettering. Feedback: A2b (bands follow the body) and the pill.
4. The pill with a rounder lettering (lowercase). Feedback: the weight W10b, but the e cannot be read.
5. An open e aperture; 6. a longer e bowl. Feedback: still not right, write NEMO in capitals.
7. NEMO in capitals (stroke 700/800, M vertex, spacing). Feedback: W10c3 (M vertex at half height).
8. Fine-tuning of the pill proportions. Feedback: F4 (mark 1.3, gap 0.24, padding 0.36 / 0.3).
9. The final candidate from `final.params.mjs` in every context; then "Logo final" and the asset export. (`rounds/9/variants.mjs` keeps A2b frozen, so the round still renders what it showed.)
10. Mark v2.1 (before and after): at 16–32 px the tile read as a speaker symbol, because the cut bands split the fish into a cone, a bar and a D. Tried as drawings first (old shape with turned colours, new silhouette, head only, one band, inner bands, two-colour tile). Feedback: only the new fish and the inner bands; flat as before, no second colour, no gradient.

The transparent mark of rounds 2–8 was cut off at its box: the fan tail's convex back edge reached 12 units further out than the box built from the tail length. The master now samples the curves; the tile, the app icons and the sheets of round 9 show the whole tail.
