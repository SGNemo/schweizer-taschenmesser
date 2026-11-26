# Weather scenes – performance pass (package 4, 2026-11)

Handoff [04-small.md](../design/weather-scenes/handoff/04-small.md) "Performance pass", ceilings from
[A11Y §4](../design/weather-scenes/A11Y.md). Measured 2026-11-26 on `feat/weather-scene-small` @ `81ad06a10` (product
code as in `d0064b387`), e2e build (`npm run build:e2e`, served by `vite preview` on :4173), 4-core sandbox, headless
Chromium with software raster. Compare rows, not absolute values.

## How measured

- `web/e2e/perf/weather-scene.spec.ts` (manual tooling, its header says how to run it; JSON per run in
  `node_modules/.cache/weather-scene`). Projects `desktop-chrome` (1280×720) and `pixel-7`, CPU ×4 through CDP
  `Emulation.setCPUThrottlingRate`, network mocked like `e2e/screenshots/weather.spec.ts`, place "Lindenau"
  (invented), the page clock moved to the scenario's instant (not `page.clock`: it fakes `performance` too).
- Scenarios, all at night, light theme: **snow** = heavy snow showers, gusts 85 km/h (wind 3), −8 °C, snow lying,
  moon a day after full, aurora (Kp 8) – the heaviest of 18 816 states enumerated through `sceneSvg` (165 elements);
  **thunder** = thunder with hail under the full moon, wind 3, −6 °C; **snow, still air** = snow with gusts 25 km/h.
- Main thread: a CDP trace, merged `RunTask` on the renderer's main thread. "Motion" is a replay on the settled page
  (hidden, clock +61 s, shown: `REPLAY_AFTER_MS`), seconds 1–5, so page start-up is not in it; the same steps with
  reduced motion are the still baseline (0 ms in every run). Tracing costs time of its own, so the main-thread row
  also has `Performance.getMetrics` `TaskDuration` without a trace (first number).
- Build time: `sceneOf` + `sceneSvg` from a Vite bundle of `core/weather/scene` + `ui/weather-scene/draw`, timed in
  the page, median of 200. Enumeration of states and element counts: a scratch Vitest run over `sceneSvg` (not kept).

## 1. Elements, bytes, build time

|                                                                    | Ceiling        | Desktop                                                            | Phone                 |
| ------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------ | --------------------- |
| Head scene elements (snow / thunder / still air)                   | ≤ 220          | 162 / 149 / 151                                                    | 156 / 147 / 145       |
| Head scene `outerHTML`                                             | ≤ 48 KB        | 45.6 / 43.7 / 44.7 KB                                              | 43.3 / 43.3 / 42.4 KB |
| Heaviest of all enumerated states                                  | ≤ 220, ≤ 48 KB | 165 elements; 47.2 KB (heavy snow, wind 3, hard frost, star night) | –                     |
| Animated groups                                                    | ≤ 9            | 8 / 6 / 4 (max 9 in the enumeration)                               | 8 / 6 / 4             |
| Porthole 28 px (overview line)                                     | –              | 33–35 elements, 3.5 KB, 0 animated                                 | same                  |
| Widget scene (variant B)                                           | –              | 127–142 elements, 39.8–43.6 KB, 0 animated                         | same                  |
| `sceneOf` + `sceneSvg`, CPU ×1                                     | ≤ 0.7 ms       | 0.7–1.1 ms (p95 1.4–1.8)                                           | 0.7–0.8 ms            |
| `sceneOf` + `sceneSvg`, CPU ×4                                     | ≤ 3.5 ms       | 3.3–3.8 ms (p95 4.8–6.3)                                           | 3.4–3.7 ms            |
| `sceneOf` alone                                                    | –              | < 0.1 ms                                                           | < 0.1 ms              |
| Markup re-inserted: parse + style + layout / to the next frame, ×4 | –              | 36–52 / 49–76 ms                                                   | 34–58 / 46–71 ms      |
| Scene inserted → next frame on open, ×4                            | –              | 36–78 ms                                                           | 37–44 ms              |

Within the ceilings except the build time, which sits at or just over the ceiling (up to +0.4 ms; the drawing, not
`sceneOf`).
The real cost of a scene is the browser's parse/style/layout of ~160 elements (35–60 ms at ×4), not the build.

## 2. Main thread during the motion and at rest (CPU ×4)

