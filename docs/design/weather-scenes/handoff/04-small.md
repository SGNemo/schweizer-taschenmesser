# Hand-off 04 – small versions and the performance pass (package 4)

Concept: [CONCEPT §8](../CONCEPT.md). Common: [00-common](00-common.md). Mockups: `06-klein`.

## Pieces

| Where | Spec |
| --- | --- |
| Overview line (`home/WeatherGlance.tsx`) | `ScenePorthole` 28 px in place of the `Sky` swatch; same state as the head (phase, condition, moon), no motion |
| Overview widget (`modules/weather/widgets/WeatherWidget.tsx`) – **variant B, only with the maintainer's yes** | the card's body gets the scene as its background: `WeatherScene` absolutely positioned in the card (`border-radius` of the card, `overflow: hidden`), `quietX` at 55 % of the card's width, no motion; text (place label, temperature, word) directly on the sky with the scene's ink; the rain hint as an opaque chip at the bottom left; the card keeps its size (379 × 205 at 1920, 380 × 192 at 412). "Ruhig" and "Modulfarben: Aus": variant A |
| Overview widget – variant A (fallback and calm look) | `ScenePorthole` 64 px where the round swatch is today, card unchanged |
| Removal | `ui/identity/Sky.tsx`, `Sky.module.css`, `skyKind`, the `--sky-*` tokens, the kept `data-sky` + `span` of package 1b and their tests – once nothing imports them. `identity.test.tsx`, `tokens.test.ts` and the head-height seed spec are ratchet-protected: named hits ([00-common](00-common.md)) |
| Round closed | the working documents under `docs/design/weather-scenes/` are deleted; the link in `docs/decisions/weather.md` is repointed to `docs/features/weather.md`; fixtures already live in `core/sky/__fixtures__/` |

Variant B bends "a widget is a tone step without wash" (MODULE-IDENTITY "Widgets"): the PR names it as the one exception and updates that paragraph and `docs/decisions/weather.md`. If `check:stimulus` moves for the home pages, the PR names the hit and waits – the maintainer sets the label `stimulus-raise`, never the agent. If the maintainer has not said yes (in the design PR or in `docs/decisions/weather.md`), build A and leave B as an open point.

Both variants follow the shared settings `scene` ("Schlicht" → sky and body only) and `sky` (off → no moon).

## Performance pass (whole feature, on the product, not the mockup)

Ceilings from [A11Y §4](../A11Y.md). Measure with Playwright + CDP on `desktop-chrome` and `pixel-7` with CPU throttle ×4, numbers in the PR and in `docs/perf/`:

1. Elements and bytes of the heaviest scene; time of `sceneOf` + render.
2. Main-thread time during the 5 s of motion and after it has come to rest (must be ~0: no timers, no observers firing).
3. Bundle: critical path within the 5 % of `scripts/bundle-budget.json` (the scene and `core/sky` load with the weather chunk; the overview pulls only the porthole – or the scene, if variant B – lazily after first paint).
4. Layout shift on opening `/weather` (the `open-shift` seed spec) and on the overview: 0 from the scene.
5. Hidden page: no animation running (`document.getAnimations()` all paused or finished).
6. Android: the same run on the phone profile; a note for [MANUAL-TESTS](../../../MANUAL-TESTS.md) with one id (scene on a real phone: smooth, comes to rest, readable in sunlight).

## Tests (acceptance)

Porthole per state (layers present, no motion attribute); widget A / B by colour mode; `e2e/seed/calm-colour.seed.spec.ts` green; `headStyles.test.ts` green (no scene CSS in `Home.module.css`); no import of `Sky` left; the performance numbers under their ceilings.
