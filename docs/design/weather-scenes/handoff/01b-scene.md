# Hand-off 01b – scene frame, every weather, the head (package 1b)

Builds on [01a](01a-data-words.md) (data, words, `ice`, chip icons are there already). Concept: [CONCEPT §1–§7, §9](../CONCEPT.md). Common: [00-common](00-common.md). Words: [COPY §2 (pill), §3](../COPY.md). Mockups: `01-lagen-tag`, `02-lagen-nacht`, `03-daemmerung`, `07-kopf`, `09-bewegung`.

## Model (`core/weather/scene.ts`) – the table the tests assert

- `phaseOf`: [CONCEPT §2](../CONCEPT.md) (40 min, 45 min, 60 min, 40 min; place's local time from `placeNowIso`; no sunrise / sunset → `is_day`).
- `condOf(code, group)`: [CONCEPT §3](../CONCEPT.md), first table, including `intensity`; without a code from the group, intensity 2.
- Modifiers: second table of §3 (wind 1: wind ≥ 20 or gusts ≥ 35; wind 2: wind ≥ 35 or gusts ≥ 50; wind 3: wind ≥ 50 or gusts ≥ 70 km/h; frost 0° / −5°; heat 30°; snow depth ≥ 0.01 m). `season`: Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn; shifted by six months for latitude < 0; |latitude| < 23.5 → summer.
- `body`: the sun by day and in the golden hour with `t = (now − sunrise) / (sunset − sunrise)`; **`none` at night, dawn and dusk** until package 2 brings the real moon (a plain disc would claim a phase and a place nobody calculated: stars only).
- Sky key: `mockups/scene.js` function `skyKey(state)` (night families by condition, twilight fallback above 85 % cloud).
- Ink: `Scene.ink(state)`.

## Head layout

| | Desktop ≥ 900 px | Phone |
| --- | --- | --- |
| Stage | 280 px high: title row 56 (`--head-row`), body 224; with two hints ≤ 290 | 272 px (minimum, so the landscape stays below the text) with no or one hint, ≤ 300 with two; title row 44, module row 44, body |
| Body grid | one column, left aligned at the page's content edge, max-width 36 rem: figure (temperature `HeroFigure type="thin"`), detail line, hint pill (if any), chips row, rest line; gaps `--space-2` | figure, detail line, hint pill, one chips row (rain / dry and wind); rest line in the page below the stage, starting with the third chip's fact |
| Scene | backdrop, full stage, `xMaxYMax slice`; below 1600 units of width `quietX` = right edge of the text column | same SVG with `extendTop` from the stage height, `quietX`, and `bodyAt` so that the body's centre sits at 83 % of the width between the module row and the first pill or chip (`mockups/head.js` shows the calculation); the figure column is capped at 100 % − 96 px so a long detail line wraps instead of running into the body |
| Gear | title row, right end; nothing of the scene but sky and stars behind it | not in the head (as today) |

The stage keeps its height while loading (`useKeepHeadRoom`, as today).

## The hint (replaces `HeroSlot area="notice"`)

- Markup: `div role="note" aria-label={tp.warnLabel} data-testid="weather-warning"` → `ul > li (Icon 16 + text)` → `span.computed` with `tp.warnComputed` after the last line (desktop: same line, preceded by " · "; phone: own line).
- Look: `background: color-mix(in srgb, var(--warning) 14%, var(--surface))` (opaque), `border-radius: var(--radius-md)`, padding `--space-1` `--space-3`, text `var(--ink-theme)` 600 at the chip size, `.computed` `var(--ink-theme-muted)` at the meta size (never `--text`: inside the stage that is the scene's ink), icon `--warning-ink`. `width: fit-content` on the desktop, full width on the phone.
- Icons and kinds as built in 1a.
- Late path unchanged: `WarningNotice` under the head in the polite live region, same pill look, full width.
- `AreaFrame`'s notice slot is no longer used by weather; the slot itself stays (other modules).

## The finds of the analysis in this package

| Find | Change |
| --- | --- |
| A1 | the hint pill (above) |
| A2, A3, A10 | the scene, its size, the title row free of picture |
| A6, A7, A8 | ink by `data-ink`; opaque chips, pill and module row with `--ink-theme` ([00-common](00-common.md)); calm scene |
| A9 | `contrast.test.ts`, axe with a place |

Phone: two chips in the stage (rain / dry, wind); the third chip's fact (UV or sunrise) is the first part of the rest line below the stage.

## States

| State | Scene | Text |
| --- | --- | --- |
| loading (frame stopped waiting) | calm default: `day`, `clear`, season of the device date, no body | dashes as today (`WeatherHeroPending`) |
| no place | same calm default | title "Wetter", empty state in the page |
| stale ("Stand 02:10") | drawn from the stale values; phase from the clock, so a stale forecast at night is a night | detail line ends with `tx.asOf` |
| old cache without `code` | from `group`, intensity 2, no snow depth | word from `tx.codes` |
| "Standbild" / reduced motion / "Modulfarben: Aus" | no `data-motion` | – |
| "Schlicht" | layers `sky` + `body` (by day the sun; at night the sky only, no stars) | – |
| "Ruhig" / "Modulfarben: Aus" | greys (`Scene` `calm: true`), ink by theme | – |
| polar day / night | `day` / `night` from `is_day` | – |

## Motion

[CONCEPT §9](../CONCEPT.md); CSS from `mockups/scene-motion.css` (5 s, finite – for precipitation a fractional iteration count, both tiles drawn; `transform` only, `opacity` allowed for one fade; `will-change` only while `data-motion="run"`).

## Tests (acceptance)

1. `scene.test.ts`: every WMO code of [CONCEPT §3](../CONCEPT.md) × `day` and `night` → `cond`, `intensity`, sky key, cloud kind, precipitation kind, landscape state, as a table (`it.each`); every modifier threshold at and below its edge; every phase boundary (minute before / at / after); season × hemisphere.
2. `WeatherScene.test.tsx`: layers present per state (`data-layer`), `aria-hidden`, no element left of x = 900 in the layers `body`, `clouds`, `event` except the overcast deck (`data-part="deck"`, one flat tone that may cross) – read the transforms / attributes, element count of the heaviest preset ≤ the ceiling.
3. `contrast.test.ts` ([00-common](00-common.md)).
4. Detail-line additions by priority at their limits.
5. Hint pill: suffix once, the note's name, one and two hints, the late path.
6. e2e (`e2e/weather.spec.ts` grows, new cases appended): the fixture of the analysis → no element with `data-testid="weather-warning"` above the stage, the pill inside it; stage height by hints (0, 1, 2) at 1920 and 412 as in the layout table, and the 1280 window; `prefers-reduced-motion` → no `data-motion`; "Schlicht" → two layers; axe on `/weather` **with** a place in both themes, at night and by day.
7. Protected tests as in [00-common](00-common.md) (hits named in the PR): the old head-height check still passes through the kept `data-sky` + first `span`, the new body-box check is appended; `identity.test.tsx` is not touched (it tests `Sky`, which still exists); `weather.test.tsx` and `e2e/weather.spec.ts` (not protected) keep finding `data-testid="sky"` on the kept wrapper and additionally assert `data-phase` / `data-cond` on `weather-scene`.
8. `check:stimulus`: weather pages unchanged except `shadows` 1 → 0 (baseline lowered).
