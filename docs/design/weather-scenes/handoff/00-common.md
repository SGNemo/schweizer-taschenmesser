# Hand-off 00 – common to every package

Read with [CONCEPT](../CONCEPT.md). **Source of truth for every shape, coordinate and colour: `../mockups/scene.js` (geometry block `G`, one function per layer) and `../mockups/palette.js`.** The packages port that drawing to TSX and tokens; they do not redraw it. Open `../mockups/*.html` in a browser (or `node ../docs/design/weather-scenes/mockups/render.mjs` from `web/`) to see every state.

## Building blocks (new)

| File | What | Package |
| --- | --- | --- |
| `web/src/core/weather/scene.ts` | pure model: `SceneState` (the `state` object of `scene.js`, same field names) and `sceneOf(input: { forecast, nowMs, lat, lon, theme, calm, level, moon?, event? }): SceneState`; `phaseOf(nowIso, sunrise, sunset, isDay)`; `condOf(code: number \| undefined, group: CodeGroup): { cond, intensity }`; `windLevel`, `frostLevel`, `seasonOf(month, lat)`; `conditionId(code, group)` for the word | 1a (words, `conditionId`), 1b (the rest) |
| `web/src/ui/weather-scene/WeatherScene.tsx` + `.module.css` | the SVG: one `<g data-layer>` per layer, `aria-hidden`, `data-testid="weather-scene"`, `data-phase`, `data-cond`, `data-ink`; no state, no effects except the motion hook | 1b |
| `web/src/ui/weather-scene/useSceneMotion.ts` | sets `data-motion="run"` for 5 s when the page is opened; pauses on `document.hidden` and when the stage leaves the viewport (`IntersectionObserver`); never runs under `motionReduced()`, "Standbild", "Schlicht", "Ruhig", "Modulfarben: Aus" | 1b |
| `web/src/core/sky/*` | moon, sun, rise / set, phases, eclipses, events – ported from `../reference/astro/*.js`, export names kept | 2, 3 |
| `web/src/ui/weather-scene/MoonGlyph.tsx` | the phase shape alone, 16–64 px, `mono` | 2 |
| `web/src/ui/weather-scene/ScenePorthole.tsx` | round crop, 28 / 64 px, no motion | 4 |

Import rule: `core/**` and `ui/**` import nothing from `modules/**`; the weather module, `home/WeatherGlance` and the widget all import the scene from `ui/weather-scene` and the model from `core/weather` / `core/sky`.

`Sky` and the `--sky-*` tokens stay untouched until package 4 removes them (the weather head stops using `Sky` in package 1b; the widget and the overview line in package 4). The music head does not use `Sky`.

## Layers

Order, content and data: [CONCEPT §1](../CONCEPT.md). In the SVG: `viewBox="0 0 1600 320"`, `preserveAspectRatio="xMaxYMax slice"`, `width/height 100 %` of the stage's backdrop. Options of `Scene.svg(state, opts)` that the port keeps: `quietX` (end of the text zone in scene units: no clouds, caps or full-strength precipitation left of it, few stars – set for **every** crop narrower than 1600 units), `extendTop` (extra sky above, for short or tall boxes), `bodyAt: [x, y]` (the body at a fixed spot with a 0.75× halo – the phone head and the widget), `align`. Each kind of repeated mark (trees, drops, stars) is **one path**, never one element per mark. Randomness only from the seeded generator in `scene.js` (seed 7): the picture is identical on every render and in tests. Exported helpers the port mirrors: `Scene.skyKey(state)`, `Scene.ink(state)`, `Scene.moonPath(r, illum)`.

## Tokens (`ui/tokens.css`, hotspot – announce first)

