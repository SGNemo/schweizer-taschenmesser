# Living scenes – the package prompts

Order and the common block: [PACKAGES](PACKAGES.md). Every prompt starts with the two head lines below (not repeated in the blocks):

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Lebendige Bilder, Paket <n>: <Titel> · Opus
```

and ends with: `Gemeinsame Regeln: docs/design/living-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger und trage deinen Absatz nach. Skills: design:accessibility-review, design:design-critique gegen die Mockups, review loop, file-pr, babysit-pr, leaving-pr-comments. Full stop.` (Paket 1: `council` statt `review loop`.)

## Paket 1 – Baukasten

```
# Lebendige Bilder, Paket 1: Szenen-Baukasten aus dem Wetter herauslösen, Einstellung „Bilder“, Budgets und Messung. Das Wetter sieht danach gleich aus. Unbeaufsichtigt.

Branch `feat/scene-kit` von frischem `develop`. Konzept: docs/design/living-scenes/CONCEPT-KIT.md (ganz), A11Y.md §4. Übergabe: handoff/00-common.md, handoff/01-kit.md. Wörter: COPY.md §1 – wörtlich übernehmen.

## Pflicht
1. `web/src/ui/scene/`: useSceneEnv, useSceneMotion, SceneSvg, useBox, svg.ts aus `ui/weather-scene` verschieben; dort unter den alten Namen weiter exportieren.
2. `sceneSvg`: Optionen `layer` (Modul-Ebene vor Niederschlag und Wind) und `crop` mit Auslassen aller Teile außerhalb des Ausschnitts; Niederschlag und Wind im Maßstab des Ausschnitts.
3. `ui/scene/spots` (Typ `Spot<Vars>`, `viewFor`), `CardPicture`, `SkyTile`, `CardSign`; nur ein Test-Ort.
4. `core/scene/sharedSky.ts`: `useSharedSky()`, `skyToneOf()` – nie eine Abfrage.
5. Manifest-Vertrag `WidgetDef.picture` (Hotspot: in der ersten Zeile des Draft-PR nennen), `check:modules`-Regel, `exclusion.test.ts` für `accounts`.
6. Einstellung „Bilder: Aus · Dezent · Verspielt“ (gerätelokal, Standard Verspielt), „Bild zeigen“ je Modul, Verweis in „Fokus & Aufmerksamkeit“.
7. Messhelfer `pictureCost` und die Obergrenzen als Konstanten.

## Nicht in diesem Paket
Tageston, Obergrenzen-Regel der Übersicht (2) · jeder Ort, jedes Zeichen, jede Kartenänderung (3–8).

## Abnahme
Wetter-Seite, -Karte und -Guckloch pixelgleich vorher/nachher (Wetter-Bildschirmfoto-Werkzeug, 1920 und 412, hell und dunkel) · Ausschnitt-Test: Elemente außerhalb fehlen, Zahl unter der Obergrenze · `useSharedSky` ohne Ort = Uhr und Jahreszeit · Einstellung „Aus“ = heutiger Stand · `check:stimulus` ohne Treffer · keine neue Bewegung.
```

## Paket 2 – Übersicht

```
# Lebendige Bilder, Paket 2: Übersicht – Tageston, Regel für laute und leise Karten, Bildplätze. Unbeaufsichtigt.

Branch `feat/home-pictures` von frischem `develop`, nach Paket 1. Konzept: CONCEPT-HOME.md (ganz), A11Y.md §1 und §5. Übergabe: handoff/00-common.md, handoff/02-home.md. Mockup: mockups/p2-overview.html.

## Pflicht
1. Tageston: `data-sky-tone`, Tokens `--tone-*`, Kartenfläche 12 % (dunkel: Stufe aus A11Y §1), `--text-3-on-tone`; nicht auf „Jetzt wichtig“, Agenda, Kopf, Wetter-Karte.
2. `pictureKinds()`: Reihenfolge, Obergrenze 4 (Cockpit 2, Ansicht „Ruhig“ 0), am Handy nie zwei Szenen hintereinander, Modul-Schalter.
3. Bildplätze der Karte: rechts 44 % ab zwei Spalten, Streifen 112 px sonst – ohne Höhenänderung am Desktop.
4. Übergang zwischen Tönen 600 ms, aus bei weniger Bewegung.

