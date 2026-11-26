# Hand-off D – small versions, performance, tidying

Builds on round 1's package 4 (merged as #1120: `ScenePorthole`, `useSmallScene`, `cardFit`, the widget's two variants) – it does not replace it. Concept: [CONCEPT §6](../CONCEPT.md), [A11Y §4](../A11Y.md).

## Scope

`ui/weather-scene/` (`portholeSvg`, `ScenePorthole`, `useSmallScene`, `cardFit`), `home/WeatherGlance.tsx`, `modules/weather/widgets/WeatherWidget.tsx`, the perf spec and report (`e2e/perf/weather-scene.spec.ts`, `docs/perf/WEATHER-SCENES-2026-11.md`), dead code of the old drawing, round 1's docs marked.

## Steps

1. **Porthole on the new drawing:** sky, the body in its mode, the main summit of the massif with its shaded face, one cloud bank (deck) or one cloud (cover 1–3), a few marks of rain or snow; nothing of the foreground. Never moves.
2. **Widget card:** the new panorama through `cardFit`; check the words against the massif at the card's three sizes (contrast test); wide cards keep the porthole variant.
3. **Performance pass** on the product: the ceilings of A11Y §4 for the heaviest states (thunder 3 with hail and wind 3, snow 3, overcast night with banks), phone profile. Round 1 left "thunder with hail over the limit" open: precipitation runs as **one** iteration over a tile several heights long, not `5 / duration` iterations.
4. **Tidy:** remove what only the old drawing used (functions, tokens, tests); mark round 1's `PACKAGES.md` row 4 as built and superseded here; delete `docs/design/weather-scenes-2/mockups/styles.js`, `head2.js`, `p2-stile.html` only if the maintainer says so (default: keep).
5. The small versions still show no sky events – unchanged, named.

## Acceptance

Porthole tests per sky and mode · widget contrast ≥ 4.5 : 1 at 379 × 205, 379 × 282, 380 × 192 · perf report with the numbers against the ceilings, at rest about 0 ms · `check:bundle` inside its tolerance · `check:stimulus` unchanged · no `Sky`-era or round-1-drawing leftovers (`rg`) · hand test on a real Android device listed in MANUAL-TESTS.
