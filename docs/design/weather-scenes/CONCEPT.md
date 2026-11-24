# Weather scenes – concept: the scene system

Moon: [CONCEPT-MOON](CONCEPT-MOON.md). Sky events: [CONCEPT-EVENTS](CONCEPT-EVENTS.md). Words: [COPY](COPY.md). The drawing itself: `mockups/scene.js` (state → SVG), measures in [handoff/00-common](handoff/00-common.md).

## 0. Eight sentences every package keeps

1. **Same language, more depth.** Soft, flat, round, calm colours; no photos, textures, outlines or blur. Own drawings only.
2. **The picture shows what the data says and nothing else.** Every layer names its data field; without the field the layer is not drawn. No invented weather.
3. **Text wins.** Every text on the sky has AA contrast in every scene; the scene keeps a shelter free for it. Chips, pills and the hint carry their own opaque backing and ink.
4. **What the picture shows is also a word.** The scene is `aria-hidden`; phase, weather, frost, event stand as text.
5. **One head.** No bar above it; the hint of the day lives in the stage and still says "berechnet, keine amtliche Warnung".
6. **It comes to rest.** Motion is the answer to opening the page: it runs **5 s**, then stands still; none with `prefers-reduced-motion`, `data-motion="reduce"`, "Standbild", "Schlicht", "Ruhig", "Modulfarben: Aus", a hidden page, or in any small version. Nothing blinks – a bolt is a still shape.
7. **Local and cheap.** Moon and events are calculated on the device or read from a shipped table; no new network destination. One SVG per scene, at most 220 elements, animation only as `transform` (and one `opacity` fade of the precipitation) on at most 9 groups ([A11Y §4](A11Y.md)).
8. **Off is one tap.** "Bild im Wetter-Kopf": Mit Bewegung · Standbild · Schlicht (nur Himmel); "Mond und Himmelsereignisse" on / off. Both live in the shared `weather` settings scope (`core/weather/settings.ts`, Einstellungen → Verbindungen → Wetter), because the overview reads them too.

## 1. Layers and the data they read

One SVG, `viewBox 0 0 1600 320`, `preserveAspectRatio="xMaxYMax slice"`: a wide head shows all of it, a phone head the right ~570 units – so the right third is a complete picture (body, peaks, trees) and the left two thirds stay quiet for text.

| # | Layer | Draws | Reads |
| --- | --- | --- | --- |
| 1 | `sky` | gradient of 2–3 stops, one horizon glow in twilight | phase (§2), sky family of the condition (§3), theme |
| 2 | `stars` | up to 60 points, 6 sparkles; fewer with cloud and moonlight | phase, `cloud_cover`, moon light and altitude |
| 3 | `body` | sun (two rings + halo) or moon (true phase, tilt, maria) on an arc in the right third; a pale day moon | `is_day`, sunrise / sunset (position on the arc); moon: [CONCEPT-MOON](CONCEPT-MOON.md) |
| 4 | `cloudsFar`, `clouds` | none … overcast deck by cover; rain and storm clouds darker and flat-based | `cloud_cover`, condition, wind level |
| 5 | `ridgeAlp`, `ridgeFar` | a pale far range and a nearer mountain with two peaks, each summit with one darker flank; snow caps | season; caps: winter, temperature ≤ 0°, snow falling or lying |
| 6 | `fog` | five soft bands between the ridges | WMO 45, 48 |
| 7 | `ridgeMid` | forested hills, conifers | season, snow lying, wind level (lean) |
| 8 | `event` | rainbow, meteors, bolt, eclipse parts | [CONCEPT-EVENTS](CONCEPT-EVENTS.md); bolt: WMO 95–99 |
| 9 | `precip` | rain strokes, drizzle, snow dots, hail pellets; 30 % strength over the text shelter | WMO code (kind, intensity), wind level (slant) |
| 10 | `water`, `ridgeNear`, `shelter` | a small lake (reflects a low body, freezes at hard frost), foreground hill with three trees and bushes (wet, snowy, rimed, dry), the haze that keeps the left quiet | condition, `snow_depth`, temperature, season |
| 11 | `wind` | three curled strokes, leaves in a storm | wind, gusts |