|                                                            | Ceiling | Desktop snow / thunder / still air                                   | Phone snow / thunder / still air |
| ---------------------------------------------------------- | ------- | -------------------------------------------------------------------- | -------------------------------- |
| Motion, seconds 1–5: `TaskDuration` without trace          | ≤ 60 ms | **122 / 219** / 10 ms                                                | **158 / 262** / 21 ms            |
| same, after the fix below (`sc-sway` in one 5 s iteration) | ≤ 60 ms | 14 / **123** / 8 ms                                                  | 11 / **179** / 10 ms             |
| same, traced (merged tasks)                                | –       | 217 / 399 / 102 ms                                                   | 280 / 376 / 90 ms                |
| Long tasks during the motion                               | 0       | 0 / 0 / 0 (still air: one of 52 ms in second 0, the new round's SVG) | 0 / 0 / 0                        |
| Paints, seconds 1–5                                        | ≤ 30    | 12 / **34** / 0                                                      | 18 / **42** / 0                  |
| Main frames (layouts) seconds 1–5                          | –       | 6 / 17 / 0                                                           | 9 / 21 / 0                       |
| At rest, 5 s (trace)                                       | 0       | 1.8–10 ms, 0 paints, 0 frames, 0 animation frames, ≤ 1 timer         | 1.2–6.7 ms, same                 |
| At rest, 4 s without trace                                 | 0       | 1.5–2.2 ms, 0 layouts                                                | 1.4–2.9 ms, 0 layouts            |
| Still baseline (reduced motion), seconds 1–5               | –       | 0 ms                                                                 | 0 ms                             |

**Missed with wind 3 and with thunder.** Without wind the motion stays on the compositor (10–21 ms, 0 paints). With
wind 3 the main thread runs bursts of 2–3 full frames (style, layout of 16 objects, a repaint of the whole document,
layerize: ~45 ms at ×4) at 1.7 s, 3.4 s and 5.0 s – the iteration boundaries of `sc-sway` (1.66 s × 3), each with
`animationiteration` events. Thunder adds more such frames. The mockup (`mockups/09-bewegung.html`) in the same
sandbox: 8–9 ms over seconds 1–5, 0 layouts. At rest the ceiling holds: no timers, observers or frames of the scene.

## 3. Bundle

|                                                                         | Ceiling                  | This branch                                                      | `develop` @ `ca90c392f` |
| ----------------------------------------------------------------------- | ------------------------ | ---------------------------------------------------------------- | ----------------------- |
| Critical path `index.html` (gzip)                                       | ≤ 709.5 KB (budget +5 %) | 747.3 KB, 98 requests                                            | 748.2 KB, 98 requests   |
| Precache                                                                | ≤ 583 files, 6618.7 KB   | 663 files, 7162.3 KB                                             | 660 files, 7159.2 KB    |
| Scene, `draw.ts`, `core/weather/scene`, `core/sky` on the critical path | none                     | none (chunks `useSmallScene`, `scene`, `useMoon`, `WeatherPage`) | –                       |
| Porthole chunk fetched after the first contentful paint (overview)      | after                    | +160–260 ms after FCP; widget chunk +900–1300 ms                 | –                       |

The branch does not move the budget (−0.9 KB gzip, +3 precache files); `develop` is already over it.

## 4. Layout shift

|                                                                              | Ceiling                        | Desktop            | Phone                                        |
| ---------------------------------------------------------------------------- | ------------------------------ | ------------------ | -------------------------------------------- |
| `/weather`, load until rest: total / from the scene                          | 0 from the scene (page ≤ 0.05) | 0 / 0              | 0–0.012 / 0 (`weather-preview`, place chips) |
| `e2e/seed/open-shift.seed.spec.ts` `/weather`                                | ≤ 0.05                         | 0.0000             | 0.0000                                       |
| Overview "Ruhig" (porthole) / "Ausführlich" (widget): total / from the scene | 0 from the scene               | 0–0.008 / 0; 0 / 0 | 0.021 / 0; 0 / 0 (setup card, tools)         |

## 5. Hidden page

|                                                           | Ceiling                | Desktop and phone, all scenarios       |
| --------------------------------------------------------- | ---------------------- | -------------------------------------- |
| `document.getAnimations()` while hidden during the motion | all paused or finished | all paused (4–8), `data-paused="true"` |
| shown again                                               | –                      | running again, rests on time           |
| after rest, visible and hidden                            | all finished           | all finished                           |
| back after > 60 s                                         | new round              | new round, rests 5 s later             |

`document.hidden` forced + `visibilitychange`; a second tab does not hide a page in headless Chromium.

## 6. Phone profile

The phone columns above (Pixel 7 profile, CPU ×4). Same picture as desktop; with wind 3 / thunder slightly more
frames and paints. A real Android WebView (GPU raster, how it composites SVG transforms) is not covered here:
manual test on a real phone.

**Fixed for wind (same PR):** `sc-sway` now runs one 5 s iteration with the three sways in its keyframes; the iteration
boundaries and their whole-page restyles are gone (snow with wind 3: 122 → 14 ms desktop, 158 → 11 ms phone; 0 layouts).

## Open

- Thunder with hail: still above the ceiling (123 ms desktop, 179 ms phone; 10–15 layouts). The cause is the same kind:
  `sc-fall` runs `5 / dur` iterations (hail falls fast, so many), each boundary restyles. A single iteration would
  need the tile to cover n heights; or "Standbild" for these states on weak devices (A11Y §4: the fallback).
- Overview at rest: 5–14 ms in some runs, 145–230 ms in others over 5 s; no animation runs there (portholes and the
  widget have none), so it is app work after start (not traced further).

## 7. Round 2, package D (new drawing, small versions, one-iteration precipitation)

Measured 2026-11-26 on `feat/weather-scene-2-small` with `npm run measure:weather` (same setup as above; CPU ×4),
ceilings of round 2's [A11Y §4](../design/weather-scenes-2/A11Y.md). New scenario `overcast-night-banks` (code 3,
95 %, night, moon between the banks). "Before" = the same build with package A's `fall()` (`5 / dur` iterations).

