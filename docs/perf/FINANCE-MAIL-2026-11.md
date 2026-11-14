# Finance and mail – click to content, causes and levers (2026-11)

Follow-up of [CLICK-TO-CONTENT-2026-11.md](CLICK-TO-CONTENT-2026-11.md) (method, probe, "Guard (step 3)"). Step 1: measured on `develop` 0e9f449e, nothing changed in the app. Targets (agreed 2026-11-13): page done ≤ 1.0 s on the first visit, ≤ 0.5 s on the second, entry dialog ≤ 0.3 s, at CPU 4×.

## Method

- `npm run measure:click` with `CLICK_ONLY=finance,mail`, `RUNS=5`, CPU 4× and 6×, desktop 1920×1080 and phone 412×915 (mail is desktop only: `platforms: ['desktop']`). Seed `medium`, production build, container with 4 cores.
- New in the probe (`web/e2e/perf/clickProbe.ts`): layout and style time and counts (CDP `LayoutDuration`, `RecalcStyleDuration`), DOM elements in the document and in `main` at `done`. `CLICK_PROFILE` now sums native time (`=program`), GC and idle apart from JS (`=js`). Table: `node scripts/click-table.mjs <label> --causes [--rate 4x]`.
- **Lever experiments:** the seeded build was rebuilt with one part left out (local patch, never committed), then finance measured again (4×, 5 runs, desktop and phone). A part's cost = baseline minus variant. Two baselines on `develop` (`base1` and `base2`, separate runs) agree within 0.1 s on the first visit.
- Noise: single runs move up to ±0.4 s (finance desktop 2nd visit 1.18–2.33 s in one series); only medians are compared. The probe itself costs about 80–100 ms of 4× time on finance (`querySelectorAll` per frame).

## Times (done, seconds, median of 5)

| target | desktop 4× 1st | 2nd | desktop 6× 1st | 2nd | phone 4× 1st | 2nd | phone 6× 1st | 2nd |
|---|---|---|---|---|---|---|---|---|
| finance | 1.6 | 1.5 | 2.3 | 2.1 | 1.6 | 1.3 | 2.1 | 1.9 |
| finance (dialog) | 0.5 | 0.5 | 1.0 | 0.6 | 0.5 | 0.4 | 0.6 | 0.5 |
| mail | 0.7 | 0.4 | 1.0 | 0.6 | – | – | – | – |

Finance first content (`h1`) comes at 0.4–0.5 s; the rest is the page building up. Mail is **within the targets at 4×** today (first visit 0.65–0.70 s in all five runs, second 0.35–0.61 s); the 2.3 s of 6× in the first report came before #815–#820.

## Causes (1st visit, 4×)

| target | device | done (s) | files after the click | DB reads (requests, rows) | main thread (ms) | script (ms) | layout / style (ms) | DOM elements (in `main`) | loading state shown (ms) |
|---|---|---|---|---|---|---|---|---|---|
| finance | desktop | 1.6 | 13 | 41, 1152 | 1505 | 961 | 68 / 98 | 1239 (710) | 800 |
| finance | phone | 1.6 | 13 | 41, 1152 | 1490 | 923 | 61 / 135 | 802 (346) | 761 |
| finance (dialog) | desktop | 0.5 | 0 | 0, 0 | 558 | – | 9 / 62 | 1274 (764) | 0 |
| mail | desktop | 0.7 | 7 | 18, 163 | 571 | 341 | 28 / 52 | 802 (249) | 374 |

- **Layout and style are not the cost.** Together 170–200 ms of 1.5 s main thread on finance, 80 ms on mail; DOM sizes are small (finance `main` 710 elements on desktop, mail 249). The main thread is busy with script for two thirds of the time.
- **Second visit is as slow as the first** on finance (1.5 s, no files loaded, main thread 1.6 s): render work, not loading.
- **Function profile** (unminified build, 3 runs): of the JS self time, the Recharts chunk (`Charts`) 240–490 ms and React (`vendor`) 300–480 ms lead; the finance module's own code and the figures do not show among the top entries (#818 holds). `=program` (native) is about as large as JS but includes the throttle's time slices and is not attributed further.
- **Finance dialog** (0.5 s): the editor opens while the page behind it still re-renders; no reads, no files. Not measured further here (see questions).

