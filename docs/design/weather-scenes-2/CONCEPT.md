# Weather round 2 – the scene, version 2

The drawing itself is `mockups/scene.js` (state → SVG) with `palette.js`; this page says what it draws from which data. Days and hours: [CONCEPT-DAYS](CONCEPT-DAYS.md). Values on the page: [CONCEPT-INFO](CONCEPT-INFO.md). Words: [COPY](COPY.md). Measures and tokens: [handoff/00-common](handoff/00-common.md).

## 0. What changes against round 1's eight sentences

| Round 1 | Round 2 |
| --- | --- |
| 1 "Same language, more depth: soft, flat, round" | **Direction B "Facetten":** flat colour, no outline, no texture – but the mountains are angular bodies with a lit and a shaded face, the forest is many trees of six kinds, the foreground has things the weather acts on. Land, lake and clouds stay round. |
| 2 "The picture shows what the data says" | holds, and now also **how strong** it is: every level in §3 has its data rule and its own picture |
| 3 "Text wins" | holds; the phone's picture carries only temperature and detail line |
| 6 "It comes to rest … nothing blinks" | holds; one addition decided by the maintainer: in a thunderstorm the glow at the cloud brightens **once**, slowly (§7) |
| 7 "at most 220 elements" | new ceilings in [A11Y §4](A11Y.md) |
| 4, 5, 8 | unchanged |

New sentence 9: **the body is seen whenever it is above the horizon** – clear, through a veil, between cloud banks, or pale through wet cloud; never replaced by a glow alone.

## 1. The landscape (one, fixed)

`viewBox 0 0 1600 320`, `xMaxYMax slice`. Right of x ≈ 850 the full picture, left of it the quiet side for text.

| Depth | Layer (`data-layer`) | Drawn | Round or angular |
| --- | --- | --- | --- |
| 1 | `ridgeAlp` | a pale range across the whole width; in front of it the **massif**: six mountains, each its own body (`G.mountains`: silhouette, summit, arête, ribs, gullies, snow fields), drawn back to front | angular |
| 2 | `ridgeFar` | wooded hills with clearings and small trees on the crests | round |
| 3 | `ridgeMid` | forest in two staffels: skylines of spruces with round crowns among them, light broadleaf crowns in front (not in winter); right of the lake single firs behind the cabin | – |
| 4 | `water` | a meadow behind the lake with four far houses; the lake – round, whole, with a shore rim; the massif mirrored in it; a jetty and a boat | round |
| 5 | `ridgeNear` | round ground with a fold, a way, a shed, the cabin (logs, chimney, door, three windows, wood pile), fence, flag at the lake, trees of six kinds (`G.trees`: spruce, fir, pine, birch, leaf, bush), grass, rocks | round |

Light: the side of every mountain, tree and crown that faces the body is lit; the other is shaded. The body moves on its arc (`G.arc`), so the picture changes with the hour. In twilight the lit faces and the snow take the colour of the low sun.

## 2. How the body is seen

