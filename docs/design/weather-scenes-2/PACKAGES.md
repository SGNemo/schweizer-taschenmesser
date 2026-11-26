# Weather round 2 – packages (order, shared block, prompts, "as built")

One package = one Opus chat, one branch, one PR against `develop`; paste one prompt per chat. The design round is merged first.

## Order

**A ∥ B → C → D.** The first to start is **A**.

| #   | Package                              | Branch                       | Scope (short)                                                                                                                                                                      | Hotspots to announce                                                                           | Review                           |
| --- | ------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| A   | Scene v2                             | `feat/weather-scene-2`       | levels, state, the whole drawing, body modes, wind, events in the new language, motion with the one glow, head 320 px and the phone's picture without chips, thunder and fog words | `ui/tokens.css` (+ `tokens.test.ts`), `layout/AreaFrame.module.css`, the head-height seed spec | `council` (design-system tokens) |
| B   | More data and values                 | `feat/weather-values`        | request variables, all 168 hours in the cache, rain in the next two hours, amount on the hour cards, hour line, curve with a select, "Mehr Werte", day length and twilight         | `docs/legal/DATA-FLOWS.md` (list of values)                                                    | `review-loop`                    |
| C   | Days and hours                       | `feat/weather-days`          | view moment in the address, day stepper, days and hours as radio groups, every part follows the moment, swipe, live region                                                         | the stimulus budget (`buttons`, named hit)                                                     | `review-loop`                    |
| D   | Small versions, performance, tidying | `feat/weather-scene-2-small` | porthole and widget card on the new drawing, performance pass, leftovers of the old drawing                                                                                        | `home/**`, `ui/tokens.css`                                                                     | `council` (tokens are removed)   |

