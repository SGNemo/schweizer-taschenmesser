# Living scenes – the scene kit (package 1)

What is lifted out of `web/src/ui/weather-scene` so that any module can show a picture, the contract a module uses, and what happens without data. The weather must look the same afterwards. Drawing: `mockups/world.js`. Measures: [handoff/00-common](handoff/00-common.md). Words: [COPY](COPY.md).

## 1. Three kinds of picture

| Kind | What | Text on it? |
| --- | --- | --- |
| **Scene** (step 2) | a crop ("spot") of the weather landscape with the module's things in it, under the shared sky | no – it stands beside or under the content |
| **Sky tile** (step 1) | sky and body only (the weather's level "Schlicht") | yes – a plain sky has a known ink per sky key, as the weather head has |
| **Sign** (step 1) | a 32 px drawing in the module's hue at the end of the card head, reading one datum | no |

Step 0 is no picture: the card takes the day's tone ([CONCEPT-HOME §2](CONCEPT-HOME.md)).

## 2. What moves from the weather into the kit

New folder `web/src/ui/scene/` (the kit). `ui/weather-scene` keeps its public names and re-exports what moved, so no caller changes.

| Today | In the kit | Change |
| --- | --- | --- |
| `useSceneEnv` (theme, calm) | `ui/scene/useSceneEnv` | also reads the setting "Bilder" (§5) |
| `useSceneMotion` (5 s, pause when hidden or unseen) | `ui/scene/useSceneMotion` | none; no module picture uses it in version 1 |
| `WeatherScene` wrapper (one `<svg>`, colour vars, fade) | `ui/scene/SceneSvg` (generic: `{ viewBox, vars, inner }` in → svg out); `WeatherScene` becomes a thin caller | none visible |
| `useSceneFit` box measuring | `ui/scene/useBox` (ResizeObserver, layout effect) + the weather's own `cardFit`, `phoneView` stay with the weather | split only |
| `draw.ts` utilities `tok`, colour book, `el`, `prng`, `compactPath`, `countElements` | `ui/scene/svg.ts` | moved, re-exported |
| `draw.ts` landscape layers | stay in `ui/weather-scene/draw.ts`; new `sceneSvg` option `layer?: (ctx) => string` (drawn where the mockup's `front` hook is, before `precip` and `wind`) and `crop?: ViewBox` | additive |
| `core/weather/scene.ts` `sceneOf`, `defaultScene`, `phaseOf` | stay; new `core/scene/sharedSky.ts` (§3) calls them | additive |
| `--scene-*` tokens | stay; new tokens for module things (`--scene-garden-*`, `--scene-boat-*`, `--scene-lamp`) and the day tones (`--tone-*`) | hotspot `tokens.css`: announce |

**Cropping costs nothing extra only if the kit skips what a crop does not show.** `sceneSvg` with `crop` draws a layer part only when its box meets the crop (each drawn part declares its x-range; a part outside is not emitted). Mockup numbers: the garden is 175–246 elements as drawn and 60–160 for what its crop shows ([A11Y §4](A11Y.md)). Precipitation and wind marks are drawn in the crop's own scale (count by the crop's area, stroke width in picture pixels), not scaled up with the landscape.

## 3. The shared sky

`core/scene/sharedSky.ts`: `useSharedSky(): SceneState` – one value for the whole app window, refreshed once a minute (`useMinuteNow`).

| Situation | Sky |
| --- | --- |
| weather module on, a place chosen, cache present | the weather's current scene state (`sceneOf`, as `useSmallScene` builds it), `motion: false` |
| no place, weather off, or no cache | `defaultScene(theme, month, calm)` with the phase from the device clock: night 21–6, day 8–18, golden 6–8 and 18–21; clear sky; the moon's phase from `core/sky/phases` |
| colour mode "Ruhig" or "Modulfarben: Aus" | `calm: true` (greys), as the weather |

Never a request: the shared sky only reads what the weather already cached. The sky's **tone key** (`day`, `golden`, `dusk`, `night`, `overcast`, `rain`, `snow`) is derived from the same state and set as `data-sky-tone` on the overview ([CONCEPT-HOME §2](CONCEPT-HOME.md)).

## 4. The contract: how a module registers a picture

Modules never import each other and never hold drawing code. A module gives **variables**; the kit owns every **drawing**.

```ts
// core/modules/types.ts (hotspot: one chat at a time)
interface WidgetDef {
  picture?: {
    step: 1 | 2;                       // 2 = scene (counts toward the overview's cap), 1 = sign or sky tiles
    spot?: SpotId;                     // step 2: 'garden' | 'lake' | 'way' … (ui/scene/spots)
  };
}
```

- **Spots and signs live in the kit:** `ui/scene/spots/<spot>.ts` exports `layer(vars, ctx): string` and `span` (the x-range its things need); `ui/scene/signs/<id>.tsx` exports the sign. They take plain numbers and enums – never a title, name or amount (type-checked: a spot's `Vars` has no `string` field).
- **The module computes its variables** in a pure function beside its logic, e.g. `modules/habits/picture.ts` `gardenVars(goals, entries, day): GardenVars`. This is the function the table tests cover (datum → picture).
- **The widget places the picture** with kit components: `<CardPicture spot="garden" vars={vars} />` (scene: wide beside the content, strip under it; decides the form from the card's width), `<SkyTile sky={…} />`, `<CardSign id="weekBars" value={…} />`. The widget body does not change otherwise.
- **The overview decides loudness.** `home` reads `picture.step` from the registry and hands each card `data-picture="scene" | "sign" | "none"` by the rule in [CONCEPT-HOME §3](CONCEPT-HOME.md); `CardPicture` renders the spot only for `scene`, else the module's sign (every step-2 widget names a fallback sign).
- **The module page** uses the same `CardPicture` / `SkyTile` in its own first block; no head variant changes (`standard` stays; one stage per area is the weather's or the music's).
- `accounts` never sets `picture` (`exclusion.test.ts` gets the case).

## 5. Settings

| Setting | Values | Stored | Effect |
| --- | --- | --- | --- |
| "Bilder" (Einstellungen → Darstellung, linked from "Fokus & Aufmerksamkeit") | Aus · Ruhig · Verspielt (default Verspielt) | device-local `tm-pictures` → `<html data-pictures>` like `tm-color` | Aus: the app as today – no tone, grey marks, no sky tiles, no scenes. Ruhig: tone, signs, sky tiles; scenes show their sign. Verspielt: everything |
| per module: "Bild zeigen" (the module's settings page) | on · off | device-local `tm-pictures-off` (module ids) | off: that module's cards behave as under "Aus"; the tone stays |
| existing: colour mode "Ruhig", "Modulfarben: Aus" | – | – | pictures in greys, tone off (as the weather today) |
| existing: motion (`data-motion`, `prefers-reduced-motion`) | – | – | the appearing fade (§6) is off |

The weather keeps its own switches ("Bild im Wetter-Kopf", "Mond und Himmelsereignisse"); "Bilder: Aus" does not touch the weather page or card.

## 6. Behaviour

- **No data yet (loading):** the picture slot is empty in the card's surface colour; no skeleton, no jump – the slot's size comes from the card, not from the picture.
- **Empty module:** the spot's empty state (the turned bed, the still lake) – a picture, never a hole.
- **Module switched off:** no card, so no picture; the scene cap is counted over visible cards only.
- **Motion:** nothing in a module picture moves by itself. One feedback: when a datum changes while the card is visible (a tick), the new thing (bloom, boat, star) fades in over 300 ms, opacity only; off with reduced motion. No loop, no sway, no weather motion in crops (precipitation stands, as in the weather's small versions).
- **Not visible:** a picture below the fold is drawn when it comes near the viewport (IntersectionObserver, 200 px margin) and is not redrawn while hidden; the minute tick redraws only when the state's key changed.
- **Ceilings** per picture and for the page: [A11Y §4](A11Y.md); a test counts elements per spot state.
