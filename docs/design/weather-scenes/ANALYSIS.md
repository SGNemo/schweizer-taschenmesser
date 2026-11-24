# Weather scenes – analysis of today's head

Measured on `develop` at b62c7a6 in the e2e build, Open-Meteo answered by a fixture: invented place "Lindenau", 2026-11-24 02:50, −4° (felt −9°), WMO code 1, cloud cover 0 %, wind 9 km/h NE, day −6° / 2°, UV 1.5, sun 07:38–16:24. Paths relative to `web/src/`.

## 1. What `Sky` draws and where

`ui/identity/Sky.tsx` + `Sky.module.css`: a vertical gradient of two stops, one disc (sun: two rings, 5.75 rem; moon: one plain disc, 3.5 rem, always full, always the same spot), one cloud (a pill with two bumps from `box-shadow`), a pale "horizon" wash over the lower 40 %. Four kinds from `skyKind(group, isNight)`: `night` wins over everything, `rain` = drizzle, rain, showers, snow, thunder, `cloudy` = partly, overcast, fog, else `clear`. So **snow, thunder and drizzle look the same, fog looks like a sunny day with a cloud, and every night looks the same** whatever the weather.

| Place | Use | Size |
| --- | --- | --- |
| Weather head (`modules/weather/components/WeatherHero.tsx`) | backdrop of the stage | moon 56 px, cloud 160 × 52 px in a stage of 1650 × 174 px (1920) · moon 36 px, cloud 72 × 24 px in 412 × 278 px (phone) |
| Weather page without a place (`modules/weather/routes/WeatherPage.tsx`) | `Sky kind="clear"` | same |
| Overview widget (`modules/weather/widgets/WeatherWidget.tsx`) | round swatch `compact` | 56 px in a card of 379 × 205 px |
| Overview line (`home/WeatherGlance.tsx`) | the swatch, scaled | 28 px; only when no weather card is on the overview |
| Music head | **not used** – `MusicHero` has its own cover tone and only cites `Sky` as the precedent for the calm rule | – |

The task assumed the music head shares `Sky`; it does not, so nothing there can change by accident. Tests that pin today's look: `ui/identity/identity.test.tsx` (the four kinds), `modules/weather/__tests__/weather.test.tsx` (`data-sky`), `e2e/weather.spec.ts` (`sky` attached), `e2e/seed/head-height.seed.spec.ts` (the first `span` in `[data-sky]` must not overlap the phone's module row; stage ≤ 320 px on both windows).

## 2. Data per weather

| The picture could show | Data today | Gap |
| --- | --- | --- |
| nine words | `codeGroup(code)` | the WMO code itself is thrown away: light / heavy, freezing rain (56, 57, 66, 67), snow grains (77), snow showers (85, 86), hail (96, 99), rime fog (48) are all in the code |
| day / night | `is_day` now and per hour | – |
| twilight, golden hour | `sunrise`, `sunset` per day | only a rule is missing |
| cloud amount | `cloud_cover` now and per hour | not used by `Sky` |
| wind, gusts | `wind_speed_10m`, `wind_gusts_10m` | not used by `Sky` |
| frost, heat | temperature | not used by `Sky` |
| snow on the ground | – | `snow_depth` exists in the same Open-Meteo request (one more variable, same host, same position) |
| moon | – | nothing; to be calculated on the device |
| Saharan dust | – | `dust` exists in the air-quality request already made (one more variable) |
| official warnings, aurora | – | would need a new source: not part of this round |

The cached forecast (`core/weather/cache.ts`, `tm-weather`) has no version and strips unknown keys on read: a new optional field must be added to its schema or it vanishes. A tenth `CodeGroup` would invalidate caches and need words in the frozen languages – the round keeps the nine groups and adds the raw code beside them.

## 3. Critique of the head (1920 and 412)

**Overall.** The idea is right – the sky is the head – but the picture is a tinted bar with a sticker: at 1920 the decoration covers 1 % of the stage and sits where the gear is; the eye lands on the beige bar above, not on the weather.

