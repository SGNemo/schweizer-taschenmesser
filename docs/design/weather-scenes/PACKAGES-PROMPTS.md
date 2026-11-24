# Weather scenes – package prompts

Paste one block into a new chat. Shared rules: [PACKAGES #common](PACKAGES.md#common). Order 1 → 2 → 3 → 4, each after the previous merge.

## Package 1 – scene frame and the head

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 1: Szenen-Gerüst und Kopf · Opus

# Wetter-Szenen, Paket 1: das Bild im Wetter-Kopf – jede Wetterlage, neue Größe, Hinweis im Kopf. Unbeaufsichtigt.

Branch `feat/weather-scene` von frischem `develop`. Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common (zuerst lesen, samt „as built“). Konzept: CONCEPT.md §0–§7, §9. Übergabe: handoff/00-common.md, handoff/01-scene.md. Wörter: COPY.md §1–§3 – wörtlich übernehmen, nicht neu gestalten. Zeichnung: mockups/scene.js + palette.js portieren, nicht neu zeichnen. Hotspots vorher im Notiz-Repo ankündigen: `ui/tokens.css`, `ui/HeadSurface.module.css`.

## Pflicht
1. `core/weather/scene.ts`: `SceneState`, `sceneOf`, `phaseOf`, `condOf`, Wind-, Frost-, Hitze-, Schnee-, Jahreszeit-Regeln (CONCEPT §2, §3).
2. `ui/weather-scene/WeatherScene` (ein SVG, Ebenen als `<g data-layer>`), Tokens `--scene-*`, Tinte über `data-ink`, „Ruhig“-Fassung, „Schlicht“.
3. Daten: roher WMO-Code (`code`) neben `group` in Forecast, Stunde, Tag und Cache-Schema; `snow_depth` als weitere Variable der bestehenden Abfrage. Kein zehntes `CodeGroup`.
4. Kopf: Bühne 280 px (Desktop) / ≤ 312 px (Handy), Layout nach handoff/01; Zahnrad liegt auf Himmel.
5. Hinweis des Tages als Pille in der Bühne mit „berechnet, keine amtliche Warnung“; kein Balken mehr über dem Kopf; neue Art `ice`; später Pfad unverändert.
6. Funde A4–A11 aus ANALYSIS.md §3 (Wort nach Code, Regenschirm statt Sonne, UV nur am Tag, Chips mit eigener deckender Fläche und Tinte, Frost-Symbol).
7. Bewegung: läuft ~12 s und kommt zur Ruhe; aus bei `prefers-reduced-motion`, `data-motion="reduce"`, „Standbild“, „Ruhig“, verdeckter Seite; nichts blinkt.
8. Einstellung „Bild im Wetter-Kopf“ (Mit Bewegung · Standbild · Schlicht).
9. Mond: bis Paket 2 eine schlichte volle Scheibe an fester Stelle, ohne Mond-Wort und ohne Mond-Chip.

## Nicht in diesem Paket
Mondphase, Mondkarte, Mond an den Tagen (2) · Finsternisse, Sternschnuppen, Regenbogen, Staub (3) · Widget, Übersichtszeile, Entfernen von `Sky` (4) · zweite Landschaft · amtliche Warnungen.

## Abnahme
- Tabelle Wetterlage × Tag/Nacht → Ebenen als `it.each` über alle WMO-Codes; jede Schwelle an und unter ihrer Kante; Phasen-Grenzen minutengenau.
- `contrast.test.ts`: jede Himmel-Farbe × Thema ≥ 4,5 : 1 für die Tinte der Szene (Erwartung: A11Y.md §1); axe auf `/weather` mit Ort, hell und dunkel, Tag und Nacht.
- Elementzahl der schwersten Szene ≤ Obergrenze aus A11Y.md §4; Messung Hauptthread während der 12 s und im Stand (Zahlen im PR).
- e2e: kein Hinweis-Balken über der Bühne; Bühnenhöhe; `prefers-reduced-motion` → keine Bewegung; „Schlicht“.
- `check:stimulus` für Wetter unverändert oder niedriger; `head-height.seed.spec.ts` angepasst, nicht gelöscht.
- Bilder nur im PR-Text: die sechs Lagen aus mockups/07-kopf.html, 1920 und 412, hell und dunkel.

## Skills
design:accessibility-review, design:design-critique, council, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## Package 2 – moon

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 2: Mond · Opus

# Wetter-Szenen, Paket 2: der Mond in echter Phase – gerechnet auf dem Gerät. Unbeaufsichtigt.

Branch `feat/weather-moon` von frischem `develop` (nach dem Merge von Paket 1). Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT-MOON.md. Übergabe: handoff/00-common.md, handoff/02-moon.md. Wörter: COPY.md §4 – wörtlich übernehmen, nicht neu gestalten. Referenz-Rechnung: reference/astro/*.js nach TypeScript portieren (keine neue Abhängigkeit, kein Netz).

## Pflicht
1. `core/sky/`: Mondphase, Beleuchtung, Entfernung, Höhe und Azimut von Mond und Sonne, Neigung der Sichel, Mondauf- und -untergang (10-Minuten-Schritte), Phasen-Zeitpunkte, Name je Ortstag (Regel CONCEPT-MOON §3), `moonOfDay`.
2. Szene: echte Phase mit Neigung, Mond nur über dem Horizont, Sterne nach Mondlicht, Tagmond, Vollmond-Bild, Supermond.
3. Seite: Mond-Chip nachts, Karte „Mond & Himmel“ (Phase, Prozent, Auf- und Untergang, nächster Voll- und Neumond), Mondzeichen und Wort an jedem Vorhersagetag.
4. Schalter „Mond und Himmelsereignisse“.

## Nicht in diesem Paket
Finsternisse und andere Ereignisse, der Block „Als Nächstes“ (3) · kleine Fassungen (4) · Mond in anderen Modulen (Kalender).

## Abnahme
- Mond gegen bekannte Daten: alle Zeilen aus reference/vectors.json mit den Toleranzen aus CONCEPT-MOON §7 (darunter 2026-11-24 01:50 UTC bei 49,6° N: 99,37 %, „Vollmond“, Höhe 41,99°).
- Genau ein „Vollmond“-Tag je Lunation in drei Zeitzonen; Supermond- und Zweiter-Vollmond-Fälle.
- Acht Phasen als Parameter-Schnappschuss; Neigung Nord/Süd; kein Mond unter dem Horizont.
- Rechenzeit `moonOfDay` (sieben Tage + jetzt) ≤ 5 ms Median bei CPU ×4 am Handy-Profil, Zahl im PR.
- Kontrast je Szene (Vollmond-Himmel `night-full`) ≥ 4,5 : 1; Obergrenze Elemente; `prefers-reduced-motion`.
- Zugängliche Namen: „Mond: {Phase}“ an jeder Tageszeile; das Bild bleibt `aria-hidden`.
- Bilder nur im PR-Text (acht Phasen, Vollmond, Karte, Tageszeilen; 1920 und 412, hell und dunkel).

## Skills
design:accessibility-review, design:design-critique, review loop, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## Package 3 – sky events

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 3: Himmelsereignisse · Opus

# Wetter-Szenen, Paket 3: Finsternisse, Sternschnuppen-Nächte, Regenbogen-Wetter und mehr – nur was am Ort wirklich zu sehen ist. Unbeaufsichtigt.

Branch `feat/weather-sky-events` von frischem `develop` (nach dem Merge von Paket 2). Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT-EVENTS.md. Übergabe: handoff/00-common.md, handoff/03-events.md. Wörter: COPY.md §5 – wörtlich übernehmen, nicht neu gestalten.

## Pflicht
1. Sonnenfinsternis lokal gerechnet (ohne Tabelle), Mondfinsternis aus der mitgelieferten Tabelle 2026–2050 mit lokaler Sichtbarkeit; Grenzen 5 % / 10 %.
2. Sternschnuppen-Nächte (sechs Ströme; **jede Zahl der Tabelle gegen den aktuellen IMO Meteor Shower Calendar prüfen und das im PR sagen – geht das nicht, bleiben die Ströme draußen und stehen unter „Noch offen“**), Sonnenwenden und Tagundnachtgleichen, Regenbogen-Wetter, Saharastaub (`dust` als weitere Variable der bestehenden Luft-Abfrage), Sternennacht, zweiter Vollmond im Monat.
3. Szene: die Ereignis-Bilder aus mockups/05-ereignisse.html; nichts davon bewegt sich.
4. Ein Ereignis zur Zeit: Ereignis-Chip, Block „Als Nächstes“ in „Mond & Himmel“, Wolken-Satz, Sicherheits-Satz bei jeder Sonnenfinsternis.

## Nicht in diesem Paket
Polarlicht, amtliche Warnungen, Planeten, ISS (brauchen eine neue Quelle – nur als offene Entscheidung im PR) · Benachrichtigungen zu Ereignissen · Halbschatten-Finsternisse · kleine Fassungen (4).

## Abnahme
- Sonnenfinsternis: jede lokale Zeile aus reference/eclipses.json für die fünf Orte ± 2 min und ± 1 Prozentpunkt, keine verpasst. Mondfinsternis: die 33 Sichtbarkeits-Urteile exakt.
- Beispiel-Fälle aus CONCEPT-EVENTS §4 als Tests (2027-08-02, 2028-01-26, 2028-12-31, 2034-03-20 …).
- Vorrang-Tabelle: genau ein Chip und ein Karten-Ereignis.
- Kein neues Netzziel (Verbindungsprotokoll-Test); Luft-Abfrage nur um die Variable erweitert.
- Kontrast je Ereignis-Szene (`eclipse-sky`, Staub, Sternennacht) ≥ 4,5 : 1; Obergrenze Elemente; `prefers-reduced-motion`.
- Bilder nur im PR-Text (jedes Ereignis, 1920 und 412, hell und dunkel; Karte mit „Als Nächstes“).

## Skills
design:accessibility-review, design:design-critique, review loop, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## Package 4 – small versions and performance

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 4: kleine Fassungen und Leistung · Opus

# Wetter-Szenen, Paket 4: Übersicht, Widget, Android – und der Leistungs-Durchgang. Unbeaufsichtigt.

Branch `feat/weather-scene-small` von frischem `develop` (nach dem Merge von Paket 3). Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT.md §8. Übergabe: handoff/00-common.md, handoff/04-small.md. Zeichnung: mockups/06-klein.html – übernehmen, nicht neu gestalten. Hotspots vorher ankündigen: `ui/tokens.css`, `home/**`.

## Pflicht
1. Bullauge (`ScenePorthole`) in der Übersichtszeile (28 px) und im Widget (64 px); gleiche Lage wie der Kopf, nie bewegt.
2. Widget mit der Szene als Kartenhintergrund (Variante B) **nur, wenn Sven im Design-PR oder in docs/decisions/weather.md Ja gesagt hat** – dann als benannte Ausnahme mit geändertem Absatz in MODULE-IDENTITY „Widgets“; sonst Variante A bauen und B unter „Noch offen“ lassen. „Ruhig“ und „Modulfarben: Aus“ immer Variante A.
3. `Sky`, `skyKind`, `--sky-*` und ihre Tests entfernen, sobald nichts mehr sie nutzt.
4. Leistungs-Durchgang nach handoff/04 (Desktop und Handy-Profil, CPU ×4): Zahlen in den PR und nach `docs/perf/`; ein Handtest mit Id für MANUAL-TESTS.md (echtes Android-Gerät).
5. Runde schließen: Arbeitsdokumente unter `docs/design/weather-scenes/` löschen (Entscheidungen stehen in `docs/decisions/weather.md`, das Feature in `docs/features/weather.md`); CHATS-Zeile „Wetter-Szenen“ entfernen.

## Nicht in diesem Paket
Bilder in den Stundenkarten oder Tageszeilen (bewusst gestrichen, CONCEPT §8) · natives Android-Widget · zweite Landschaft.

## Abnahme
- Bullauge je Lage (Ebenen, keine Bewegung); Widget A/B nach Farbmodus; `calm-colour.seed.spec.ts` und `headStyles.test.ts` grün.
- Obergrenzen aus A11Y.md §4 am Produkt gemessen und eingehalten; im Stand ~0 ms Hauptthread; verdeckte Seite: keine laufende Animation.
- `check:bundle` in der Toleranz; Layout-Verschiebung durch die Szene 0.
- `check:stimulus`: unverändert, oder mit Label `stimulus-raise` und Begründung (nur Variante B).
- Kontrast des Widget-Texts auf der Szene ≥ 4,5 : 1 in allen Lagen (gleicher Test wie im Kopf).
- Bilder nur im PR-Text (Übersicht mit Widget und Zeile, 1920 und 412, hell, dunkel, „Ruhig“).

## Skills
design:accessibility-review, design:design-critique, review loop (council, wenn Variante B gebaut wird), file-pr, babysit-pr, leaving-pr-comments. Full stop.
```