**A and B may run side by side** – with this fence: A does not touch `core/weather/{api,cache,air}.ts` or the page's cards; B does not touch `core/weather/scene.ts`, `ui/weather-scene/**` or `WeatherHero.tsx` beyond the text of chip 1 (through its own `rainSoon.ts`). The field names both rely on are fixed in [handoff/00-common](handoff/00-common.md). Both add strings: A to the condition words, B to the page bundle. Whoever lands second merges `develop` once, wires the hour row into `sceneOf` and says so in "as built". If only one chat runs at a time: A, then B.
The two known touching points: `WeatherHero.tsx` (A moves the phone's block out of the stage, B changes only the text of chip 1) and `routes/weather.module.css` (A: head; B: the new cards) – the second to land merges `develop` once.
**C** starts after A and B are merged (it reads both). **D** starts after A; beside C it shares `ui/weather-scene/WeatherScene.tsx` and `WeatherScene.module.css` (C: the 200 ms cross-fade, D: the one long precipitation iteration) – the second to land merges `develop` once.

Changed against the brief's proposal: D does **not** replace round 1's package 4 – that was built and merged as #1120 while this round ran. D carries its building blocks over to the new drawing and closes its open performance item; round 1's [PACKAGES](../weather-scenes/PACKAGES.md) keeps its "as built" and gets a pointer here.

## common

Applies to every package prompt of this round (the prompts cite this anchor).

- **Model and mode:** Claude Opus, unattended: no questions, no stop. What you decide stands in the PR under „Für dich entschieden“, what stays unclear under „Noch offen“.
- **Read first:** "as built" below and in round 1's [PACKAGES](../weather-scenes/PACKAGES.md). Lies zuerst „as built“ der Vorgänger; wo dein Prompt abweicht, gilt der gebaute Stand, und du trägst deinen eigenen Absatz nach (same PR, ≤ 6 lines: what was built differently and why, names of files and functions the next package needs).
- **Sources of truth:** [handoff/00-common](handoff/00-common.md), first paragraph. Words from [COPY](COPY.md) are taken literally (German and English), never rewritten. The drawing is `mockups/scene.js` + `palette.js` (+ `events.js`, `scene-motion.css`): port it shape by shape – **not redesigned**.
- **The sentences** of round 1's CONCEPT §0 with the changes of [CONCEPT §0](CONCEPT.md) hold in every package; their tests are extended, never loosened.
- **Privacy:** no new network destination. `privacy.test.ts`, the connection-log tests and the destinations of the `weather` data flow stay as they are; only package B changes the list of values in its DATA-FLOWS row.
- **Stimulus and guards:** `npm run check:stimulus` – every hit your hand-off names is listed under „Ratchet hits“ in the PR and waits; you never set `stimulus-raise`. Ratchet-protected files (`e2e/seed/**`, `ui/tokens.test.ts`, `ui/identity/identity.test.tsx`, the budgets): keep the existing checks, append new ones. `check:bundle` inside its tolerance.
- **Start and neighbours:** `npm run chats:status`; announce the hotspots of your row in the notes repo before the first commit.
- **Done:** `npm run check`, `test`, `e2e` green; `check:i18n`; the acceptance list of your hand-off answered point by point in the PR („Abnahme“); FOCUS checklist 1–9 answered in the PR – the answers to "what goes instead" and "which situation" are given here: **A** replaces the old drawing whole (the glow instead of the moon and the three wind curls go); situation: a look at the head before going out. **B** adds nothing to the glance: the hour-exact rain chip is replaced by the 15-minute sentence, the wind line leaves the default curve (it moves into its own series), "Mehr Werte" is closed; situation: "do I need the umbrella in the next half hour?". **C** removes the separate "now" frame on the first hour card (the checked state says it); situation: planning Saturday on Thursday. **D** adds nothing.
- **Docs:** `.changes/` note ([COPY §9](COPY.md)); one bullet per decision in `docs/decisions/weather.md` (the file is at its size budget: package A moves the weather-scene bullets of both rounds into a new `docs/decisions/weather-scenes.md` and adds the area to the index); `docs/features/weather.md` brought up to date for what you touched; STATUS one line in its own `docs(status)` PR; in [CHATS](../../CHATS.md) move the line „Wetter Runde 2“ on to the next package; pictures only in the PR text ([howto/pr-screenshots](../../howto/pr-screenshots.md): `npm run screenshots -- --project=weather`, 1920 and 412, light and dark, beside the mockups).
- **Skills:** `design:accessibility-review` against [A11Y](A11Y.md) and `design:design-critique` of your screens against the mockups; the review of your row (`review loop` or `council`); then `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop. Never merge.

## Prompts

### Package A

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter Runde 2, Paket A: Szene v2 · Opus

# Wetter Runde 2, Paket A: das neue Wetterbild – kantiges Massiv, Wald, See, Hütte; Stufen aus den Daten; Mond und Sonne zwischen den Wolken; Wind in vier Bildern. Unbeaufsichtigt.

Branch `feat/weather-scene-2` von frischem `develop`. Gemeinsame Regeln: docs/design/weather-scenes-2/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger (auch Runde 1) und trage deinen Absatz nach. Konzept: CONCEPT.md (ganz), A11Y.md. Übergabe: handoff/00-common.md, handoff/A-scene.md. Zeichnung: mockups/scene.js, palette.js, events.js, scene-motion.css – Form für Form portieren, nicht neu gestalten. Wörter: COPY.md §1, §8 – wörtlich übernehmen.

## Pflicht
1. Stufen als reine Funktionen in `core/weather/scene.ts` (Bewölkung, wie sonnig, Regen, Schnee, Schneedecke, Gewitter, Nebel, Wind mit Richtung, Frost, Hitze, nass, Sichtweise des Gestirns) – CONCEPT §2 und §3.
2. Palette als `--scene-*`-Tokens.
3. `ui/weather-scene/draw.ts` Ebene für Ebene nach der Zeichnung: Massiv aus sechs Bergen, Hügel, Wald in Staffeln, See mit Spiegelung, Steg und Boot, Hütte, Schuppen, Zaun, Fahne, sechs Baumarten; Wolken nach Bewölkung (keine bei klar); Decke mit Wolkenbänken, zwischen denen Mond oder Sonne hervorschaut; Gewitter mit 1, 2 oder 4 Blitzen; Regen, Schnee, Hagel, Nebel nach Stufe; Wind 0–3 an Rauch, Fahne, Bäumen, Wasser, Blättern.
4. Himmelsereignisse aus Runde 1 in der neuen Zeichnung (events.js).
5. Bewegung nach CONCEPT §7; der Schein an der Gewitterwolke leuchtet genau einmal langsam auf, Blitze stehen.
6. Kopf: Bühne 320 px; am Handy trägt das Bild nur Temperatur und Wort (256 px), Hinweis, Chips und Wertezeile stehen direkt darunter.
7. Wörter für Gewitter und Nebel nach Stufe, an allen Stellen dasselbe Wort.

## Nicht in diesem Paket
Neue Abfrage-Variablen, Cache, Werte auf der Seite (B) · Tage und Stunden wählen (C) · Bullauge und Wetter-Karte (D; ihre Exporte müssen weiter bauen).

## Abnahme
handoff/A-scene.md „Acceptance“, Punkt für Punkt: Stufen als Tabellen-Tests Daten → Ebenen · Mond und Sonne sichtbar bei jedem Himmel, auch bedeckt · Kontrast je Szene ≥ 4,5 : 1 (breit und Handy-Ausschnitt) · Obergrenzen aus A11Y §4 · keine Bewegung bei `prefers-reduced-motion`, „Standbild“, „Ruhig“; der Schein läuft einmal · `check:stimulus`: nur der benannte Treffer Kopfhöhe · Privacy-Tests unverändert · Bilder neben den Mockups.

## Skills
design:accessibility-review, design:design-critique gegen die Mockups, council (Tokens), file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

### Package B

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter Runde 2, Paket B: mehr Daten und Angaben · Opus

# Wetter Runde 2, Paket B: mehr Angaben, gestaffelt – Regen in den nächsten zwei Stunden, Menge je Stunde, Stundenzeile, Kurve zum Umschalten, „Mehr Werte“. Unbeaufsichtigt.

Branch `feat/weather-values` von frischem `develop`. Gemeinsame Regeln: docs/design/weather-scenes-2/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger und trage deinen Absatz nach. Darf neben Paket A laufen – halte den Zaun aus PACKAGES.md „Order“ ein. Konzept: CONCEPT-INFO.md (ganz), ANALYSIS.md §2. Übergabe: handoff/00-common.md, handoff/B-data.md. Mockups: mockups/p4-seite-heute.html, p4-seite-heute-regen.html, p4-zustaende.html – so bauen, nicht neu gestalten. Wörter: COPY.md §2, §3, §5–§7 – wörtlich übernehmen.

## Pflicht
1. Zuerst je neue Variable eine echte Abfrage und daraus die Fixtures; was die Quelle nicht wie dokumentiert liefert, fällt mit seiner Zeile weg und steht im PR.
2. Abfrage, Parser, `HourRow`, `Forecast`, Cache-Schema mit den Namen aus handoff/00-common.md; alle 168 Stunden und die vergangenen Stunden von heute bleiben im Cache.
3. `rainSoon` und der Block „Regen in den nächsten zwei Stunden“ (nur wenn Regen nah ist); Chip 1 nutzt es.
4. Stundenkarten mit Menge; Stundenzeile unter den Karten.
5. Kurve mit Auswahl „Anzeigen“ (sechs Reihen), Wahl gerätelokal.
6. „Mehr Werte“ (zugeklappt) mit den Gruppen aus COPY §6.
7. Tageslänge, bürgerliche Dämmerung, Drucktendenz, Schneefallgrenze als gerechnete Werte; erste Zeile von „Mond & Himmel“.
8. DATA-FLOWS: Liste der Werte in der Zeile `weather`; kein neues Ziel.

## Nicht in diesem Paket
Das Bild (A) · Tage und Stunden wählen, Tages-Schritt, „Jetzt“ (C) · der lange Text amtlicher Warnungen.

## Abnahme
handoff/B-data.md „Acceptance“, Punkt für Punkt: Parser gegen echte Fixtures · Cache 168 Stunden, Größe unter der Grenze, alter Cache bleibt gültig · `rainSoon` als Tabelle · jede Kurvenreihe mit und ohne Daten samt Textalternative · Privacy- und Verbindungsprotokoll-Tests unverändert grün, Host und Rundung der Position unverändert · `check:stimulus`: nur die benannte Seitenhöhe.

## Skills
design:accessibility-review, design:design-critique gegen die Mockups, review loop, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

### Package C

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter Runde 2, Paket C: Tage und Stunden wählen · Opus

# Wetter Runde 2, Paket C: Tage durchklicken, Stunden wählen – die ganze Seite folgt dem gewählten Zeitpunkt, „Heute“ ist immer einen Tipp entfernt. Unbeaufsichtigt.

Branch `feat/weather-days` von frischem `develop`, nach dem Merge von A und B. Gemeinsame Regeln: docs/design/weather-scenes-2/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger und trage deinen Absatz nach. Konzept: CONCEPT-DAYS.md (ganz), CONCEPT-INFO.md §5. Übergabe: handoff/00-common.md, handoff/C-days.md. Mockups: mockups/p4-seite-tag.html, p4-seite-tag-fern.html, p4-zustaende.html – so bauen, nicht neu gestalten. Wörter: COPY.md §3, §4 – wörtlich übernehmen.

## Pflicht
1. Zeitpunkt der Ansicht in der Adresse (`day`, `hour`), Rückfall auf jetzt, ein Verlaufseintrag beim Verlassen von „jetzt“.
2. Tages-Schritt unter dem Kopf; „Heute“ nur, wenn ein anderer Tag gezeigt wird.
3. „7 Tage“ und die Stundenkarten als Radiogruppen (Pfeiltasten, ein Tab-Halt je Gruppe).
4. Alles folgt dem Zeitpunkt: Bild, Kopf, Hinweise, Chips, Wertezeile, Karten, Kurve, „Mond & Himmel“, „Atemwege & Allergie“ – Tabelle in CONCEPT-DAYS §2.
5. Gewählte Stunde → ihr Bild im Kopf; Wechsel mit 200 ms Überblenden, ohne die Öffnungs-Bewegung.
6. Wischen auf dem Bild am Handy; nie der einzige Weg.
7. Ansage für Screenreader; fehlende Werte nach CONCEPT-DAYS §4.

## Nicht in diesem Paket
Neue Daten (B) · Änderungen an der Zeichnung (A) · kleine Fassungen (D) · der gewählte Tag wird nicht gespeichert.

## Abnahme
handoff/C-days.md „Acceptance“, Punkt für Punkt: Auswahl-Funktionen als Tabellen · e2e nur mit Tastatur durch sieben Tage und zurück · Zurück-Taste führt mit einem Druck zu „jetzt“ · Wischen im Handy-Profil · Adresse hin und zurück · `prefers-reduced-motion`: kein Überblenden · `check:stimulus`: der benannte Treffer `buttons` wartet auf das Label · Privacy-Tests unverändert.

## Skills
design:accessibility-review, design:design-critique gegen die Mockups, review loop, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

### Package D

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter Runde 2, Paket D: kleine Fassungen, Leistung, Aufräumen · Opus

# Wetter Runde 2, Paket D: das neue Bild in Wetterzeile und Wetter-Karte, Leistungs-Durchgang, Reste der alten Zeichnung entfernen. Unbeaufsichtigt.

Branch `feat/weather-scene-2-small` von frischem `develop`, nach dem Merge von A. Gemeinsame Regeln: docs/design/weather-scenes-2/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger (auch Runde 1, Paket 4 = #1120) und trage deinen Absatz nach. Konzept: CONCEPT.md §6, A11Y.md §4. Übergabe: handoff/00-common.md, handoff/D-small.md. Zeichnung: mockups/scene.js – Form für Form, nicht neu gestalten.

## Pflicht
1. Bullauge auf der neuen Zeichnung: Himmel, Gestirn in seiner Sichtweise, Hauptgipfel mit Schattenflanke, eine Wolkenbank oder Wolke, ein paar Zeichen für Regen oder Schnee; bewegt sich nie.
2. Wetter-Karte mit dem neuen Panorama; breite Karten und „Ruhig“ behalten das Bullauge.
3. Leistungs-Durchgang am Produkt gegen die Obergrenzen; Niederschlag als eine Iteration über eine lange Kachel (offener Punkt aus #1120: Gewitter mit Hagel).
4. Aufräumen: was nur die alte Zeichnung brauchte (Funktionen, Tokens, Tests); Runde 1 PACKAGES.md Zeile 4: Verweis hierher.

## Nicht in diesem Paket
Die Zeichnung selbst (A) · Werte (B) · Tage (C) · Himmelsereignisse in den kleinen Fassungen (bleibt offen, im PR nennen).

## Abnahme
handoff/D-small.md „Acceptance“, Punkt für Punkt: Bullauge je Himmel und Sichtweise · Kontrast der Karte ≥ 4,5 : 1 in drei Maßen · Leistungsbericht gegen die Obergrenzen, im Stand etwa 0 ms · `check:bundle` in der Toleranz · `check:stimulus` unverändert · keine Reste der alten Zeichnung · Handtest auf echtem Android-Gerät in MANUAL-TESTS.

## Skills
design:accessibility-review, design:design-critique gegen die Mockups, council (Tokens werden entfernt), file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## as built

(Each package adds its paragraph here, newest last.)

- **Design round (2026-11-26):** no product code. Measured on `develop` at 6eebccc; #1120 (round 1's package 4) merged while the round ran and is taken in. Decided by the maintainer at the stop: direction B "Facetten"; the picture grows (desktop 320 px; phone: picture without hints and chips); bolts stand, the glow brightens once. Asked for while the drawing was made: a round lake that is whole, round land with only the mountains angular, a better cabin and more trees of different kinds, the moon looking out between clouds instead of through a cut-out, more beautiful mountains, bolts that differ, no cloud when the sky is clear – all in `mockups/scene.js`. The source's extra variables are from its documentation, not checked live (package B, step 1).
- **A (2026-11-26, `feat/weather-scene-2`):** `core/weather/scene.ts` adds `SceneHour`, `sceneHourOf(forecast, nowIso)`, `coverOf`, `veilOf`, `sunLevel`, `intensityOfAmount`, `thunderLevel`, `fogLevel`, `snowCoverOf`, `windTo`, `wetOf`, `bodyMode`, `WordData`; `SceneState` gains `cover`, `veil`, `sun`, `thunder`, `fog`, `snowCover`, `windTo`, `wet`, `mode` (`snowGround` and `cloud` stay for the old drawing); `sceneOf({ …, hour })`; `conditionId(code, group, data)` gives the level words. `ui/weather-scene/draw.ts` is the new drawing (`sceneSvg(state, { quietX, view, bodyAt, phone, idPrefix })`, `G`, `E`, `phoneView`, `phoneBody`, `arcPoint`, `compactPath`, `countElements`); round 1's drawing is `drawV1.ts`, still used by `portholeSvg` and the card (`WeatherScene quietShare` → `cardFit`): **D moves both to `draw.ts` and deletes `drawV1.ts`, `WeatherScene.test.tsx`'s round-1 cases and `contrast.test.ts`** (round 2's is `contrastV2.test.ts`). Colours: `color-mix` and `--scene-grey-*` tokens, no JS hex. `skyOf`, the changed tokens and `snowGround` (snow level ≥ 2) already reach the porthole and card through `drawV1`. B: wire the new hour fields into `SceneHour` (names as 00-common; `sceneHourOf` already spreads the hour row of now). C: pass the chosen row as `hour`.
- **B – more values (2026-11-26):** built beside A; nothing of A's fence touched (chip 1 only through `modules/weather/rainSoon.ts` `soonChip`). The source was not reachable from the sandbox (proxy 403): fixtures follow the documented answer, `web/scripts/capture-weather-fixtures.mjs` records real ones; no variable was dropped. Names as in 00-common; extra: `Forecast.soon` is `{ at, mm }`, `Cached.v = 2`. For C: `moreGroups(tp, forecast, day, at, isNow)`, `seriesOf(tp, option, hours, air, all)`, `hourLineParts(tp, hour, now?)`, `hoursOfDay`, `hourAt`, `useSunLine` (today only; C passes the chosen date). B landed second: the new hour fields reach `SceneHour` through `sceneHourOf` (the hour row of now).
