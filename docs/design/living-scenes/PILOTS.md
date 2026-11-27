# Living scenes – the overview and three pilots (phase 2, stop)

Pictures: PR text. Rebuild: `PR=1 node docs/design/living-scenes/mockups/render.mjs`, numbers: `node docs/design/living-scenes/mockups/measure.mjs` (both write to `web/.screens/living-scenes/`). The numbers below are from the mockups on 2026-11-27; the stimulus rows use the app's own `measurePage` (`web/scripts/lib/stimulusBudget.ts`) on the mock page.

## 1. The overview (`mockups/p2-overview.html`)

Head, "Jetzt wichtig", agenda, every text and number, card sizes and order stay. Three things change.

| Layer | What | Who gets it |
| --- | --- | --- |
| **Tone** (step 0 and up) | the card's surface takes 6 % of its **area's** colour (plan, money, household, knowledge, vault, system), mixed in srgb. No gradient, border or shadow | every card |
| **Sign** (step 1) | the grey 20 px mark at the end of the card's head becomes a 32 px sign in the module's hue that reads one datum. Data is drawn in the hue; what is not there is the surface or a 1.5 px outline | Wochenlast (seven bars, a dot under today), ToDos (ticks for things done today), Zeiterfassung (dial: arc = today, a hand while a timer runs), Budgets (envelope, fill = spent share), Vorräte (shelf, jars per place), Routinen (house, a window lit per finished room), Einkauf (basket: empty, some, many). Clock: a sky per place (§3) |
| **Scene** (step 2) | a crop of the weather landscape with the module's things, under the page's shared sky. No text on it | weather (as built) and habits (§2); the planner's way later |

**The rule for loud and quiet.** At most **three** scene cards on the page, the weather card included, taken in the grid's reading order; a scene card beyond that shows its sign. On the phone two scene cards never follow each other directly (the second shows its sign). The default home view "Ruhig" (one card) shows no scene. Signs and tone have no cap: a sign is 32 px, a tone is under the threshold at which the budget counts a surface as coloured.

**The shared sky.** Every scene on the page uses the weather's current scene state (time of day, weather, season, moon). Without a weather place: the device's clock and the season, a clear sky. Evening on the overview is evening in every picture; that is where the variety over a day comes from.

**The setting "Bilder: Aus · Ruhig · Verspielt".** Aus = the app as it is today (the weather keeps its own switches). Ruhig = tone, signs and the clock's skies; a scene card shows its sign. Verspielt = everything. The colour mode "Ruhig" and "Modulfarben: Aus" turn pictures grey and the tone off, as they do for the weather today.

## 2. Pilot step 2 – habits, "the garden" (`p2-habits.html`)

