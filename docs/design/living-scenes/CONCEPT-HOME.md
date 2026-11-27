# Living scenes – the overview (package 2)

Mockup: `mockups/p2-overview.html` (`?sky=day|golden|dusk|night|overcast|rain`, `?bilder=aus|ruhig|verspielt`). Kit: [CONCEPT-KIT](CONCEPT-KIT.md). Numbers: [A11Y](A11Y.md).

## 1. What stays

The head (greeting, date, tools), "Jetzt wichtig", the agenda, every text and number, card sizes and order, the edit mode, the default home view "Ruhig" with its one card, no border and no shadow (budget: exactly 0), red only where it is today.

## 2. The day's tone ("Tageston")

Decided at the stop: a static tint per area says nothing; colour on the overview changes **with the time of day**.

- Every widget card's surface is `color-mix(in srgb, var(--tone) 12 %, var(--surface-raised))`. One colour for all cards; it is the shared sky's tone ([CONCEPT-KIT §3](CONCEPT-KIT.md)).
- Tone keys and colours (tokens `--tone-<key>`, values = the weather palette's sky tones): `day` (also the morning) sky blue · `golden` warm sand · `dusk` (and dawn) violet · `night` deep blue · `overcast` grey blue · `rain` slate · `snow` pale grey blue. The key follows the shared sky: weather wins over the clock (an overcast noon is `overcast`, not `day`).
- The change between two keys is a 600 ms colour transition on the card surface (off with reduced motion); it happens at most a few times a day.
- Text inks on the tone: `--text` and `--text-muted` as they are; the meta ink is `--text-3-on-tone` (one value per theme, [A11Y §1](A11Y.md)). The "Werte ausblenden" placeholder takes the muted ink.
- Dark theme: the step that keeps AA ([A11Y §1](A11Y.md)).
- Not toned: "Jetzt wichtig" cards (their state colours must not mix), the agenda, the head, the weather card (it is the sky itself), dialogs.
- "Bilder: Aus", colour mode "Ruhig", "Modulfarben: Aus": no tone.

## 3. Loud and quiet: the rule

| Layer | Cap | Who |
| --- | --- | --- |
| Scene cards | **4** on the page, the weather card included, in the grid's reading order; a fifth and later scene card shows its sign. Phone (one column): two scene cards never follow each other directly – the second shows its sign | weather, habits (garden), ToDos (lake), planner "Heute" (way, later), music (later) |
| Sky tiles | no cap (they are the tiles of one card) | clock |
| Signs | no cap, one per card, 32 px | see [modules/signs](modules/signs.md) |
| Tone | every card | – |

- A scene card never grows in height on the desktop: the picture takes the right 44 % of a card of two columns or more. On a one-column card and on the phone it is a strip of 112 px at the card's foot.
- The home view "Ruhig" shows no scene and no tone change beyond the one card's tone; its weather line keeps the 28 px porthole.
- The cockpit view follows the same rule with a cap of 2 (it is the dense view).
- The user's choice wins: "Bild zeigen" off for a module frees its place in the cap.

## 4. Order and where pictures land

Nothing is reordered for pictures: the saved positions and the manifest order decide. In the default order ("Ausführlich", fresh user: Heute, Offene ToDos, Kontostand, Diesen Monat, Wetter, Rechnungen, Abbuchungen) the first screen at 1920 then holds the lake (Offene ToDos) and, one row lower, the weather. With every module on, the garden, the lake and the weather fall on the first two screens.

## 5. Phone

One column; a scene card shows its content first, the strip at its foot. The clock's tiles are two per row, each a sky. Height: + 112 px per scene card that shows its picture (at most 4; with the adjacency rule usually 2–3).

## 6. Deliberately not done

- No picture in the overview head (the greeting stays text) and none behind "Jetzt wichtig".
- No area colours on cards (dropped at the stop).
- No picture chosen by the app to "fill" an empty half: only modules with data-driven variables have one.
- No reordering, no auto-promotion of a card because its picture is nice.
