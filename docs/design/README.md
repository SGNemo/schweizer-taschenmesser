# Design evaluation (2026-10)

Working folder of the design review done together with the maintainer. Nothing here is imported by the app; mockups are standalone HTML/SVG.

| File | What |
|---|---|
| [`DESIGN-SPEC.md`](DESIGN-SPEC.md) | the specification: decided facts + open items, updated every round |
| [`ROUND-1-DIAGNOSIS.md`](ROUND-1-DIAGNOSIS.md) | round 1: what works, problems P1–P17 with severity, daily scenarios (clicks) |
| `screenshots/round-1/` | annotated screenshots (markers = problem ids), reduced to ≤ 1280 px |
| `mockups/` | HTML/SVG mockups per round (A/B/C variants), rendered PNGs next to them |
| `IMPLEMENTATION-PROMPT.md` | round 8: the prompt for the implementation chat |

How the screenshots were made: `cd web && SCREENS_DESKTOP=1 SCREENS_SCHEME=light|dark SCREENS_VIEWPORTS=1280x720,1920x1080,2560x1440,412x915 SCREENS_DIR=<dir> npm run screenshots` (invented data, fixed clock 2026-09-29).
