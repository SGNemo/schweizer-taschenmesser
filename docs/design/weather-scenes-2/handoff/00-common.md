# Hand-off 00 – common to every package of round 2

Read after [PACKAGES #common](../PACKAGES.md#common). Sources of truth, in this order: the built state ("as built" in [PACKAGES](../PACKAGES.md) and in round 1's [PACKAGES](../../weather-scenes/PACKAGES.md)) → your prompt → the concept section it names → this hand-off and yours → [COPY](../COPY.md).

## The drawing is the spec

`mockups/scene.js` + `palette.js` are ported **shape by shape**: the same points, the same counts, the same order of layers. `G` in `scene.js` is the geometry block – keep its names in `ui/weather-scene/draw.ts`. Not redesigned: no "nicer" mountain, no other tree. A real gap (a state the mockup does not draw) is closed the smallest way and named in the PR.

`mockups/styles.js`, `head2.js`, `p2-stile.html` are the record of the style choice only – nothing is ported from them.

## Scene state (additions to round 1's `SceneState`)

| Field | Type | From ([CONCEPT §3](../CONCEPT.md)) |
| --- | --- | --- |
| `cover` | `0 \| 1 \| 2 \| 3 \| 4` | `coverOf(h)` |
| `veil` | `boolean` | `veilOf(h)` |
| `sun` | `0 \| 1 \| 2 \| 3` | `sunLevel(h, cover)` |
| `intensity` | `1 \| 2 \| 3` | as round 1 (code), with the amount as fallback |
| `thunder` | `0 \| 1 \| 2 \| 3` | `thunderLevel(code, mm, gust, cape)` |
| `fog` | `0 \| 1 \| 2` | `fogLevel(code, vis)` |
| `snowCover` | `0 \| 1 \| 2 \| 3` | `snowCoverOf(depthM, snowLevel)` (replaces the boolean of round 1) |
| `wind` | `0 \| 1 \| 2 \| 3` | `windLevel` (exists) |
| `windTo` | `'left' \| 'right'` | `windTo(dirDeg)` |
| `wet` | `boolean` | `wetOf(h, previousHour)` |
| `mode` | `'clear' \| 'veil' \| 'hole' \| 'schein' \| ''` | `bodyMode(state)` |

`sceneOf` takes the hour it draws: `sceneOf({ forecast, hour, at, nowMs, lat, theme, calm, level, motion, moon, event })` – `hour` is an hour row (package C passes a chosen one); without it the current values are used as today. All level functions are pure, exported from `core/weather/scene.ts`, and tested as tables (data → level) – one table per row group of CONCEPT §3.

## Hour row and forecast (names fixed here so A and B can run side by side)

Optional fields added to `HourRow` (`core/weather/api.ts`) and the cache schema: `snow` (cm), `snowDepth` (m), `vis` (m), `cloudLow`, `cloudMid`, `cloudHigh` (%), `sunMin` (0–60), `dew` (°C), `cape` (J/kg), `freeze` (m). `Forecast.soon?: { at: string; mm: number[] }` (eight 15-minute amounts from `at`). `Air.hours?: { t: string; aqi: number }[]`. Package A reads them as optional (its own narrow input type until B lands); package B fetches, parses, caches and shows them.

## Layers and parts

`data-layer` values, in draw order: `sky`, `stars`, `body`, `cloudsFar`, `clouds`, `ridgeAlp`, `fog`, `ridgeFar`, `ridgeMid`, `water`, `ridgeNear`, `event`, `precip`, `wind`. Inside them `data-part` names what tests look for: `banks`, `rim`, `shreds`, `opening`, `spill`, `schein`, `caps`, `ribs`, `shade`, `mirror`, `ripples`, `whitecaps`, `glitter`, `boat`, `jetty`, `cabin`, `shed`, `window`, `smoke`, `flag`, `pole`, `fence`, `trees`, `treesBehind`, `staffel`, `leafy`, `grass`, `flowers`, `fallen`, `puddles`, `sparkle`, `shadows`, `sunband`, `shimmer`, `hoar`, `iceRim`, `glaze`, `splash`, `hail`, `glow`, `leaves`, `dust`, `streaks`, `spindrift`.

## Tokens

Every hex of `palette.js` becomes a `--scene-*` token in `ui/tokens.css` (dark skies in both dark blocks, as round 1 did): `--scene-sky-<key>-<i>` (changed: `night-overcast`, `night-rain`, `night-snow`, `day`, `rain`, `storm`), new `--scene-deck-<sky>-<0..4>`, `--scene-light-<sky>` with its two numbers as constants in `draw.ts`, `--scene-land-<season>-<rock|mid|f1|f2|near|meadow|dark>` and `-crown-<1..3>`, and the `c` block (`--scene-<name>`). `ui/tokens.css` and `ui/tokens.test.ts` are ratchet-protected: append, list the hit in the PR, wait for the label.

## Sizes

Desktop stage 320 px (`layout/AreaFrame.module.css`, `.stage[data-signature='sky']`); the head-height seed spec's limit for weather moves with it (ratchet hit). Phone: picture 256 px; hints, two chips and rest line move out of the stage into the page, directly under it. `useSceneFit`: phone scale 0.56, body x at `G.phoneBodyX`, `quietX` 700; desktop `quietX` at the text column's right edge as today.

## Ceilings and guards

[A11Y §4](../A11Y.md) holds the numbers (elements, markup, animated groups, paint). `check:stimulus`: the head's height changes (named hit); the counts of buttons change only in package C ([CONCEPT-INFO §5](../CONCEPT-INFO.md)). Privacy tests, the connection log tests and the `weather` destination stay as they are; package B changes the list of values in the DATA-FLOWS row and says so.
