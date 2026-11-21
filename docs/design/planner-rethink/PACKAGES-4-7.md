# Planner rethink – packages 4–7 (prompts)

Table, order and prompts 1–3: [PACKAGES](PACKAGES.md).

### Prompt – package 4: Mehr als eine Woche – blättern, „4 Wochen“, jeder Tag planbar (`feat/plan-weeks`)

```
# Aufgabe: Planer neu gedacht – Mehr als eine Woche – blättern, „4 Wochen“, jeder Tag planbar (Paket 4 von 7)

Routing: Claude Code · Planer neu gedacht Paket 4 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-weeks` von frischem `develop` – nach dem Merge von Paket 2 (parallel zu 3 und 5 möglich). Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/modules/planner/components/WeekBand.tsx`, `calendar.ts` (`BOARD_DAYS`), `routes/PlannerPage.tsx`.
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“.

## Ausgangslage
- Das Brett zeigt immer sieben Tage ab heute; „Verschieben …“ bietet sieben Tage; `horizonDays` begrenzt den Plan (ANALYSIS R05).

## Pflichtliste
- Band blättert („‹ KW 47 ›“, „Heute“), `?week=`; Umschalter „Woche · 4 Wochen“ in der Band-Zeile (nicht im Kopf); Raster-Tag zeigt Anzahl Dinge, „offen“, „+ … mehr“.
- „Verschieben …“ zeigt die vier Wochen ab heute als Auswahl (‹ › für mehr): 3 Tipps für einen Tag in drei Wochen.
- Lesen je Bereich über den `date`-Index; Quellen bis zum letzten sichtbaren Tag; `horizonDays` gilt nur noch für Vorschläge.
- „Zeiten dieser Woche“ (bisher „Woche prüfen“) wirkt auf die Woche in Sicht, ohne Lauf.
- Kalender-Chips für den Bereich, den der Kalender fragt.

## Nicht in diesem Paket
- Ziehen auf Band/Raster (5).

## Abnahme
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`). Ziel: U5 `possible` ja, `taps` 3, `dayVisibleInPlanner` ja.
- A11y: Tage als benannte Knöpfe (Datum, Last, Zustand), `aria-current="date"`, Raster als `grid`; vergangene Tage über den gedämpften Tinten-Token, nicht über Deckkraft; 412 px ohne Querscrollen; Reiz-Budget (`check:stimulus`) gehalten.
- Leistung: 28 Tage, 200 Platzierungen – Öffnen ohne spürbare Verzögerung (Messwert im PR).

## Skills
`review loop`. `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

### Prompt – package 5: Bewegen – ziehen, Menü, Tastatur, mehrere auf einmal (`feat/plan-move`)

```
# Aufgabe: Planer neu gedacht – Bewegen – ziehen, Menü, Tastatur, mehrere auf einmal (Paket 5 von 7)

Routing: Claude Code · Planer neu gedacht Paket 5 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-move` von frischem `develop` – nach dem Merge von Paket 4 (Drop-Ziele sind Band und Raster). Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/modules/planner/components/ThingRow.tsx`, `routes/PlannerPage.tsx`.
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“.

## Ausgangslage
- Verschieben geht nur über das Menü.

## Pflichtliste
- Ziehen einer Zeile auf einen Tag des Bands oder Rasters (Maus; Touch nach langem Druck, abgebrochen = nichts); die ganze Kachel ist Ziel.
- Gleichwertig: Menü „Verschieben …“ (erster Eintrag), `M` auf der fokussierten Zeile, Pfeiltasten + Enter im Raster.
- Mehrfachauswahl auf dem Tagesblatt („Auswählen“ im Tagesmenü), ein Tag für alle, ein Undo-Eintrag.
- Ablegen bewegt das abgelegte Ding und sonst nichts; volles Ziel zeigt seine Überbuchung.

## Nicht in diesem Paket
- Reihenfolge im Tag per Ziehen nur, wenn sie ohne neue Griffe auskommt; sonst „Noch offen“.

## Abnahme
- Test „Zeilen-Schnappschuss“: nach jedem Ablegen ändert sich genau eine Zeile.
- A11y: WCAG 2.5.7 (Ziehen hat eine Ein-Zeiger-Alternative), eine Live-Meldung je Ablegen, reduzierte Bewegung.
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`).

## Skills
`review loop`. `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

