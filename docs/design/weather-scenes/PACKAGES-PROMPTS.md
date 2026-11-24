# Weather scenes – package prompts

Paste one block into a new chat. Shared rules: [PACKAGES #common](PACKAGES.md#common). Order 1a → 1b → 2 → 3 → 3b → 4, each after the previous merge.

## Package 1a – data, words, hint logic

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 1a: Daten, Wörter, Hinweis-Logik · Opus

# Wetter-Szenen, Paket 1a: die Grundlage ohne Bild – Wort nach WMO-Code, neue Datenfelder, Hinweis „Glätte“, richtige Symbole. Unbeaufsichtigt.

Branch `fix/weather-words-data` von frischem `develop`. Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT.md §1 (neue Daten), §3. Übergabe: handoff/00-common.md, handoff/01a-data-words.md. Wörter: COPY.md §1, §2 – wörtlich übernehmen, nicht neu gestalten.

## Pflicht
1. `Forecast.tz` (IANA-Zone aus der Antwort), roher WMO-Code `code` neben `group` (jetzt, Stunde, Tag), `now.snowDepth` (`snow_depth` als weitere Variable der bestehenden Abfrage); alles optional, auch im Cache-Schema. Kein zehntes `CodeGroup`.
2. `conditionId` und `tx.conditions` (22 Wörter de/en); das Wort überall, wo eines steht: Kopf, Stundenkarten, Tageszeilen, Widget, Übersichtszeile, Reisewetter in Listen.
3. Zusatzwort in der Detailzeile des Kopfs (Sturmböen, windig, Schnee liegt, Frost, Hitze), höchstens eines.
4. Chips: Regenschirm statt Sonne; UV nur zwischen Sonnenauf- und -untergang, sonst „Sonnenaufgang {Zeit}“.
5. Hinweis-Art `ice` (Codes 56, 57, 66, 67) in `weatherWarnings`, `WarningNotice`, `attention.ts`, Benachrichtigung und Hilfetext; Frost-Symbol `thermometer` an beiden Stellen.

## Nicht in diesem Paket
Das Bild, die neue Kopfgröße, der Hinweis im Kopf, Kontrast der Chips, Einstellungen (alles 1b) · Mond (2) · Ereignisse (3) · kleine Fassungen (4).

## Abnahme
- Neue Felder: Parsen, Cache-Rundlauf, alter Cache bleibt gültig; die Abfrage-URL unterscheidet sich nur um `snow_depth`.
- `conditionId` für jeden WMO-Code und jede Gruppe ohne Code; dasselbe Wort an allen fünf Stellen (Code 1 → „überwiegend klar“).
- Chips nachts (Fixture aus ANALYSIS.md: 02:50 → kein UV, „Sonnenaufgang 07:38“, Regenschirm).
- `ice`: jede der vier Codes, Reihenfolge, Zeile in „Jetzt wichtig“, Benachrichtigungstext.
- `privacy.test.ts` und Verbindungsprotokoll-Tests unverändert grün; `check:stimulus` unverändert.
- Bilder nur im PR-Text (Kopf vorher/nachher, 1920 und 412, hell und dunkel).

## Skills
design:accessibility-review, design:design-critique, review loop, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## Package 1b – scene frame and the head

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 1b: Szenen-Gerüst und Kopf · Opus

# Wetter-Szenen, Paket 1b: das Bild im Wetter-Kopf – jede Wetterlage, neue Größe, Hinweis im Kopf. Unbeaufsichtigt.

Branch `feat/weather-scene` von frischem `develop` (nach dem Merge von 1a). Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT.md §0–§7, §9. Übergabe: handoff/00-common.md, handoff/01b-scene.md. Wörter: COPY.md §2, §3 – wörtlich übernehmen, nicht neu gestalten. Zeichnung: mockups/scene.js + palette.js portieren, nicht neu zeichnen. Hotspots vorher im Notiz-Repo ankündigen: `ui/tokens.css`, `ui/HeadSurface.module.css`.

## Pflicht
1. `core/weather/scene.ts`: `SceneState`, `sceneOf`, `phaseOf`, `condOf`, Wind-, Frost-, Hitze-, Schnee-, Jahreszeit-Regeln (CONCEPT §2, §3).
2. `ui/weather-scene/WeatherScene` (ein SVG, Ebenen als `<g data-layer>`), Tokens `--scene-*` und `--ink-*`, Tinte über `data-ink`, „Ruhig“-Fassung, „Schlicht“; `quietX` für jede Breite unter 1600 Einheiten, `bodyAt` am Handy.
3. Kopf: Bühne 280 px (Desktop) / 272 px (Handy), mit zwei Hinweisen ≤ 290 / ≤ 300; Layout nach handoff/01b; im Titelband nur Himmel.
4. Hinweis des Tages als Pille in der Bühne mit „berechnet, keine amtliche Warnung“; kein Balken mehr über dem Kopf; später Pfad unverändert.
5. Chips, Pille und Modulzeile deckend mit eigener Tinte (Funde A6–A8); `contrast.test.ts`.
6. Bewegung: 5 s nach dem Öffnen, dann Stillstand; aus bei `prefers-reduced-motion`, `data-motion="reduce"`, „Standbild“, „Schlicht“, „Ruhig“, „Modulfarben: Aus“, verdeckter Seite; nichts blinkt.
7. Einstellung „Bild im Wetter-Kopf“ (Mit Bewegung · Standbild · Schlicht) im gemeinsamen `weather`-Bereich (Einstellungen → Verbindungen → Wetter).
8. Kein Mond in der Szene (nachts nur Sterne), bis Paket 2 ihn rechnet.
9. Geschützte Tests: bestehende Prüfungen erhalten, neue anhängen, Treffer im PR unter „Ratchet hits“ nennen (handoff/00-common.md); das Label `stimulus-raise` setzt nur Sven.

## Nicht in diesem Paket
Mondphase, Mondkarte, Mond an den Tagen (2) · Finsternisse, Sternschnuppen, Regenbogen, Staub (3) · Widget, Übersichtszeile, Entfernen von `Sky` (4) · zweite Landschaft · amtliche Warnungen.

## Abnahme
- Tabelle Wetterlage × Tag/Nacht → Ebenen als `it.each` über alle WMO-Codes; jede Schwelle an und unter ihrer Kante; Phasen-Grenzen minutengenau; Jahreszeit × Halbkugel.
- `contrast.test.ts`: jede Himmel-Farbe × Thema ≥ 4,5 : 1 für die Tinte der Szene (Erwartung: A11Y.md §1); axe auf `/weather` mit Ort, hell und dunkel, Tag und Nacht; Kontrast-Lauf auch bei 1280.
- Elementzahl der schwersten Szene ≤ Obergrenze aus A11Y.md §4; Hauptthread während der Bewegung und im Stand gemessen (Zahlen im PR).
- e2e: kein Hinweis-Balken über der Bühne; Bühnenhöhe mit 0, 1, 2 Hinweisen bei 1920, 1280, 412; `prefers-reduced-motion` → keine Bewegung; „Schlicht“.
- `check:stimulus` für Wetter unverändert bis auf `shadows` 1 → 0.
- Bilder nur im PR-Text: die sechs Lagen aus mockups/07-kopf.html, 1920 und 412, hell und dunkel.

## Skills
design:accessibility-review, design:design-critique, council, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## Package 2 – moon

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 2: Mond · Opus

# Wetter-Szenen, Paket 2: der Mond in echter Phase – gerechnet auf dem Gerät. Unbeaufsichtigt.

Branch `feat/weather-moon` von frischem `develop` (nach dem Merge von 1b). Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT-MOON.md. Übergabe: handoff/00-common.md, handoff/02-moon.md. Wörter: COPY.md §4 – wörtlich übernehmen, nicht neu gestalten. Referenz-Rechnung: reference/astro/*.js nach TypeScript portieren (keine neue Abhängigkeit, kein Netz).

## Pflicht
1. `core/sky/`: Mondphase, Beleuchtung, Entfernung, Höhe und Azimut von Mond und Sonne, Neigung der Sichel, Mondauf- und -untergang (10-Minuten-Schritte), Phasen-Zeitpunkte, Name je Ortstag (Regel CONCEPT-MOON §3; Tagesgrenzen in `Forecast.tz`), `moonOfDay`.
2. Szene: echte Phase mit Neigung, Mond nur über dem Horizont (Nacht und Dämmerung), Sterne nach Mondlicht, Tagmond, Vollmond-Bild, Supermond.
3. Seite: Mond-Chip nachts (am Handy vorn in der Zeile unter der Bühne), Karte „Mond & Himmel“, Mondzeichen und Wort an jedem Vorhersagetag; Name der Seitenspalte „Luft, Mond & Himmel“.
4. Schalter „Mond und Himmelsereignisse“ im gemeinsamen `weather`-Bereich; aus = kein Mond, nirgends.
5. Fixtures aus reference/vectors.json nach `core/sky/__fixtures__/` kopieren.

## Nicht in diesem Paket
Finsternisse und andere Ereignisse, der Block „Als Nächstes“ (3) · kleine Fassungen (4) · Mond in anderen Modulen (Kalender).

## Abnahme
- Mond gegen bekannte Daten: alle Zeilen aus vectors.json mit den Toleranzen aus CONCEPT-MOON §7 (darunter 2026-11-24 01:50 UTC am Beispielort: 99,37 %, „Vollmond“, Höhe 41,99°).
- Genau ein „Vollmond“-Tag je Lunation in drei Zeitzonen, auch an Tagen mit Zeitumstellung; Supermond- und Zweiter-Vollmond-Fälle.
- Acht Phasen als Parameter-Schnappschuss; Neigung Nord/Süd; kein Mond unter dem Horizont; Mond in der Dämmerung.
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
1. Sonnenfinsternis lokal gerechnet (ohne Tabelle), Mondfinsternis aus der mitgelieferten Tabelle 2026–2050 mit lokaler Sichtbarkeit; Grenzen 5 % / 10 %; „bis n %“ ist die größte Bedeckung, solange die Sonne über dem Horizont steht.
2. Sternschnuppen-Nächte (sechs Ströme; **jede Zahl der Tabelle gegen den aktuellen IMO Meteor Shower Calendar prüfen und das im PR sagen – geht das nicht, bleiben die Ströme draußen und stehen unter „Noch offen“**), Sonnenwenden und Tagundnachtgleichen, Regenbogen-Wetter, Saharastaub (`dust` als weitere Variable der bestehenden Luft-Abfrage), Sternennacht, zweiter Vollmond im Monat.
3. Szene: die Ereignis-Bilder aus mockups/05-ereignisse.html; nichts davon bewegt sich.
4. Ein Ereignis zur Zeit: Ereignis-Chip (am Handy an der Stelle des Wind-Chips), Block „Als Nächstes“ in „Mond & Himmel“, Wolken-Satz; bei jeder Sonnenfinsternis der Sicherheits-Satz in der Karte und am Tag als Pille in der Bühne.
5. Fixtures (eclipses.json, Mondfinsternis-Tabelle, meteors.json) nach `core/sky/__fixtures__/` kopieren.

## Nicht in diesem Paket
Polarlicht, amtliche Warnungen, Planeten, ISS (brauchen eine neue Quelle – nur als offene Entscheidung im PR) · Benachrichtigungen zu Ereignissen · Halbschatten-Finsternisse · kleine Fassungen (4).

## Abnahme
- Sonnenfinsternis: jede lokale Zeile aus eclipses.json für die fünf Orte ± 2 min und ± 1 Prozentpunkt, keine verpasst. Mondfinsternis: Produkt-Urteil nach der Zuordnung und den handgeprüften Fällen aus CONCEPT-EVENTS §4.
- Beispiel-Fälle aus CONCEPT-EVENTS §4 als Tests (2027-08-02, 2028-01-26 mit Bedeckung bei Sonnenuntergang, 2028-12-31, 2034-03-20 …).
- Vorrang-Tabelle: genau ein Chip und ein Karten-Ereignis; Sicherheits-Pille an jedem Sonnenfinsternis-Tag.
- Kein neues Netzziel (Verbindungsprotokoll-Test); Luft-Abfrage nur um die Variable erweitert.
- Kontrast je Ereignis-Szene (`eclipse-sky`, Staub, Sternennacht) ≥ 4,5 : 1; Obergrenze Elemente; `prefers-reduced-motion`.
- Bilder nur im PR-Text (jedes Ereignis, 1920 und 412, hell und dunkel; Karte mit „Als Nächstes“).

## Skills
design:accessibility-review, design:design-critique, review loop, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## Package 3b – aurora and official warnings

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 3b: Polarlicht und amtliche Warnungen · Opus

# Wetter-Szenen, Paket 3b: Polarlicht (NOAA SWPC) und amtliche Warnungen (DWD) – zwei neue Netzziele, von Sven erlaubt. Unbeaufsichtigt.

Branch `feat/weather-sources` von frischem `develop` (nach dem Merge von Paket 3). Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT-SOURCES.md. Übergabe: handoff/00-common.md, handoff/03b-sources.md. Wörter: COPY.md §7 – wörtlich übernehmen, nicht neu gestalten. Lies docs/rules/core-privacy.md und docs/legal/DATA-FLOWS.md.

## Pflicht
1. Zuerst beide Quellen im echten Browser und über den Desktop-Abruf prüfen (Layer-Name, Felder, JSON, CORS beim DWD-GeoServer; Aufbau und CORS der SWPC-Datei) und das Ergebnis in den PR schreiben; wo die Tatsachen vom Konzept abweichen, gelten die Tatsachen. Ohne CORS läuft die Funktion nur in Desktop- und Android-App; kein Proxy.
2. Polarlicht: Kp-Vorhersage (eine allgemeine Datei, kein Ort wird gesendet), Regel nach geomagnetischer Breite lokal; Chip, Karten-Zeile „Als Nächstes“, Bild (mockups/05-ereignisse.html), nie bewegt.
3. Amtliche Warnungen nur für Orte in Deutschland: Abruf mit der gerundeten Position, eigene Pille im Kopf (mockups/07-kopf.html 7a–7c), ersetzt die berechneten Hinweise von heute; Zeile in „Jetzt wichtig“; nie über das Ablaufende hinaus und nie aus einer Vorhersage älter als 60 Minuten.
4. Schalter „Amtliche Warnungen (Deutschland)“ (an) im gemeinsamen `weather`-Bereich; Polarlicht hängt an „Mond und Himmelsereignisse“. Beide Abrufe über `getPlatform().fetch`, aus bei „Netzwerk sperren“ und offline.
5. `docs/legal/DATA-FLOWS.md`: zwei neue Zeilen; Datenschutz-Satz, Quellenangaben (DWD, NOAA SWPC) nach COPY §7.

## Nicht in diesem Paket
Warnungen anderer Länder (MeteoAlarm) · Benachrichtigung zu amtlichen Warnungen oder Polarlicht · Warn-Karte · Beschreibungstexte der Warnungen in der App · kleine Fassungen (4).

## Abnahme
- Abrufe: die DWD-Adresse trägt nur die gerundete Position, die SWPC-Adresse nichts; kein Abruf bei Schalter aus, außerhalb der Region, offline, „Netzwerk sperren“; der Verbindungsprotokoll-Test kennt genau zwei neue Ziele; `privacy.test.ts` unverändert grün.
- Ersetz-Regel (amtlich heute verdrängt berechnet heute, berechnet morgen bleibt; ohne amtliche Antwort bleiben die berechneten).
- Polarlicht-Regel: geomagnetische Breite für fünf Orte, nötiges Kp (Beispielort 7, Tromsø ≤ 1, Singapur nie), beide JSON-Formen.
- Kopf: Reihenfolge der Pillen, Bühnenhöhe ≤ 290 / ≤ 300, Kontrast der amtlichen Pille und der Szene ≥ 4,5 : 1, axe; `prefers-reduced-motion`.
- Bilder nur im PR-Text (amtliche Warnung, Polarlicht; 1920 und 412, hell und dunkel).

## Skills
design:accessibility-review, design:design-critique, council, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```

## Package 4 – small versions and performance

```
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Routing: Claude Code · Wetter-Szenen 4: kleine Fassungen und Leistung · Opus

# Wetter-Szenen, Paket 4: Übersicht, Widget, Android – und der Leistungs-Durchgang. Unbeaufsichtigt.

Branch `feat/weather-scene-small` von frischem `develop` (nach dem Merge von Paket 3b). Gemeinsame Regeln: docs/design/weather-scenes/PACKAGES.md#common; lies zuerst „as built“ der Vorgänger in PACKAGES.md und trage deinen Absatz nach. Konzept: CONCEPT.md §8. Übergabe: handoff/00-common.md, handoff/04-small.md. Zeichnung: mockups/06-klein.html – übernehmen, nicht neu gestalten. Hotspots vorher ankündigen: `ui/tokens.css`, `home/**`.

## Pflicht
1. Bullauge (`ScenePorthole`) in der Übersichtszeile (28 px) und im Widget (64 px); gleiche Lage wie der Kopf, nie bewegt; folgt den Einstellungen „Bild im Wetter-Kopf“ und „Mond und Himmelsereignisse“.
2. Widget mit der Szene als Kartenhintergrund (Variante B – von Sven am 2026-11-24 entschieden: ja), als benannte Ausnahme mit geändertem Absatz in MODULE-IDENTITY „Widgets“. „Ruhig“ und „Modulfarben: Aus“ zeigen Variante A (Bullauge).
3. `Sky`, `skyKind`, `--sky-*`, das behaltene `data-sky` samt `span` und ihre Tests entfernen, sobald nichts mehr sie nutzt – geschützte Dateien als „Ratchet hits“ im PR nennen; das Label `stimulus-raise` setzt nur Sven.
4. Leistungs-Durchgang nach handoff/04 (Desktop und Handy-Profil, CPU ×4): Zahlen in den PR und nach `docs/perf/`; ein Handtest mit Id für MANUAL-TESTS.md (echtes Android-Gerät).
5. Runde schließen: Arbeitsdokumente unter `docs/design/weather-scenes/` löschen, den Link in `docs/decisions/weather.md` auf `docs/features/weather.md` umstellen; CHATS-Zeile „Wetter-Szenen“ entfernen.

## Nicht in diesem Paket
Bilder in den Stundenkarten oder Tageszeilen (bewusst gestrichen, CONCEPT §8) · natives Android-Widget · zweite Landschaft.

## Abnahme
- Bullauge je Lage (Ebenen, keine Bewegung); Widget A/B nach Farbmodus; `calm-colour.seed.spec.ts` und `headStyles.test.ts` grün.
- Obergrenzen aus A11Y.md §4 am Produkt gemessen und eingehalten; im Stand ~0 ms Hauptthread; verdeckte Seite: keine laufende Animation.
- `check:bundle` in der Toleranz; Layout-Verschiebung durch die Szene 0.
- `check:stimulus`: unverändert; bewegt Variante B eine Zahl der Übersicht, steht der Treffer im PR und wartet auf Sven.
- Kontrast des Widget-Texts auf der Szene ≥ 4,5 : 1 in allen Lagen (gleicher Test wie im Kopf).
- Bilder nur im PR-Text (Übersicht mit Widget und Zeile, 1920 und 412, hell, dunkel, „Ruhig“).

## Skills
design:accessibility-review, design:design-critique, council, file-pr, babysit-pr, leaving-pr-comments. Full stop.
```