| Head, desktop / Pixel 7                    | Ceiling        | Snow 3, wind 3, aurora | Thunder 3, hail, wind 3: before → after | Overcast night, banks | Snow, still air |
| ------------------------------------------ | -------------- | ---------------------- | --------------------------------------- | --------------------- | --------------- |
| Elements                                   | ≤ 220          | 197 / 197              | 221 → **227** / 221 → **227**           | 194 / 193             | 191 / 191       |
| `outerHTML` (with the `--cN` style)        | ≤ 64 KB        | 69.1 / 68.9 KB         | 82.9 → 83.1 KB                          | 64.4 / 64.0 KB        | 67.5 / 67.4 KB  |
| Animated groups                            | ≤ 9            | 6                      | 6                                       | 2                     | 3               |
| Motion s 1–5, `TaskDuration` without trace | ≤ 60 ms        | 8.8 / 8.3 ms           | 340 → **72** / 462 → **88** ms          | 9.6 / 11.1 ms         | 4.9 / 7.7 ms    |
| same, traced (merged tasks)                | –              | 371 / 334 ms           | 1038 → 492 / 939 → 595 ms               | 374 / 376 ms          | 393 / 455 ms    |
| Paints / layouts s 1–5 (traced)            | ≤ 30 paints    | 7 / 3 · 9 / 4          | 106 / 52 → 21 / 10 · 107 / 53 → 31 / 15 | 8 / 3 · 9 / 4         | 7 / 3 · 9 / 4   |
| Long tasks during the motion               | 0              | 1 / 0                  | 0 → 1 / 0 → 0                           | 0 / 0                 | 0 / 1           |
| At rest, 5 s traced                        | about 0        | 2.2 / 1.2 ms, 0 paints | 4.3 / 1.4 ms, 0 paints                  | 4.0 / 1.1 ms          | 2.1 / 0 ms      |
| `sceneOf` + `sceneSvg`, ×4 (median)        | within a frame | 29.5 / 31.1 ms         | 35.9 / 36.3 ms                          | 29.2 / 30.2 ms        | 30.0 / 32.7 ms  |

| Small versions (no motion)            | Snow         | Thunder      | Overcast night | Still air    |
| ------------------------------------- | ------------ | ------------ | -------------- | ------------ |
| Porthole 28 px: elements, `outerHTML` | 31, 8.1 KB   | 34, 7.9 KB   | 43, 9.6 KB     | 30, 8.0 KB   |
| Widget card: elements, `outerHTML`    | 175, 64.9 KB | 214, 82.3 KB | 194, 64.1 KB   | 169, 63.5 KB |
| `portholeSvg` 64 px, ×4 (median)      | 1.0 ms       | 1.0 ms       | –              | –            |

- **Closed (round 1's open item):** precipitation falls in one 5 s iteration over a stack of n + 1 tiles (doubling
  `<use>`, 4 for rain). Thunder with hail: 340 → 72 ms desktop, 462 → 88 ms phone; paints 106 → 21 / 31.
- **Still above:** thunder 3 with hail and wind 3 at 72 / 88 ms (6 layouts at the start and end of the glow and the
  motion's end); every other state under 12 ms. The stack costs 6 elements (3 `<use>`, 3 `<g>`): the heaviest head is
  227 elements; package A's drawing was at 221 and over 64 KB there already (83 KB with the colour style). The drawing's
  build time (≈ 30–36 ms at ×4) is package A's and above one frame; the porthole builds in 1 ms.
- At rest the ceiling holds everywhere (1–4 ms traced, 0 paints, 0 frames). The untraced 4 s rest window shows
  67–80 ms in two desktop runs and 0.3–2 ms in the others: app work after start, as in §2 (traced: 4 ms).