- One token per entry of `palette.js`, named `--scene-<key>` (`--scene-night-0`, `--scene-night-1`, `--scene-sun`, `--scene-moon`, `--scene-cloud`, `--scene-rb-1` …); the dark-theme values in the dark blocks (both of them, as `--sky-*` today). No hex in component CSS.
- Ridge tones are not tokens but mixes of the season base toward the sky's bottom stop, with the percentages of `scene.js`: near 0 %, mid 30 %, far 62 %, alp 78 % (night, dark theme, dust, snow and wet variants: the same function in `scene.js`).
- **Ink.** New root tokens `--ink-light` (#eceff1) and `--ink-dark` (#171f24), and `--ink-theme` (the theme's own text colour, declared beside `--text` in each theme block). The stage sets `--text` and `--text-on-tint` to `--ink-light` or `--ink-dark` from the scene's `data-ink` (this replaces the `:has([data-sky='night'])` rule in `ui/HeadSurface.module.css`). Chips (`.key`), the hint pill and the phone's module row are **opaque** and reset their colour to `var(--ink-theme)` (and their muted text to the theme's `--text-muted` value via a second root token `--ink-theme-muted`), so the stage's override never reaches them: `background: color-mix(in srgb, var(--surface) 92%, transparent)`.
- A unit test (`ui/weather-scene/contrast.test.ts`) computes, for every sky key × theme, the contrast of the scene's ink against both gradient stops and against the shelter haze, and fails below 4.5 : 1 – the table in [A11Y §1](../A11Y.md) is its expectation.

## Settings

Shared scope `weather` (`core/weather/settings.ts`, synced, Zod; UI in `pages/settings/WeatherSection.tsx`): `scene: 'motion' | 'still' | 'plain'` (default `motion`), from package 2 `sky: boolean` (default `true`). Both optional in the schema with these defaults, so stored settings stay valid. The weather page, the widget and the overview line read the same scope. Words: [COPY §3](../COPY.md).

## Protected tests – name the hit, never work around it

`web/scripts/ratchet.mjs` protects `e2e/seed/**`, `ui/identity/identity.test.tsx`, `ui/tokens.test.ts` and the budgets ([howto/ci-ratchet](../../../howto/ci-ratchet.md)). Where a package has to touch one, it (1) keeps every existing check that still makes sense and **appends** the new one, (2) lists each changed protected file under "Ratchet hits" in the PR with one line of why, (3) leaves the approval and the label `stimulus-raise` to the maintainer – an agent never sets that label. Known hits:

| Package | File | Why |
| --- | --- | --- |
| 1b | `e2e/seed/head-height.seed.spec.ts` | the "first `span` in `[data-sky]` clear of the module row" check has no span to find; appended check: the box of `[data-layer="body"]` is clear of the module row. To keep the old check passing, the scene's wrapper keeps `data-sky` and one empty first `span` laid over the body's box |
| 1b | `ui/tokens.test.ts` | new `--scene-*` and `--ink-*` tokens, if the test lists tokens |
| 1b | `e2e/stimulus-budget.json` | `shadows` 1 → 0 for the weather pages (lowering is free, listed for completeness) |
| 4 | `ui/identity/identity.test.tsx`, `ui/tokens.test.ts` | `Sky`, `skyKind` and `--sky-*` are removed |
| 4 (variant B only) | `e2e/stimulus-budget.json` for the home pages | only if the widget background moves a number |

## Rules for every package

- The scene never carries information alone: before a layer ships, its word is on the page ([COPY](../COPY.md)).
- Nothing asks the network that does not ask today, except the added variables in the existing requests (`snow_depth` in 1a, `dust` in 3; `timezone` is already in the response). `privacy.test.ts` and the DATA-FLOWS row stay as they are.
- Ceilings (measured on the mockup, [A11Y §4](../A11Y.md)): elements per scene, bytes, animated groups, main-thread time. A unit test counts the elements of the heaviest preset.
- `check:stimulus` for `d1920--weather`, `p412--weather` and the home pages: unchanged or lower (the scene is one SVG; no `box-shadow` on it).
- Screens for the PR text: the six situations of `mockups/07-kopf.html`, 1920 and 412, light and dark, with the fixture of [ANALYSIS](../ANALYSIS.md) (invented place "Lindenau").