### Prompt – package 6: Quellen, Vorschläge und „Woche vorschlagen“ (`feat/plan-suggest`)

```
# Aufgabe: Planer neu gedacht – Quellen, Vorschläge und „Woche vorschlagen“ (Paket 6 von 7)

Routing: Claude Code · Planer neu gedacht Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-suggest` von frischem `develop` – nach dem Merge von Paket 3. Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/core/modules/types.ts` (nur falls `day?` nicht reicht), die `plannable.ts` der Quellmodule, `web/src/modules/planner/settings.ts`.
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“.

## Ausgangslage
- Seit Paket 1 liegen Dinge aus Quellen ohne Tag unter „Noch ohne Tag“, ohne Hinweis auf Frist oder ToDo-Datum.

## Pflichtliste
- Chip „Vorschlag: Do · Frist Fr“ für Dinge mit Frist: ein `propose()`-Aufruf über alle, beim Rendern, nie gespeichert; ein Tipp „Übernehmen“ legt.
- Blasse Zeile „In ToDos: Do · Hierher legen“ am Tag des ToDo-Datums (zählt nicht zur Last; Datum vor heute → Chip unter „Noch ohne Tag“).
- „Woche vorschlagen“ an „Noch ohne Tag“: Vorschau → „Übernehmen“ (ein Undo); bietet „In Teile aufteilen …“, wenn etwas an keinen Tag am Stück passt.
- Einstellung `suggestNew` „Neues automatisch vorschlagen“ (aus): Chips auch ohne Frist, im selben Aufruf hinter allen Frist-Dingen; Hilfetext aus CONCEPT-COPY.
- „Tage einteilen“: letzter Schritt ist derselbe Vorschlag.

## Nicht in diesem Paket
- Hartes Versions-Tor für alte Geräte (Sync-Protokoll).

## Abnahme
- Gegen-Szenarien aus CONCEPT §7 als e2e: erster Morgen, „Kopf leer“ (+2 Tipps erlaubt), Mahnungs-Kette (+1 Tipp).
- Fixture: Einstellung an/aus ändert keinen Frist-Chip; zwei Chips nie derselbe Platz.
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`).

## Skills
`council` (Architect: Zustandsmodell eindeutig, Vorschlagswerk deterministisch, kein Schreiben ohne Handlung, zwei Geräte konvergieren; Guardian: keine Platzierung geht verloren, jede schreibende Handlung ist ein Undo-Eintrag, kein stilles Schreiben; Advocate: Leitsätze 1–6, ruhige Wörter, Tippzahlen). `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

### Prompt – package 7: Nachmessen mit Svens Use Case (`chore/plan-rethink-measure`)

```
# Aufgabe: Planer neu gedacht – Nachmessen mit Svens Use Case (Paket 7 von 7)

Routing: Claude Code · Planer neu gedacht Paket 7 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `chore/plan-rethink-measure` von frischem `develop` – nach dem Merge von Paket 6.
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“.

## Ausgangslage
- Die Pakete 1–6 haben `IST` je Pfad nachgezogen.

## Pflichtliste
- `planner-rethink.spec.ts`: Zusicherung von `IST` auf `TARGET` umstellen; Pfade für Handy (pixel-7) ergänzen; drei Läufe hintereinander, hell und dunkel.
- Wachstum versteckter Zeilen erledigter Dinge messen (CONCEPT-MIGRATION §3); nur wenn nötig: Aufräumen, das die Quelle nach genauen IDs fragt – als eigenes Paket vorschlagen, nicht bauen.
- ANALYSIS.md §1 um die Spalte „gemessen“ ergänzen; Arbeitsdokumente der Runde löschen (PACKAGES, HANDOFF, mockups), Entscheidungen bleiben in `docs/decisions/plan-rethink.md`; `docs(status)`-PR mit einer Zeile.

## Nicht in diesem Paket
- Neue Funktionen.

## Abnahme
- Alle `TARGET`-Werte erreicht oder die Abweichung im PR begründet; `e2e:full` grün.

## Skills
`review loop`. `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