**Text shelter:** nothing with hard contrast (body, clouds, bolt, rainbow, trees above the ridge line) left of x = 900; nothing but sky and stars above y = 60 (the title row with the gear). The overcast deck may cross: it is one flat tone. **The shelter follows the crop:** whenever the stage shows fewer than 1600 units, `quietX` is set to the right edge of the text column (in scene units), so clouds, caps and full-strength precipitation stay right of the text at 1280 as at 412; the body keeps its own box.

New data, all optional and additive in `Forecast` and in the cache schema: `tz` (the IANA zone name the forecast response already carries as `timezone`; needed for the place's day bounds), `code` (raw WMO, now / hour / day), `now.snowDepth` (m; one more variable `snow_depth` in the existing forecast request), `air.dust` (µg/m³; one more variable in the existing air request). Same host, same rounded position, no new data flow ([DATA-FLOWS](../../legal/DATA-FLOWS.md) row unchanged). A forecast cached without `code` draws from the group (intensity 2).

## 2. Time of day (phase)

From today's `sunrise` / `sunset` at the place and the place's local time; without them `is_day` decides between `day` and `night`.

| Phase | When | Sky | Body |
| --- | --- | --- | --- |
| `night` | more than 40 min before sunrise or after sunset | deep blue | stars; from package 2 the moon while it is above the horizon |
| `dawn` | 40 min before sunrise → sunrise | dark above, warm glow at the horizon | no sun, last stars; the moon if it is up (package 2) |
| `golden` | sunrise → +45 min, and 60 min before sunset → sunset | pale blue to warm | low warm sun, partly behind the far ridge |
| `day` | between | blue | sun on its arc: `t = (now − sunrise) / (sunset − sunrise)` |
| `dusk` | sunset → +40 min | dark above, rose glow | no sun, first stars; the moon if it is up (package 2) |

Polar day / night (no sunrise or sunset in the data): `day` or `night` all along. With more than 85 % cloud or precipitation, twilight falls back to the grey sky of the condition and keeps the horizon glow at 40 %.

## 3. Weather × time of day → layers

`cond` and `intensity` come from the WMO code; the word from [COPY §1](COPY.md).

| WMO | `cond` | Sky by day / night | Clouds | Precipitation | Landscape |
| --- | --- | --- | --- | --- | --- |
| 0 | `clear` | day / night | by cover (normally none) | – | dry |
| 1 | `mostlyClear` | day / night | by cover, at least one small | – | dry |
| 2 | `partly` | day / night | by cover, at least large + small | – | dry |
| 3 | `overcast` | overcast / night-overcast | deck; the body a pale glow | – | dry, flat light |
| 45 | `fog` | fog / night-fog | – | fog bands; far ridge 40 % | – |
| 48 | `fog` + frost 1 | same | – | fog bands | rime on crests and trees |
| 51 · 53 · 55 | `drizzle` 1–3 | drizzle / night-overcast | deck | 50 short strokes | wet |
| 56 · 57 | `freezingDrizzle` | same | deck | same | ice glaze line |
| 61 · 63 · 65 | `rain` 1–3 | rain / night-rain | rain clouds | 45 / 80 / 120 strokes | wet, gloss strokes |
| 66 · 67 | `freezingRain` | same | rain clouds | strokes | ice glaze line |
| 71 · 73 · 75 | `snow` 1–3 | snow / night-snow | deck, light | 60 / 100 / 150 dots, two depths | white |
| 77 | `snow` 1 (grains) | same | deck | 60 small dots | white |
| 80 · 81 · 82 | `showers` 1–3 | day / night, one dark shower cloud, the sun peeks out | by cover + shower cloud | strokes under that cloud only | wet |
| 85 · 86 | `snowShowers` | snow sky, broken | by cover + snow cloud | dots under that cloud | white |
| 95 | `thunder` | storm / night-rain | storm cloud, lit underside | heavy strokes + one still bolt | wet, dark |
| 96 · 99 | `thunderHail` | storm | storm cloud | strokes + 40 pellets + bolt | wet |

Cloud count by `cloud_cover` (where the row says "by cover"): ≤ 10 none · ≤ 35 two small · ≤ 60 large + small · ≤ 85 two large + medium, body half covered · > 85 deck.

**Strength and modifiers** (wind 2 and 3 use the limits of `core/weather/logic.ts` `rate()`, hard frost the −5° of `modules/weather/warnings.ts`; wind 1, frost at 0° and heat at 30° are new limits of the picture only – they change no rating and no hint):

| Modifier | Rule | Picture | Word |
| --- | --- | --- | --- |
| wind 1 | wind ≥ 20 or gusts ≥ 35 km/h | trees lean 6° | – |
| wind 2 | wind ≥ 35 or gusts ≥ 50 | lean 12°, clouds stretched with streaks, wind strokes, rain slanted 28° | windig |
| wind 3 | wind ≥ 50 or gusts ≥ 70 | lean 20°, leaves, rain 42° | Sturmböen |
| frost 1 | temperature ≤ 0°, nothing falling | rime line on the crests, light conifer tops, caps on the peaks | Frost (only when neither a snow word nor "Schnee liegt" stands) |
| frost 2 | temperature ≤ −5° | plus sparkles, paler meadow | Frost |
| snow lies | picture: `snow_depth` ≥ 1 cm, or it snows | white ridges, capped conifers | Schnee liegt (only when `snow_depth` ≥ 1 cm and the weather word is not a snow word) |
| heat | temperature ≥ 30° by day | larger sun, warm haze band, dry meadow | Hitze |
| season | month and hemisphere of the place (tropics: summer) | meadow and crown colours; winter crowns bare | – |

## 4. Landscape – two directions, one decision

| | A "Mittelgebirge" (chosen) | B "Hügel mit Ort" |
| --- | --- | --- |
| Picture | far ridge with two soft peaks, forested middle ridge, foreground hill with three trees | three rolling hills, a village with a church tower, lit windows at night |
| For | what the maintainer named ("Mond und Berge"); peaks carry snow caps, rime and moonlight – weather reads on them; no place is claimed | warm and homely; the lit windows make the night friendly |
| Against | less "home" than a village | claims a place that is not the user's (a church in Lindenau, Singapore and Tromsø alike); houses are detail that fights with text at phone size; windows are small bright points near the chips |

**Decision: A, the only landscape built.** The layer contract (`landscape: 'mountains'`) leaves room for a second one, but a chooser is a decision nobody needs every day (FOCUS: fewer decisions); B stays a drawn alternative in the gallery. If the maintainer wants B after seeing it, it is one more package (a `select` beside "Bild im Wetter-Kopf"), not a redesign.

## 5. Building blocks

- **Weather gets its own scene; `Sky` does not grow.** New `ui/weather-scene/` (`WeatherScene`, `ScenePorthole`, `MoonGlyph`; pure SVG, no state of its own) and a pure model `core/weather/scene.ts` (`sceneOf(input) → SceneState`, signature in [handoff/00-common](handoff/00-common.md)), tested as a table. `core/` and `ui/` are importable from the module and from `home/`; nothing imports the weather module. The music head never used `Sky`; when package 4 lands, `Sky` has no caller left and is removed with its `--sky-*` tokens.
- Colours as `--scene-*` tokens in `ui/tokens.css` ([handoff/00-common](handoff/00-common.md)); ridge tones are mixed from a base and the sky's bottom stop (`color-mix`), so one palette per phase suffices.
- The scene sets the stage's ink: `data-ink="light|dark"` on the stage replaces `HeadSurface`'s `:has([data-sky='night'])`.
- **"Ruhig" / "Modulfarben: Aus":** the same shapes in greys at low contrast (no colour, no motion), ink by the theme – the picture stays a picture, the head stays readable (A7).
- **"Schlicht":** layers 1 and 3 only (sky and body: the sun by day, from package 2 the moon in its true phase).

## 6. Size and place

| | 1920 (stage 1650 wide) | 1280 (stage ~1010) | 412 |
| --- | --- | --- | --- |
| Stage height | **280 px** (today 174; limit 320) | 280 px | **272 px**, ≤ 300 with two hints (today 278) |
| Title row | 56 px: plate, eyebrow, place as h1, gear at the right end – on sky and stars only | same | 44 px, then the module row 44 px on its own opaque backing |
| Scene | all 1600 units; body and peaks in the right third | the right ~1150 units (slice) | the right ~570 units; the body sits below the module row |
| Text | temperature, detail line, hint, chips, rest line in the left half, ending above the left ridges (y ≤ 250) | same; the rest line may wrap once; `quietX` at the text column's edge | temperature and detail line left of the body; hint; one row of two chips (rain / dry and wind – on an event day the event chip takes the wind chip's place and the wind goes to the rest line); the rest line in the page below the stage begins with the third chip's fact (UV, sunrise or the moon) |