The spot is the meadow in front of the cabin's fence. The picture stands **beside** the content on a wide card (the right 44 %, flush with the card's edges) and **under** it on a one-column card and the phone (a strip of 112 px at the card's foot). One crop rule for both: the bed fills the picture's width, the height follows the picture; a tall picture shows more forest, summit and sky above the same bed.

| Datum (`modules/habits`) | In the picture |
| --- | --- |
| goals scheduled today, not archived (as the widget lists them; at most 12, then two rows from 7) | one plant per goal, in list order |
| the goal's place in the list | the bloom's colour (six colours in turn) |
| `dayState` `open` | a closed bud with a tip of its colour |
| `dayState` `partial` (count goals) | half open: three petals above the cup |
| `dayState` `done` | open: five petals and a core |
| a rest day (`skipped`) | a closed bud – as an open goal; a pause is no state |
| days the goal was ever done (count of done entries): 0–2 · 3–9 · 10–29 · 30+ | sprout · young plant · grown plant · bush with three heads. Only rises |
| every scheduled goal is done | the lantern on the fence post is lit (evening, night); two butterflies over the bed (day) |
| no goal | the turned bed with a watering can and a name stick |
| the shared sky | light on every plant; blooms take only a third of the night's darkening so today stays readable |

Not shown, on purpose: names, numbers, missed days, streaks, the weekly count, archived goals. Nothing wilts: a day without a tick leaves buds.

States in the gallery: leer · wenig (one sprout) · normal (the seed's four) · viel (ten, two rows) · besonders (all done) · Pausentag; the same data under day, golden hour, dusk, night, rain and snow. **Still picture:** the mockup is the still picture – nothing in the garden moves; phase 3 decides whether anything may (proposal: no). On the module page the picture is the first block of the tab "Heute": a panel of 340 × 250 beside the list at 1920, a strip of 120 px above it at 412. The head stays `standard` (the plan area's one stage is the weather's).

## 3. Pilot step 1 – clock, "a sky per place" (`p2-clock.html`)

Every place tile keeps its text on the plain tile; at its right edge stands a sky panel (72 px, the tile's height). Tiles narrower than 220 px (phone, one-column card) carry a round 36 px sky in the top-right corner instead – the weather's porthole shape. The sky is the weather's "Schlicht" level: sky and body, nothing else.

| Datum (`modules/clock/logic.ts` `placeTime`) | In the picture |
| --- | --- |
| the place's hour 21–6 (the app's "Nacht") | night sky, stars, the moon |
| 6–8 | the day's sky, the sun low at the left |
| 8–18 | the day's sky, the sun on its arc by the hour |
| 18–21 | golden sky, the sun low at the right |
| the moon's phase today (`core/sky/phases`, one value for all places) | the moon's shape in every night tile |

Not shown, because the clock stores a zone and no position: real sunrise and sunset, the weather there, where the moon stands. The picture says what the hour says. States: leer · wenig (one place) · normal (four) · viel (six) · besonders (full moon, a morning and an evening tile); a strip through 24 hours; module page rows with a 120 × 56 sky.

## 4. Pilot step 0 – finance, tone only (`p2-finance.html`)

"Kontostand" and "Diesen Monat" get the money area's tone and nothing else. No level, no picture: an amount drawn as a picture can be read across a room, and "Werte ausblenden" would have to hide the picture too. The tone is the same in every state (leer, wenig, normal, viel, values hidden) – it marks the area, never a state. The module page does not change.

## 5. Numbers

| What | Result |
| --- | --- |
| Text on the toned surface, light 6 % | every ink ≥ 4.5:1; lowest `--text-3` 4.94 (white card: 5.40) |
| …, dark 6 % | lowest 4.56. 8 % falls to 4.39 – so 6 % is the ceiling in the dark, where the tone is barely seen; colour in the dark comes from signs and pictures |
| …, light 12 % (the louder variant) | `--text-3` 4.47 on vault – fails; the "Werte ausblenden" mask nearly vanishes |
| Signs, the hue on the toned surface | ≥ 3:1 everywhere; lowest 4.23 (Vorräte, light) |
| Picture text contrast | none: no text stands on a module picture |
| Weather yardstick ([A11Y §4](../weather-scenes-2/A11Y.md)) | ≤ 220 elements, ≤ 64 KB, one frame |
| Garden as drawn in the mockup (the whole landscape, cropped) | 175–246 elements, 71–80 KB – **over**: the mockup draws the world outside the crop too |
| Garden, only what the crop shows | wide 60–160 elements, 39–61 KB · strip 45–115, 27–35 KB – inside. Package 1's kit must skip what a crop does not show |
| Clock sky | 19 elements, 1.6 KB each |
| First paint, 4× CPU, overview Aus → Verspielt | 1920: 352 → 336 ms · 412: 248 → 340 ms (median of 3; an earlier run of 5: 320 → 392 and 256 → 316) |
| Motion | none in any new picture |

**Stimulus budget (`check:stimulus`), first viewport of the overview, light:**

| | coloured above the fold | `<svg>` (budget "icons") | borders · shadows | height |
| --- | --- | --- | --- | --- |
| Aus (today) | 20 | 104 | 0 · 0 | – |
| Verspielt, tone 6 % | 20 (+0) | 108 (+4: the clock's skies; a sign or a scene replaces a mark) | 0 · 0 | 1920: +0 · 412: +112 px per strip (band ± 940) |
| Verspielt, tone 12 % | 24 (+4) | 108 | 0 · 0 | same |

So the design as drawn stays inside today's budget on the overview (bands: icons ± 17, coloured ± 1, height ± 10 %). Module pages: the habits page gains one picture (phone: + 120 px; today 915 px, band ± 91) – measured in its package. The honest remark: the page is visibly more colourful than "+0" says, because the budget counts a picture as one icon. Share of the first screen covered by pictures: 0.8 % (1920), 0 % (412) – pictures sit below the fold in the seed's order.

## 6. The stop – three questions (recommendation first)

1. **Direction:** yes as shown (tone + signs + at most three scenes; garden, clock skies, money in tone only) · or which pilot to change.
2. **Stimulus budget:** it need not rise – stay at tone 6 % · or allow the louder tone (12 %: + 4 coloured surfaces at 1920, meta text under AA until its ink is darkened).
3. **Which modules first** (after package 1 "kit" and package 2 "overview"): habits and clock, then the cheap signs (Wochenlast, Budgets, Downloads feed blocks that exist), then Zeiterfassung, Vorräte, Routinen, ToDos, Einkauf, Personen, Fitness; the planner's way after planner hub 2; music last · or another order.

## 7. Known faults of the mockups (for phase 3, not for the stop)

- Rain and snow are scaled with the crop: in the garden the streaks are too long. The kit draws precipitation in the picture's own scale.
- A wide card with many rings makes a tall picture in which forest and summit outweigh the bed; phase 3 sets a tallest shape.
- "viel": the widget lists as many rings as fit, the bed shows every scheduled goal; the summary line names the total.
- The word beside 06:00 and 20:00 is "Tag" (the app's two words); the sky has four looks. COPY decides whether the word follows.
- The weather card's own drawing is 69 KB in the mockup's form and does not get cheaper by a box test (its paths span the width).