## Lever experiments (finance, 4×, done in s, median of 5)

| variant | desktop 1st | 2nd | phone 1st | 2nd | gain (1st / 2nd) |
|---|---|---|---|---|---|
| baseline `develop` (base2) | 1.58 | 1.61 | 1.44 | 1.18 | – |
| **without the two Recharts charts** (box of the same height) | **0.86** | **0.49** | **0.77** | **0.49** | **−0.7 / −0.7 … −1.1** |
| Recharts without bar animation | 1.30 | 0.86 | 1.32 | 0.72 | −0.1 … −0.3 / −0.5 … −0.75 |
| without the month list in the side column (desktop only) | 1.44 | 1.29 | – | – | −0.14 / −0.3 (noisy) |
| without month curve and category ring (own SVG) | 1.55 | 1.21 | 1.43 | 1.15 | ≈ 0 / ≈ 0 … −0.4 (noisy) |
| without the "Jetzt" strip | 1.40 | 1.07 | 1.26 | 1.00 | −0.18 / −0.2 … −0.5 |

Without Recharts the main thread drops from 1.57 s to 0.74 s (desktop), script from 0.99 s to 0.44 s, the loading state from 0.73 s to 0.36 s. The month curve and the category ring, drawn as plain SVG in the module, cost nothing measurable. Recharts is imported in one file only (`web/src/modules/finance/components/Charts.tsx`), chunk 359 KB (102 KB gzip).

## Levers

### Finance

1. **Own SVG for the two bar charts instead of Recharts** (`fix/perf-finance-charts`). Same picture in the finished state: horizontal category bars with the amount at the tip, income/expense columns with legend, tooltip on hover/focus, the table twin unchanged; boxes keep their fixed heights (`.barsBox`, `.trendBox`), so no layout shift. Pattern: `MonthCurve.tsx`, `CategoryRing.tsx`. Estimated gain −0.7 s on both visits, i.e. **first ≈ 0.8–0.9 s, second ≈ 0.5 s**; the Recharts dependency and its chunk leave the app (precache −359 KB). About 1–1.5 days with tests.
2. **Bar animation off** (only if 1 is not wanted): −0.1 … −0.3 s first, −0.5 … −0.75 s second; misses the targets (≈ 1.3 / 0.8 s). Change in motion only, finished state the same.
3. **"Jetzt" strip and side column** (after 1, only if the median is still over target): together ≈ −0.3 s; the strip is shared core code (`core/modules/NowStrip.tsx`), the side column a 31-day list. Paginating or virtualising the side list is not worth it at 710 elements.

Not a lever:
- **Drawing the charts after the first frame**: `done` waits for the last change in `main`, so a chart drawn later still counts; it would move the KPIs up visually, not the number. Only a lever if "content" is redefined (see questions).
- **Preloading the Recharts chunk** when finance shows in the navigation: helps the first visit only (the second visit is as slow and loads nothing) and is moot with lever 1.

### Mail

Within the targets at 4× on both visits; no fix needed for the targets. What remains (for 6× and the feel): the page reads in a chain (accounts → demo count → cached threads → invoice ids → invoice offers), 18 reads and a skeleton for 0.37 s; starting the thread read without waiting for the demo count could save ≈ 0.1 s (estimated, not measured). A list of 10 seeded threads does not need virtualising, and the thread view is already only built when a thread opens.

## Guard (step 3)

Finance: lower `CEILING` after lever 1 to the new median (≤ target → remove). Mail: add to `PAGES` of `web/e2e/seed/click-content.seed.spec.ts` without a ceiling, for the desktop guard only (mail has no phone route).