Heights by hints (desktop / phone): none 280 / 272 · one 280 / 272 · two ≤ 290 / ≤ 300; the guard stays 320. The stage grows by 106 px on the desktop – the price for "larger"; the page below starts lower by that much minus the 86 px the hint bar no longer takes (74 px + 12 px margin; net +20 px with a hint, +106 px without). On the phone the stage shrinks by 6 px (or grows by up to 22 px with two hints) while the 107 px of the hint bar (95 + 12) go away.

## 7. The hint in the head

- **Where:** one pill in the stage, directly under the detail line: icon · "Heute: Frost bis −6°" · quieter suffix "berechnet, keine amtliche Warnung". Opaque backing (`--warning` 14 % over `--surface`), ink `--ink-theme` (the theme's text colour, not the stage's), suffix `--ink-theme-muted`, icon `--warning-ink`; readable on any sky. `role="note"`, name "Wetterhinweis" (as today).
- **Several:** at most two (as today), one per line in the same pill, the suffix once at the end. On the day of a solar eclipse the safety pill (package 3) takes one of the two places: then only the first weather hint stays in the stage, a second one appears under the head like a late hint.
- **Phone:** the suffix wraps to its own line inside the pill; the pill takes the stage's width.
- **Late forecast** (the frame stopped waiting): unchanged – the hint appears under the head in the polite live region, so nothing painted moves.
- **An official warning** (package 3b, [CONCEPT-SOURCES §3](CONCEPT-SOURCES.md)): its own filled pill, "Amtliche Warnung: Frost · bis Mi. 10:00 · Quelle: DWD", without the suffix; it replaces today's computed hints. The two never share a pill, so the difference stays visible.
- The scene does not illustrate the hint: it shows the weather now. A frost hint for tonight over a mild afternoon stays a line.