| Mode | When | Picture |
| --- | --- | --- |
| `clear` | cover 0–3 | the disc; clouds step aside (cover 3: they close in to a gap) |
| `veil` | high cloud ≥ 50 % with low and middle cloud ≤ 30 % (cover is then 0 or 1 by the rule in §3; without the three heights there is no veil) | long pale streaks; the disc with a ring around it |
| `hole` | cover 4, nothing falling, no fog | the deck (four rolls, darkest lowest) opens softly around the body; **six cloud banks** stand in the opening, each its own shape, dark with the edge toward the body lit; one reaches a little over the disc's lower edge; two shreds drift past; stars in the opening at night. No outline of a hole anywhere |
| `schein` | cover 4 with rain, snow or fog; thunder from level 2; fog level 2 | the disc pale (moon 72 %, sun without its core) in a soft light on the deck – the phase stays readable |
| – | the body is below the horizon | nothing in the picture; the moon chip stays as built (it names tonight's phase) |

Same rule for the sun by day. A body low on its arc stands behind the massif and rises out of the saddles.

## 3. Levels: data → level → picture

`h` is the hour row the scene is drawn for (now, or the chosen hour). Every rule is a table test in package A.

| What | Level | Rule | Picture (amounts in `scene.js` `G`) |
| --- | --- | --- | --- |
| **Cloud** | 0 | `c` ≤ 10, where `c` = the larger of low and middle cloud when the three heights are known, else `cloud_cover` (so thin high cloud alone is never a deck) | no cloud |
| | 1 | `c` ≤ 35 | two small clouds |
| | 2 | ≤ 60 | four clouds |
| | 3 | ≤ 85 | nine clouds, two faint ones over the quiet side; the body in a gap |
| | 4 | > 85 | the deck (§2) |
| **How sunny** (day) | 3 | `sunshine_duration` ≥ 45 min in the hour – the field wins where it exists; without it: cover ≤ 1. Under a deck (cover 4) no rays are drawn whatever the field says: §2 decides | sun with twelve rays, cast shadows, a sunlit band on the meadow, sparkle on snow |
| | 2 | 20–44 min (cover 2) | eight short rays, lighter shadows |
| | 1 | 5–19 min (cover 3) | the disc without rays |
| | 0 | < 5 min (cover 4) | per §2 |
| **Rain** | 1 · 2 · 3 | WMO 61 · 63 · 65 (showers 80 · 81 · 82); a cached value without a code: amount < 2.5 · < 7.5 · ≥ 7.5 mm/h | 46 · 96 · 170 strokes, longer and thicker per level; splashes 0 · 10 · 26; puddles 1 · 2 · 3; rings on the lake; from level 2 the dark sky; showers fall only under their cloud |
| drizzle | – | WMO 51–55 | 60 short fine strokes, the pale grey sky |
| freezing | – | WMO 56, 57, 66, 67 | plus a glaze line on the ground |
| **Snow** | 1 · 2 · 3 | WMO 71, 77, 85 · 73 · 75, 86 | 60 · 110 · 170 flakes in two depths; level 3: larger flakes, the massif half gone |
| **Snow cover** | 1 · 2 · 3 | `snow_depth` ≥ 1 · ≥ 5 · ≥ 20 cm (or it snows at level ≥ 2: at least 1) | 1 dusted: the meadow pale, tips white · 2 closed: ground, roofs, hills, massif white, trees capped, the lake frozen, blue shadows · 3 deep: plus a thick roof load |
| **Thunder** | 1 | WMO 95 with amount < 2.5 mm and gusts < 50 km/h and `cape` < 800 J/kg (unknown counts as low) | one tower with sky around it, one bolt, rain at level 1 under the tower only |
| | 2 | every other case; WMO 96 is at least level 2 | a dark base across the sky with billows above, two bolts (the long strike, the forked one), rain at level 2; with 96 forty hailstones |
| | 3 | WMO 99, or amount ≥ 10 mm, or gusts ≥ 70 km/h, or `cape` ≥ 2000 | four bolts (plus the crawler under the base and the far one), rain at level 3; with 96 / 99 forty hailstones |
| **Fog** | 1 | WMO 45 / 48 | the massif at 35 %, the hills at 65 %, three bands between the layers |
| | 2 | and `visibility` < 300 m (without the field: level 1; no other fallback) | the massif gone, hills 22 %, forest half, five bands, a veil over everything but the nearest trees |
| **Wind** | 0 still | wind < 20 and gusts < 35 km/h | smoke stands and spreads, the flag hangs, the lake mirrors the massif |
| | 1 Brise | wind ≥ 20 or gusts ≥ 35 | smoke leans, flag half out, grass leans, a few ripples, the mirror pales |
| | 2 kräftig | wind ≥ 35 or gusts ≥ 50 | trees lean, crowns shift, smoke a flat streak, flag straight, eight leaves (snow dust over a snow cover), ripples, rain slanted, clouds sheared, three streaks in the air |
| | 3 Sturm | wind ≥ 50 or gusts ≥ 70 | trees bent, flag frayed and the pole bent, smoke torn, sixteen leaves, whitecaps, rain at 39°, the boat tilts, spindrift off snowy summits |
| direction | – | the picture looks toward the sun's arc: south in the northern hemisphere (east is left, west is right), north in the southern. Northern: wind from 180°–360° (a westerly) blows **to the left**, from 0°–180° to the right; southern: mirrored | lee side of smoke, flag, lean, rain, leaves |
| **Frost** | 1 | temperature ≤ 0°, nothing falling | hoar on the grass, rime on the tips, an ice rim on the lake |
| | 2 | ≤ −5° | the lake frozen, sparkle |
| **Heat** | – | ≥ 30° by day | a larger sun with sixteen rays, a warm haze over the land, dry meadow, shimmer lines |
| **Wet** | – | rain now or ≥ 0.2 mm in the hour before | puddles |
| **Season** | 4 | month and hemisphere (tropics: summer) | meadow and crown colours, flowers in spring, fallen leaves in autumn, bare branches in winter, snow fields on the massif by season |
| **Lights** | – | night, dawn, dusk, or a rain / storm sky | the cabin's windows and the far houses are lit |

The word beside the picture names the same level ([COPY §1](COPY.md)): the thunder and fog words are derived from the level function, the rain and snow words from the code as in round 1.

## 4. Sky and time of day

Phases as in round 1 (`night`, `dawn`, `golden`, `day`, `dusk` from sunrise and sunset). Sky keys as built in round 1 (`skyOf`), with these changes, all so that the level is seen in the sky too: thunder level 1 takes the `rain` sky (the tower needs sky around it; `storm` from level 2) · rain level 1 takes the pale `drizzle` sky, levels 2 and 3 `rain`; showers likewise by level · drizzle at night takes `night-rain` · `night-full` keeps the product's rule (the full-moon flag), the mockup's "lit more than 90 %" is only its stand-in · an overcast night uses the lighter sky under the deck (`palette.js`). How a sky lights the land is one table (`palette.js` `light`): every land tone is greyed and mixed toward the sky's light; far layers are mixed toward the sky's lower colour (haze).

## 5. Size and place

| | Desktop | Phone |
| --- | --- | --- |
| Stage | **320 px** (was 280; the guard's limit) | the picture **256 px** (title row 44 + module row 44 + 168 of picture) |
| On the picture | title row, temperature, detail line, hints, three chips, rest line – left of the picture's busy part | title row, module row, temperature and detail line only |
| Under the picture | – | hints (as a pill), two chips, then the rest line – in this order, directly under the stage |
| Crop | all 1600 units | the right 896 units at scale 0.46 (`Scene.phoneOpts`; at this scale the summits stay below the temperature and the detail line); `quietX` 1000; the body stands between the main summit and the third (`G.phoneBodyX` = 1438) at y = 46 + 0.6 × (arc y − 70), so a high body is at 46 and a low one sinks behind the ridge |
| Head height in all | 320, fixed – also with two hint rows (title 56 + temperature and detail 76 + two pills 68 + chips 44 + rest line 28 + padding fit) | the head (`module-frame` stage) is the picture: **256 px**; the block under it (hints, chips, rest line) belongs to the page, not to the head – about 54 px without a hint, about 94 px with one |
| Guard | the head-height seed spec's limit of 320 stays as it is and holds | same |

The quiet side: left of `quietX` every far layer fades 85 % toward the sky, running out over the next 330 units (one gradient per layer, no extra element); nothing but sky, the pale range, hills and forest stand under text. Contrast per sky: [A11Y §1](A11Y.md).

## 6. Small versions, "Schlicht", "Ruhig"

- **Schlicht:** sky and body only; under a deck the body in `schein`.
- **Ruhig / Modulfarben: Aus:** as built (greyscale and a wash); no motion.
- **Overview line (porthole 28 px) and widget card:** built in round 1's package 4 on the old drawing; package D moves them to the new one ([handoff/D](handoff/D-small.md)). The porthole shows sky, body in its mode, the massif's main summit and one cloud bank or cloud by cover – no foreground.

## 7. Motion

Runs five seconds after the page opens on "now", then stands; not when a day or hour is chosen (200 ms cross-fade instead); none with reduced motion, "Standbild", "Schlicht", "Ruhig", a hidden page, or in any small version. Only `transform` and `opacity`.

| What | Moves | Still picture |
| --- | --- | --- |
| precipitation | falls along its slant (loop; fades in place at the end) | marks in place |
| clouds, banks | drift 16 units to the lee, once | at the end position |
| smoke | rises and sways a little | as drawn |
| flag (wind ≥ 1) | waves three times | as drawn for its level |
| trees (wind ≥ 2) | sway, one 5 s iteration | leaning |
| the glow where the main bolt leaves the cloud | **brightens once: 1.2 s up, 1.2 s down, starting 1 s after opening** | at its resting strength |
| bolts, body, stars, mountains, water, everything else | never | – |

Why the glow may move although nothing else lights up by itself: decided by the maintainer on 2026-11-26. It is one brightening (WCAG 2.3.1 allows three per second; this is one in five seconds), small (a 104-unit circle, 34 % → 70 % of a pale yellow), and it ends by itself.