## Nicht in diesem Paket
Bilder einzelner Module (3–8) · Bereichsfarben · Umordnen von Karten.

## Abnahme
Tabellen-Tests von `pictureKinds` · Kontrast jeder Schrift auf jedem Ton, hell und dunkel ≥ 4,5 : 1 · „Bilder: Aus“, Farbmodus „Ruhig“, „Modulfarben: Aus“ = kein Ton · `check:stimulus`: genau der freigegebene Treffer „farbige Elemente im ersten Bildschirm“ der Übersicht, mit CI-Zahlen benannt; Rahmen und Schatten 0 · Bilder 1920 und 412, hell und dunkel, je Tageszeit.
```

## Paket 3 – Gewohnheiten

```
# Lebendige Bilder, Paket 3: Gewohnheiten – der Garten vor der Hütte. Unbeaufsichtigt.

Branch `feat/habits-garden` von frischem `develop`, nach Paket 2; darf neben 4–7 laufen (Zaun: PACKAGES.md „Side by side“). Konzept: modules/habits.md. Übergabe: handoff/00-common.md, handoff/03-habits.md. Zeichnung: mockups/world.js (`garden`, `plant`), Galerie mockups/p2-habits.html – Form für Form portieren, nicht neu gestalten.

## Pflicht
1. Ort `garden` im Baukasten samt Tokens. 2. `gardenVars()` rein, mit dem Zähler „je geschafft“. 3. Karte „Heute geschafft“ mit Bild und Ersatz-Zeichen (Ring). 4. Bild auf der Seite, Tab „Heute“. 5. Einblenden einer Blüte beim Abhaken.

## Nicht in diesem Paket
Serien, Verlauf, Archiv · andere Module · Änderungen am Baukasten (Wunsch ins Notiz-Repo).

## Abnahme
Variablen als Tabellen-Tests Datum → Bild (jede Zeile aus modules/habits.md) · Leitsatz 3: nichts schrumpft oder verschwindet durch Zeit oder Nichtstun (Test über Zustandsraum) · sieben Zustände × Tag, Dämmerung, Nacht, Regen als Bilder neben dem Mockup · Elemente und Bytes je Zustand unter der Obergrenze · `prefers-reduced-motion`: kein Einblenden · „Bilder: Aus“ = heutige Karte · `check:stimulus` im freigegebenen Rahmen.
```

## Paket 4 – Uhr

```
# Lebendige Bilder, Paket 4: Uhr – jede Ortskachel trägt den Himmel ihrer Stunde. Unbeaufsichtigt.

Branch `feat/clock-sky` von frischem `develop`, nach Paket 2; darf neben 3, 5–7 laufen. Konzept: modules/clock.md. Übergabe: handoff/00-common.md, handoff/04-clock.md. Mockup: mockups/p2-clock.html. Wörter: COPY.md §3 – wörtlich.

## Pflicht
1. `skyOfPlace()` (vier Bänder nach der Stunde des Orts, Mondphase des Tages). 2. Kacheln der Karte und Zeilen der Seite mit `SkyTile`; Schrift in der Tinte des Himmels. 3. Vier Tageswörter statt zwei, de und en.

## Nicht in diesem Paket
Sonnenaufgang, Wetter oder Mondstand am Ort (die Uhr kennt nur die Zone) · Landschaft in Kacheln.

## Abnahme
Tabellen-Test für jede Stunde 0–23 und Halbstunden-Zonen · Kontrast der drei Zeilen je Band, hell und dunkel ≥ 4,5 : 1 · Wort und Himmel stimmen immer überein · „Bilder: Aus“ = heutige Kacheln · `check:stimulus` im Rahmen.
```

## Paket 5 – ToDos

```
# Lebendige Bilder, Paket 5: ToDos – der See: ein Boot je heute Abgehaktem, nachts Laternen und ein Sternbild. Unbeaufsichtigt.

