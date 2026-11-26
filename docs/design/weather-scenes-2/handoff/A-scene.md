# Hand-off A – scene v2

Concept: [CONCEPT](../CONCEPT.md) (all of it), [A11Y](../A11Y.md). Drawing: `mockups/scene.js`, `palette.js`, `events.js`, `scene-motion.css`. Gallery to compare against: `mockups/p3-*.html` (render with `render.mjs`).

## Scope

`core/weather/scene.ts` (levels, state, sky key, body mode), `ui/weather-scene/draw.ts` (the whole drawing), `WeatherScene.tsx`, `WeatherScene.module.css` (motion), `useSceneFit.ts`, `useSceneMotion.ts`, `contrast.test.ts`, `ui/tokens.css` (+ test), the head's size and the phone's layout (`modules/weather/components/WeatherHero.tsx`, `routes/weather.module.css`, `layout/AreaFrame.module.css`), the thunder and fog words (`conditionId` → level words, COPY §1 and §8).

## Steps

1. **Levels first, no drawing:** the pure functions of [00-common](00-common.md) with their table tests (CONCEPT §3, one `it.each` per group; every limit once on each side).
2. **Palette → tokens.**
3. **Port `draw.ts` layer by layer** in the order of 00-common, each with a test that the layer and its parts exist for the states that need them and are absent otherwise. Keep `sceneSvg(state, { quietX, extendTop, bodyAt, idPrefix })`. The mockup's `view` is what `useSceneFit` computes.
4. **Skylines once:** each forest skyline and the staffel of firs is drawn once in `<defs>` and placed with `<use>` where it repeats (snow tips are a second `<use>` of a tips path) – that is how the markup ceiling is met. Paths keep one decimal.
5. **Body modes** (CONCEPT §2): `data-mode` on the body; tests: for every sky key with the body above the horizon a `[data-layer="body"]` exists and is not covered by an opaque element (overcast: drawn after the deck; the bank that overlaps covers less than a quarter of the disc – assert on geometry, not on pixels).
6. **Events** from `events.js` into the same slots round 1 used.
7. **Motion** from `scene-motion.css`; the glow: one animation, `animation-iteration-count: 1`, started 1 s after `data-motion="run"`, absent under every off switch (CONCEPT §7).
8. **Head:** stage 320; phone: hints, chips and rest line under the picture (COPY unchanged), picture 256.
9. **Words:** thunder and fog words by level, and "Schleierwolken" for a veil (COPY §1), in head, hour cards, day rows, widget, overview line, trip weather – same function everywhere. The veil needs the three cloud heights: the function is built and tested here and starts to show once package B delivers the fields.

## Edge cases

- No `hour` and a cache without the new fields: cover from `cloud`, sun from cover, thunder 2, fog 1, snow cover from `now.snowDepth` – nothing crashes, nothing invented.
- Polar day / night; southern hemisphere seasons; a moon below the horizon (no body, no banks' lit rims: the banks are drawn unlit and the opening is left out).
- `windTo: 'left'`: smoke, flag, lean, rain, leaves, cloud shear mirror; the flag must not cross the shed. The mockup's default (`'right'`) is an easterly in the northern hemisphere – the gallery labels say nothing else.
- "Schlicht" under a deck: body in `schein`. "Ruhig": no glow animation.
- Thunder at night: sky `night-rain`, banks none, the bolts as by day.

## Not in this package

New request variables, cache, any value on the page (B). Choosing days or hours (C). Porthole and widget card (D) – they keep working on the old drawing only if `portholeSvg` and `cardFit` still get what they need: keep their exports compiling and name in "as built" what D has to redo.

## Acceptance

Level tables green · the body visible in every sky (test of step 5) · `contrast.test.ts` extended to the new skies, deck tones and the phone crop, ≥ 4.5 : 1 · ceilings of A11Y §4 asserted · no animation with reduced motion / "Standbild" / "Ruhig" / hidden page; the glow runs once · the head-height seed spec untouched and green; `check:stimulus` inside its tolerances · privacy and connection-log tests untouched · pictures: the three scenes of the stop and six more at 1920 and 412, light and dark, beside their mockups.
