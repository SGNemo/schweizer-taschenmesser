# Hand-off 00 – common to every package

Read with [CONCEPT](../CONCEPT.md). **Source of truth for every shape, coordinate and colour: `../mockups/scene.js` (geometry block `G`, one function per layer) and `../mockups/palette.js`.** The packages port that drawing to TSX and tokens; they do not redraw it. Open `../mockups/*.html` in a browser (or `node ../docs/design/weather-scenes/mockups/render.mjs` from `web/`) to see every state.

## Building blocks (new)

| File | What | Package |
| --- | --- | --- |
| `web/src/core/weather/scene.ts` | pure model: `SceneState` (the `state` object of `scene.js`, same field names) and `sceneOf({ forecast, nowIso, lat, moon?, event?, theme, calm, level })`; `phaseOf(nowIso, sunrise, sunset, isDay)`; `condOf(code, group)`; `windLevel`, `frostLevel`, `seasonOf(month, lat)` | 1 |
| `web/src/ui/weather-scene/WeatherScene.tsx` + `.module.css` | the SVG: one `<g data-layer>` per layer, `aria-hidden`, `data-testid="weather-scene"`, `data-phase`, `data-cond`, `data-ink`; no state, no effects except the motion hook | 1 |
| `web/src/ui/weather-scene/useSceneMotion.ts` | adds `data-motion="run"` for 12 s when visible; pauses on `document.hidden` and when the stage leaves the viewport (`IntersectionObserver`); never runs under `motionReduced()`, "Standbild", "Ruhig" | 1 |
| `web/src/core/sky/*` | moon, sun, rise / set, phases, eclipses, events – ported from `../reference/astro/*.js` | 2, 3 |
| `web/src/ui/weather-scene/MoonGlyph.tsx` | the phase shape alone, 16–64 px, `mono` | 2 |
| `web/src/ui/weather-scene/ScenePorthole.tsx` | round crop, 28 / 64 px, no motion | 4 |

`Sky` and the `--sky-*` tokens stay untouched until package 4 removes them (the weather head stops using `Sky` in package 1; the widget and the overview line in package 4). `skyKind` tests go with it. The music head does not use `Sky`.

## Layers

Order, content and data: [CONCEPT §1](../CONCEPT.md). In the SVG: `viewBox="0 0 1600 320"`, `preserveAspectRatio="xMaxYMax slice"`, `width/height 100 %` of the stage's backdrop. Options of `Scene.svg(state, opts)` that the port keeps: `quietX` (clouds and full-strength rain stay right of it in narrow crops), `extendTop` (extra sky above for the phone head), the phone body box. Each kind of repeated mark (trees, drops, stars) is **one path**, never one element per mark. Randomness only from the seeded generator in `scene.js` (seed 7): the picture is identical on every render and in tests.

## Tokens (`ui/tokens.css`, hotspot – announce first)

- One token per entry of `palette.js`, named `--scene-<key>` (`--scene-night-0`, `--scene-night-1`, `--scene-sun`, `--scene-moon`, `--scene-cloud`, `--scene-rb-1` …); the dark-theme values in the dark blocks (both of them, as `--sky-*` today). No hex in component CSS.
- Ridge tones are not tokens: `color-mix(in srgb, var(--scene-base-<season>) X%, <sky bottom stop>)` with the percentages of `scene.js` (near 100, mid 70, far 38, alp 22).
- `--scene-ink-light` (#eceff1) and `--scene-ink-dark` (#171f24) equal today's `--sky-night-ink` and `--text` (light theme); the stage sets `--text` and `--text-on-tint` from the scene's `data-ink` (replace the `:has([data-sky='night'])` rule in `ui/HeadSurface.module.css`).
- Chips (`.key`), the hint pill and the phone's module row get an **opaque** backing and their own ink, independent of the scene's ink: `background: color-mix(in srgb, var(--surface) 92%, transparent)`, `color: var(--text-fixed)` where `--text-fixed` is the theme's normal text colour re-declared on that element (the stage's override must not reach them).
- A unit test (`ui/weather-scene/contrast.test.ts`) computes, for every sky key × theme, the contrast of the scene's ink against both gradient stops and against the shelter haze, and fails below 4.5 : 1 – the table in [A11Y §1](../A11Y.md) is its expectation.

## Settings

Module settings (`modules/weather/settings.ts`, synced with the module's settings as `warnNotify` is): `scene: 'motion' | 'still' | 'plain'` (default `motion`, a `select`), from package 2 `sky: boolean` (default `true`). Words: [COPY §3](../COPY.md). Both appear in the module's settings page; the switch is the "off switch" of the FOCUS checklist.

## Rules for every package

- The scene never carries information alone: before a layer ships, its word is on the page ([COPY](../COPY.md)).
- Nothing asks the network that does not ask today, except the two added variables of package 1 (`snow_depth`, later `dust` in package 3) in the existing requests. `privacy.test.ts` and the DATA-FLOWS row stay as they are.
- Ceilings (measured on the mockup, [A11Y §4](../A11Y.md)): elements per scene, bytes, animated groups, main-thread time. A unit test counts the elements of the heaviest preset.
- `check:stimulus` for `d1920--weather`, `p412--weather` and the home pages: unchanged or lower (the scene is one SVG; no `box-shadow` on it). The one named exception is the widget background of package 4.
- Height guard `e2e/seed/head-height.seed.spec.ts`: the stage stays ≤ 320 px; its "first span in `[data-sky]`" check is rewritten in package 1 to "the scene's body box does not overlap the module row" (`[data-layer="body"]`), not deleted.
- Screens for the PR text: the six situations of `mockups/07-kopf.html`, 1920 and 412, light and dark, with the fixture of [ANALYSIS](../ANALYSIS.md) (invented place "Lindenau").