Branch `feat/todos-lake` von frischem `develop`, nach Paket 2; darf neben 3, 4, 6, 7 laufen. Konzept: modules/todos.md. Übergabe: handoff/00-common.md, handoff/05-todos.md. Zeichnung: mockups/world.js (`lake`), Galerie mockups/p3-todos.html. Wörter: COPY.md §2 – wörtlich.

## Pflicht
1. Ort `lake` samt Tokens. 2. `lakeVars()` aus `doneToday`, höchstens 7. 3. Karte „Offene ToDos“: Bild, dritter Teil der Zusammenfassung, Ersatz-Zeichen. 4. Sterne nur bei sichtbarem Sternhimmel, Laternen ab goldener Stunde.

## Nicht in diesem Paket
Bild für die Karte „Heute“ (Paket 8) · Offenes, Wartendes, Überfälliges im Bild.

## Abnahme
Tabellen-Tests Datum → Bild · Leitsatz 3: kein Teil für Offenes, keine vorgezeichnete Figur · Zustände 0, 1, 2, 7, 12 × Tag, goldene Stunde, klare und bedeckte Nacht, Regen · Obergrenzen · `prefers-reduced-motion` · „Bilder: Aus“ = heutige Karte.
```

## Pakete 6 und 7 – Zeichen

```
# Lebendige Bilder, Paket 6: Zeichen, die vorhandene Bausteine füttern – Wochenlast, Budgets, Downloads. Unbeaufsichtigt.
(Paket 7: neue Zeichen – Zeiterfassung, Vorräte, Routinen, Einkauf, Personen, Fitness, Kalender.)

Branch `feat/signs-blocks` (7: `feat/signs-new`) von frischem `develop`, nach Paket 2; 6 und 7 dürfen nebeneinander und neben 3–5 laufen. Konzept: modules/signs.md. Übergabe: handoff/00-common.md, handoff/06-signs.md. Zeichnungen: mockups/signs.js.

## Pflicht
Je Karte: reine Funktion Datum → Wert neben der Modul-Logik, `picture: { step: 1 }`, `CardSign`. Paket 6 fasst das Wochenlast-Widget nur nach dem Ja von Planer-Zentrale 2 an (Notiz-Repo), sonst wandert Wochenlast in Paket 8.

## Nicht in diesem Paket
Szenen · Rot im Zeichen · „Dieser PC“ (seine Ringe lesen schon).

## Abnahme
Jede Tabellenzeile ein Test · ein Farbton je Zeichen, ≥ 3 : 1 auf jedem Tageston · ≤ 24 Elemente · „Bilder: Aus“ = altes Zeichen · nichts liest sich als „fehlt“.
```

## Paket 8 – Planer

```
# Lebendige Bilder, Paket 8: Planer – der Tag als Weg mit Pfosten, Fahnen und dem Wanderer. Erst nach dem Abschluss von Planer-Zentrale 2. Unbeaufsichtigt.

Branch `feat/planner-way` von frischem `develop`. Konzept: modules/planner.md. Übergabe: handoff/00-common.md, handoff/08-planner.md. Zeichnung: mockups/world.js (`way`).

## Pflicht
1. Zuerst „as built“ von Planer-Zentrale 2 lesen und die Quellen-Spalte der Variablen-Tabelle nachtragen. 2. Ort `way`, `wayVars()`. 3. Bild auf der Karte „Heute“ und als Streifen über dem heutigen Tag der Planer-Seite.

## Nicht in diesem Paket
Dinge ohne Uhrzeit, Überlast, Verspätetes im Bild · Wochenansichten.

## Abnahme
Tabellen-Tests · Leitsatz 3: ein Pfosten ohne Fahne bleibt ein Pfosten, nichts wird rot · leerer Tag, acht und mehr Dinge, Tag über Mitternacht · Obergrenzen · „Bilder: Aus“ = heutige Karte.
```

## Paket 9 – Abschluss

```
# Lebendige Bilder, Paket 9: Regeln nach MODULE-IDENTITY.md übernehmen (RULES-DRAFT.md als Abschnitt „Pictures“), ein Bullet in docs/decisions/, Arbeitsdokumente der Runde löschen, was Code und Tests zitieren bleibt. Nur Doku; Label no-changelog. review loop mit einer Runde.
```
