# Handoff 1 – the kit, the setting, budgets (no visible change)

Concept: [CONCEPT-KIT](../CONCEPT-KIT.md). After this package the weather page, card and porthole look the same pixel for pixel (the weather screenshot tool before/after), and nothing else shows a picture yet.

| Part | Do |
| --- | --- |
| `web/src/ui/scene/` | `useSceneEnv`, `useSceneMotion`, `SceneSvg`, `useBox`, `svg.ts` moved from `ui/weather-scene`, re-exported there under the old names |
| `sceneSvg` options | `layer?: (ctx) => string` (ctx: `lit`, `mix`, `el`, `circ`, `pts`, `radial`, state, palette – the mockup's `X`), drawn before `precip` and `wind`; `crop?: ViewBox` with culling of parts outside it; precipitation and wind in the crop's scale |
| `ui/scene/spots/` | `viewFor(span, box)`; the registry type `Spot<Vars>` `{ span, layer(vars, ctx) }`; **no spot yet** except a test spot used only in tests |
| `ui/scene/CardPicture`, `SkyTile`, `CardSign` | components per [CONCEPT-KIT §4](../CONCEPT-KIT.md); `CardPicture` reads `data-picture` from the card |
| `core/scene/sharedSky.ts` | `useSharedSky()`, `skyToneOf(state)` |
| `core/modules/types.ts` | `WidgetDef.picture` (hotspot: say so in the draft PR's first line); `checkModules`: step 2 needs `spot` and a fallback sign |
| Setting | `tm-pictures` (`off | calm | playful`, default `playful`), `tm-pictures-off`; `<html data-pictures>`; Einstellungen → Darstellung "Bilder" + per-module "Bild zeigen" + the link in "Fokus & Aufmerksamkeit"; words: [COPY §1](../COPY.md) |
| Budgets | a unit test helper `pictureCost(svg)` (elements, bytes) and the ceilings as constants; `docs/howto` one line |

Edge cases: no weather place → `defaultScene` by the clock; storage blocked → default `playful`; a spot id unknown to the kit → no picture, a dev warning.

Not here: the tone, the cap rule, any spot or sign, any card change.
