# Weather round 2 – three drawing languages (phase 2, stop)

The same three scenes – (a) an overcast frost night with the moon in a hole of the deck, (b) a strong thunderstorm by day with a strong wind, (c) a sunny winter day with snow on the ground – on the same landscape (`mockups/styles.js`, geometry `G`), in three languages, under the real head text at 1920 and 412. Pictures: PR text; rebuild with `node docs/design/weather-scenes-2/mockups/render.mjs`.

What all three share, because the brief sets it: an angular massif with a saddle the moon or sun stands in, two ranges, forest in two staffels, a lake, a hut with smoke, a fence, a flag, single large trees; the overcast deck as three rolls with a rimmed hole; three drawn bolts, none of which flashes; the wind seen on trees, flag, smoke, leaves and water; the snow cover on everything.

| | A · Staffeln | B · Facetten | C · Bilderbuch |
| --- | --- | --- | --- |
| Language | flat silhouettes in many layers, depth by haze only; mountain, forest, hut are outlines | cut paper with light and shade: every summit has a lit and a shaded flank, trees and hut two tones, the range stands in the water | flat colour with a dark contour and hatching, like a comic drawing |
| For | the calmest and the cheapest; the strongest mood at night and in a storm; text sits on it most easily | gives what was asked for by name – angular peaks with flanks, real-looking trees, a scenery with depth – and is still flat and cartoon; the light side follows the moon or sun, so the picture changes with the day | the most "cartoon"; every thing is readable as a thing even at phone size |
| Against | "es fehlen Details" stays half true: a silhouette has no inside; a hut is a black shape | more shapes to port and to keep in tune per sky; the shaded faces need care so they read as rock, not as patches | contours double the edges behind the text and the chips; the calm of round 1 is gone; a night scene in outlines looks busy; farthest from the app's own flat look |
| Elements (ceiling 220) | 73–86 | 78–97 | 76–97 |
| Markup, unoptimised | 37–53 KB | 49–61 KB | 40–48 KB |
| First paint, 1650 px and 412 px at 4× CPU throttle | one frame | one frame | one frame |

Cost note: all three stay far under the element ceiling of round 1 and paint within one frame. The markup of A and B is over round 1's 48 KB in the mockup because the forest skylines are long literal paths; package A draws a skyline once and repeats it with `<use>` (as round 1 does for the rain tile) – the ceiling of 48 KB stays.

**Recommendation: B.** It is the only one that answers every word of the brief without giving up the calm: A is the same idea with the inside left out (and B falls back to exactly A in "Ruhig"), C trades the calm for charm.

## The three questions

1. **Direction:** B (recommended), A or C.
2. **May the picture grow?** Recommended: yes. Desktop stage 280 → **320 px** (the existing guard's limit). Phone: the picture carries only the temperature and the word and is 256 px high; the hint and the chips move directly under it (head with one hint 272 → about 350 px, without a hint about 310 px). Reason: today the chips cover the foreground (K11) – exactly the part where wind, rain and snow are seen. Alternative: keep 280 / 272 and accept that the phone shows mostly sky.
3. **May bolts move?** Recommended: **no, they stand.** More storm is more drawn bolts (1 / 2 / 3) and a still glow where the main bolt leaves the cloud. Alternative, inside FOCUS and WCAG 2.3.1: the glow brightens once, slowly (1.2 s up, 1.2 s down, one time in the five seconds of opening motion, never a second time, off with reduced motion and "Standbild") – one brightening, far under three per second, but it is the first thing in the app that lights up by itself.
