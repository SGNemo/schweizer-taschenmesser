# Design evaluation (2026-10)

Working folder of the design review done together with the maintainer. Nothing here is imported by the app; mockups are standalone HTML/SVG.

| File | What |
|---|---|
| [`DESIGN-SPEC.md`](DESIGN-SPEC.md) | the specification: decided facts + open items, updated every round |
| [`ROUND-1-DIAGNOSIS.md`](ROUND-1-DIAGNOSIS.md) | round 1: what works, problems P1–P17 with severity, daily scenarios (clicks) |
| `screenshots/round-1/` | annotated screenshots (markers = problem ids), reduced to ≤ 1280 px |
| [`ROUND-2-DIRECTION.md`](ROUND-2-DIRECTION.md) | round 2: three directions (A/B/C) compared, proposed principles |
| `mockups/round-2/` | `variant-a|b|c.html` (standalone; `?theme=light`, toggle bottom right) + PNG renders desktop/phone, dark/light |
| [`ROUND-3-LAYOUT.md`](ROUND-3-LAYOUT.md) | round 3: areas instead of a flat module list, three shell layouts (L1/L2/L3), rules for master–detail and ultrawide, click paths |
| `mockups/round-3/` | `layout-l1|l2|l3.html` + PNG (desktop 1920, wide 2560, phone 412, dark; desktop light) |
| [`ROUND-4-TOKENS.md`](ROUND-4-TOKENS.md) | round 4: palette (three neutral bases, AA-checked), depth, radii, spacing, typography, icons |
| `mockups/round-4/` | `tokens.html`, `home.html`, `rechnungen.html` (`?theme=…&palette=cool|warm|graphite`) + renders, `palette-compare-dark.png` |
| [`ROUND-5-COMPONENTS.md`](ROUND-5-COMPONENTS.md) | round 5: base components, quick capture vs. full form, keyboard/touch/undo concept |
| `mockups/round-5/` | `components.html`, `form-rechnung.html`, `form-rechnung-phone.html`, `quickadd.html` + renders dark/light |
| [`ROUND-6-MOTION.md`](ROUND-6-MOTION.md) | round 6: motion principles, six patterns, what is not animated |
| `mockups/round-6/` | `motion.html` (interactive demo, reduced-motion switch) + captured frames |
| [`ROUND-7-MODULES.md`](ROUND-7-MODULES.md) | round 7: Kalender, Finanzen, Tresor, Datenträger mocked; every other module as a short spec |
| `mockups/round-7/` | `kalender.html`, `finanzen.html`, `tresor.html`, `datentraeger.html` + renders desktop dark/light, phone dark |
| `mockups/fonts/` | Inter Variable (OFL, copied from `@fontsource-variable/inter`) so the mockups use the app font without importing anything |
| `IMPLEMENTATION-PROMPT.md` | round 8: the prompt for the implementation chat |

How the screenshots were made: `cd web && SCREENS_DESKTOP=1 SCREENS_SCHEME=light|dark SCREENS_VIEWPORTS=1280x720,1920x1080,2560x1440,412x915 SCREENS_DIR=<dir> npm run screenshots` (invented data, fixed clock 2026-09-29).