| # | Finding (from the picture and the measurement) | Severity | Answer in the round |
| --- | --- | --- | --- |
| A1 | **A bar above the bar:** the hint ("Heute: Frost bis -6°") is a 74 px block (95 px on the phone) above the head, the widest and warmest surface on the page; the head starts below the fold's first quarter on the phone | high | the hint moves into the stage ([CONCEPT §7](CONCEPT.md)) |
| A2 | **The picture is small and stuck in the corner:** moon 56 px and one cloud at the right edge of a 1650 px stage; the stage is only 174 px high although 320 px are allowed | high | one scene over the whole stage, stage 280 px ([CONCEPT §6](CONCEPT.md)) |
| A3 | **The gear lies on the picture** (cloud and moon sit in the title row's right end; on the phone the cloud overlaps the module row by 4 px) | medium | nothing but sky and stars in the title row |
| A4 | **"leicht bewölkt" beside "Bewölkung 0 %":** WMO 1 means "mainly clear" but is grouped with 2 | medium | word by code: "überwiegend klar" ([COPY §1](COPY.md)) |
| A5 | **A sun at night:** the dry chip always shows `sun`; "UV 1,5" (the day's maximum) is shown at 02:50 with a sun | medium | `umbrella` for dry; UV only between sunrise and sunset; at night the third chip is the sunrise, later the moon |
| A6 | **Chips unreadable at night in the light theme:** the night sets light ink for the whole head, the chip backing stays white: 1.2–1.6 : 1; the phone's active module pill 1.1 : 1 | critical | ink is decided per scene and chips get an opaque backing with their own ink ([A11Y §1](A11Y.md)) |
| A7 | **"Ruhig" / "Modulfarben: Aus" at night, light theme:** grey wash with light ink, 1.1 : 1 – the whole head is invisible | critical | the calm scene carries its own ink |
| A8 | Rain sky, light theme: dark ink on the top stop 3.2 : 1 (eyebrow fails AA) | medium | every sky is either light enough for dark ink or dark enough for light ink, measured |
| A9 | No test guards the contrast on the sky (`tokens.test.ts` has no `--sky-*`; axe runs on `/weather` only without a place) | medium | contrast table per scene as a unit test |
| A10 | The moon is a plain disc: no phase, same place every night; nothing tells a snowy night from a clear one | medium | packages 1b and 2 |
| A11 | Frost hint uses the icon `cloudSnow` although nothing falls | low | `thermometer` for frost (no snowflake in the icon set) |
| A12 | "fühlt sich an wie -9°": the minus is a hyphen, the figure uses a different one | low | not part of this round; noted for the wording pass |

**Hierarchy.** First the beige bar, then the place name, then the temperature – the temperature, the reason to open the page, is third. On the phone the stage spends 88 px on title and module row and the chips wrap into two rows over the darkest part of the sky.

**What works and stays:** the thin large temperature, the one detail line, three chips for what matters, the calm two-stop sky, the two-ring sun, the round soft cloud, the muted rest line; on the phone the rest line below the stage. The new scene keeps this language and adds depth.

## 4. Limits the scene has to live with

- Stage ≤ 320 px on both windows (`head-height.seed.spec.ts`); today 174 / 278 px.
- **Ratchet-protected tests pin today's picture** (`web/scripts/ratchet.mjs`, [howto/ci-ratchet](../../howto/ci-ratchet.md)): everything under `e2e/seed/**` (the head-height spec with its "first span in `[data-sky]`" check), `ui/identity/identity.test.tsx` (`skyKind`, `data-sky`) and `ui/tokens.test.ts`. A package that must change them names the hit in its PR and waits for the maintainer; it never sets the label `stimulus-raise` itself.
- Stimulus budget (`e2e/stimulus-budget.json`, `d1920--weather`, `p412--weather`): counts coloured `background-color` and skips SVG – a scene drawn as one SVG adds nothing; a `box-shadow` on a scene element would count (today's cloud is the one shadow, so `shadows` falls from 1 to 0 and the baseline is lowered – lowering is free).
- Bundle: the weather page is lazy, but whatever the overview widget imports is on the critical path (budget 691 978 B gzip, 5 %).
- Motion: `data-motion="reduce"` (device-local) and `prefers-reduced-motion` already zero every animation in `ui/global.css`; there is no shared page-visibility hook.
- Widget rule (MODULE-IDENTITY "Widgets"): a card is a tone step without wash; a picture as the card's background is a named exception to decide ([CONCEPT §8](CONCEPT.md)).
- `docs/features/weather.md` is partly stale (names files that no longer exist); package 1a refreshes it.