## 8. Small versions

| Where | Version | Decision |
| --- | --- | --- |
| Overview widget | **the scene as the card's background** (the maintainer's wish of 2026-11-24): the same SVG sliced into the card, text on the quiet left with the scene's ink, no motion; "Ruhig" and "Modulfarben: Aus" fall back to the plain card with the porthole | **decided: yes** (maintainer, 2026-11-24), as the one named exception to "a widget is a tone step" (MODULE-IDENTITY "Widgets") – the sky is this module's identity as the cover is the music's; a budget hit of the home pages is named in package 4's PR |
| Overview widget, alternative | porthole: a round crop of 64 px (sky, body with the true phase, clouds, one ridge, a few marks of rain or snow) on the plain card | fallback if the exception is declined; always the "Ruhig" look |
| Overview line | porthole 28 px | built |
| Forecast day row | the line icon stays (seven coloured discs in a list would raise the stimulus load for no information); **new: moon glyph 18 px in `currentColor` + phase name** at the end of the row | built |
| Hour cards | unchanged | 24 small pictures are noise |
| Android | the same web app; no native widget exists | package 4 measures on the phone profile |

## 9. Motion

| Layer | Moves | How long | Still picture |
| --- | --- | --- | --- |
| clouds | drift 16 units to the lee | once, 5 s, ease-out | at the end position |
| precip | rain tile loop 2.4 s (heavy 1.6 s), snow 10 s / 15 s | 5 s (a fractional loop: both tiles are drawn, so any stop is a whole picture) | marks in place |
| fog | bands ±20 units | once, 5 s | in place |
| trees (wind ≥ 2) | sway ±2° | three times in 5 s | leaning |
| body, stars, bolt, rainbow, eclipse, meteors, ridges | never | – | – |

Plays once when the weather page is opened (and again after the page was hidden for more than a minute), pauses while `document.hidden` or the stage is scrolled away. Widgets, portholes and glyphs never move. **Why motion is on by default** although FOCUS says "no extra animation except feedback to an action": it is the 5-second answer to opening the page, ends by itself, and is one of three options – confirmed by the maintainer on 2026-11-24 ("Bewegung an, aber abschaltbar zu Standbild").
