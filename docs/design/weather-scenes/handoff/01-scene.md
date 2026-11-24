# Hand-off 01 – scene frame, every weather, the head (package 1)

Concept: [CONCEPT §1–§7, §9](../CONCEPT.md). Common: [00-common](00-common.md). Words: [COPY §1–§3](../COPY.md). Mockups: `01-lagen-tag`, `02-lagen-nacht`, `03-daemmerung`, `07-kopf`, `09-bewegung`.

## Data (additive, all optional)

| Field | Where | From |
| --- | --- | --- |
| `code?: number` | `Forecast`, `HourRow`, `DayRow` | the WMO code already fetched (`weather_code`), kept beside `group` |
| `now.snowDepth?: number` (m) | `NowDetail` | new variable `snow_depth` in `current` of the existing forecast request |
| cache | `core/weather/cache.ts` `forecastSchema` | add the fields as optional, or they are stripped on read; an entry without `code` stays valid (the scene draws from `group`, intensity 2); no refetch rule for the new fields |

`CodeGroup` keeps its nine members (the cache validates against them and the frozen languages have their words).

## Model (`core/weather/scene.ts`) – the table the tests assert

- `phaseOf`: [CONCEPT §2](../CONCEPT.md) (40 min, 45 min, 60 min, 40 min; place's local time from `placeNowIso`; no sunrise / sunset → `is_day`).
- `condOf(code)`: [CONCEPT §3](../CONCEPT.md), first table, including `intensity`.
- Modifiers: second table of §3 (thresholds 20 / 35 / 50 / 70 km/h, 0° / −5°, 30°, snow depth ≥ 0.01 m). `season`: Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep–Nov autumn; shifted by six months for latitude < 0; |latitude| < 23.5 → summer.
- `body`: sun by day with `t = (now − sunrise) / (sunset − sunrise)`; at night `{ kind: 'moon' }` with a fixed plain full disc at `t = 0.62` until package 2 (no phase is claimed: no moon chip, no moon word); `none` in dawn and dusk.
- Sky key: `mockups/scene.js` function `skyKey(state)` (night families by condition, twilight fallback above 85 % cloud).
- Ink: `Scene.ink(state)`.

## Head layout

| | Desktop ≥ 900 px | Phone |
| --- | --- | --- |
| Stage | 280 px high: title row 56 (`--head-row`), body 224 | ≤ 312 px: title row 44, module row 44, body |
| Body grid | one column, left aligned at the page's content edge, max-width 36 rem: figure (temperature `HeroFigure type="thin"`), detail line, hint pill (if any), chips row, rest line; gaps `--space-2` | figure, detail line, hint pill, one chips row (rain / dry and wind); rest line in the page below the stage, starting with the third chip's fact |
| Scene | backdrop, full stage, `xMaxYMax slice` | same SVG with `extendTop` 90 and the phone body box (body top edge ≥ 96 px from the stage top, centre at ~80 % width) |
| Gear | title row, right end; nothing of the scene but sky and stars behind it | not in the head (as today) |

Two hints add 7 px, which is fine below 320. The stage keeps its height while loading (`useKeepHeadRoom`, as today).

## The hint (replaces `HeroSlot area="notice"`)

- Markup: `div role="note" aria-label={tp.warnLabel} data-testid="weather-warning"` → `ul > li (Icon 16 + text)` → `span.computed` with `tp.warnComputed` after the last line (desktop: same line, preceded by " · "; phone: own line).
- Look: `background: color-mix(in srgb, var(--warning) 14%, var(--surface))` (opaque), `border-radius: var(--radius-md)`, padding `--space-1` `--space-3`, text `--text` 600 at the chip size, `.computed` `--text-muted` at the meta size, icon `--warning-ink`. `width: fit-content` on the desktop, full width on the phone.
- Icons: storm `cloudLightning`, wind `wind`, rain `cloudRain`, heat `thermometer`, frost `thermometer`, ice `cloudDrizzle`.
- New kind `ice` in `weatherWarnings`: a day whose `code` is 56, 57, 66 or 67; order storm, wind, ice, rain, heat, frost; still at most two.
- Late path unchanged: `WarningNotice` under the head in the polite live region, same pill look, full width.
- `AreaFrame`'s notice slot is no longer used by weather; the slot itself stays (other modules).

## Chips and lines (the finds of the analysis)

| Find | Change |
| --- | --- |
| A4 | detail line word from `tx.conditions[condId]`, plus at most one addition of [COPY §1](../COPY.md) |
| A5 | dry chip icon `umbrella`; UV chip only while `phase` is not `night`, `dawn`, `dusk`; in those the third chip is `tp.keySunrise` (the next sunrise) |
| A6, A7, A8 | ink by `data-ink`; opaque chips with their own ink ([00-common](00-common.md)); calm scene |
| A9 | `contrast.test.ts` |
| A11 | frost icon |

## States

| State | Scene | Text |
| --- | --- | --- |
| loading (frame stopped waiting) | calm default: `day`, `clear`, season of the device date, no body | dashes as today (`WeatherHeroPending`) |
| no place | same calm default | title "Wetter", empty state in the page |
| stale ("Stand 02:10") | drawn from the stale values; phase from the clock, so a stale forecast at night is a night | detail line ends with `tx.asOf` |
| old cache without `code` | from `group`, intensity 2, no snow depth | word from `tx.codes` |
| "Standbild" / reduced motion | no `data-motion` | – |
| "Schlicht" | layers `sky` + `body` | – |
| "Ruhig" / "Modulfarben: Aus" | greys (`Scene` `calm: true`), ink by theme | – |
| polar day / night | `day` / `night` from `is_day` | – |

## Motion

[CONCEPT §9](../CONCEPT.md); CSS from `mockups/scene-motion.css` (finite iteration counts; `transform` and `opacity` only; `will-change` set only while `data-motion="run"`).

## Tests (acceptance)

1. `scene.test.ts`: every WMO code of [CONCEPT §3](../CONCEPT.md) × `day` and `night` → `cond`, `intensity`, sky key, cloud kind, precipitation kind, landscape state, as a table (`it.each`); every modifier threshold at and below its edge; every phase boundary (minute before / at / after); season × hemisphere.
2. `WeatherScene.test.tsx`: layers present per state (`data-layer`), `aria-hidden`, no element left of x = 900 in the layers `body`, `clouds`, `event` (read the transforms / attributes), element count of the heaviest preset ≤ the ceiling.
3. `contrast.test.ts` ([00-common](00-common.md)).
4. Words: `conditions` for every id in German and English; detail line additions by priority.
5. Warnings: `ice`; order; suffix once; the note's name.
6. e2e (`e2e/weather.spec.ts` grows, new cases appended): the fixture of the analysis → no element with `data-testid="weather-warning"` above the stage, the pill inside it; stage height 280 / ≤ 312; `prefers-reduced-motion` → no `data-motion`; "Schlicht" → two layers; axe on `/weather` **with** a place in both themes, at night and by day.
7. `head-height.seed.spec.ts` adapted as in [00-common](00-common.md); `identity.test.tsx` and `weather.test.tsx` cases that pin `data-sky` on the weather head move to `data-phase` / `data-cond`.
