# Planner rethink – packages 2–3 (prompts)

Table, order and prompt 1: [PACKAGES](PACKAGES.md).

### Prompt – package 2: Sperren, Sperr-Wörter, Überbuchung, Datum im Text (`feat/plan-lock-overbook`)

```
# Aufgabe: Planer neu gedacht – Sperren, Sperr-Wörter, Überbuchung, Datum im Text (Paket 2 von 7)

Routing: Claude Code · Planer neu gedacht Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-lock-overbook` von frischem `develop` – nach dem Merge von Paket 1. Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/strings.ts`, `web/src/modules/planner/dueWords.ts` (Parser).
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“ (gemeint ist der PR-Abschnitt, nicht der Reiter). Reihenfolge der Pakete: streng 1 → 2 → 3 → 4 → 5 → 6 → 7, jedes nach dem Merge des vorigen (sie teilen sich `routes/PlannerPage.tsx`, `components/ThingRow.tsx`, `components/WeekBand.tsx`).

## Ausgangslage
- Nach Paket 1 bleibt alles liegen; „fest“ gibt es nur über das Menü, ein voller Tag zeigt nur seine Zahl.

## Pflichtliste
- Schloss an jeder Zeile: ein Tipp, `button` mit `aria-pressed`, Name „Fest an diesem Tag: <Titel>“, Wort „fest“ + Symbol; Toast „Fest: Mi“ / „Nicht mehr fest: Mi“; von Hand verschobenes Festes behält das Schloss („… liegt auf Mi · fest“).
- Feld: Datum im Text gewinnt; „… fest“, „… lock“, „…!“ nach einem Tag sperren, ohne Tag bleiben sie Titel; das `p`-Präfix behält seine Wirkung (ANALYSIS R13).
- Überbuchung: Zeile „2 h 10 mehr als planbar“ mit Link „Rest verteilen“ (die nicht festen Dinge dieses Tags, Vorschau), Band-Kachel „+ 2 h 10 mehr“; Hinweis beim Eintragen auf einen vollen bzw. frei gehaltenen Tag (CONCEPT-COPY).
- Feste Blöcke zeigen nur ihre Zeit.
- Damit Fristen und ToDo-Daten nicht fünf Pakete lang ohne Hinweis unter „Noch ohne Tag“ liegen: Chip „Vorschlag: Do · Frist Fr“ (ein `propose()`-Aufruf über alle Frist-Dinge, nie gespeichert, ein Tipp „Übernehmen“) und die blasse Zeile „In ToDos: Do · Hierher legen“ am Tag des ToDo-Datums.

## Nicht in diesem Paket
- Reiter-Aktionen (3), Mehrwochen (4), Ziehen (5).

## Abnahme
- Kontrast der Warnzeile ≥ 4,5 : 1 in beiden Themen (`e2e/readability.spec.ts`); Schloss ≥ 44 px (`touch-hit-phone`).
- Tests: Sperr-Wörter (mit/ohne Tag), Schloss-Toggle + Undo, „Rest verteilen“ lässt Festes liegen.
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`).

## Skills
`council` (Architect: Zustandsmodell eindeutig, Vorschlagswerk deterministisch, kein Schreiben ohne Handlung, zwei Geräte konvergieren; Guardian: keine Platzierung geht verloren, jede schreibende Handlung ist ein Undo-Eintrag, kein stilles Schreiben; Advocate: Leitsätze 1–6, ruhige Wörter, Tippzahlen). `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

### Prompt – package 3: Reiter „Noch offen“ – in einem Zug zurücklegen (`feat/plan-open-tab`)

```
# Aufgabe: Planer neu gedacht – Reiter „Noch offen“ – in einem Zug zurücklegen (Paket 3 von 7)

Routing: Claude Code · Planer neu gedacht Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-open-tab` von frischem `develop` – nach dem Merge von Paket 2. Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/modules/planner/routes/PlannerPage.tsx`, `components/ThingRow.tsx`, `web/src/strings.ts`.
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“ (gemeint ist der PR-Abschnitt, nicht der Reiter). Reihenfolge der Pakete: streng 1 → 2 → 3 → 4 → 5 → 6 → 7, jedes nach dem Merge des vorigen (sie teilen sich `routes/PlannerPage.tsx`, `components/ThingRow.tsx`, `components/WeekBand.tsx`).

## Ausgangslage
- Paket 1 hat den Reiter schlicht gebaut (Zeilen je Tag, Menü). Svens Antwort: von dort neu verteilen; Festes landet auch dort, anders markiert, damit er es schneller verteilt.

## Pflichtliste
- Gruppen im Reiter wie in Paket 1 (erste Gruppe wörtlich „Fest – braucht einen neuen Tag“, dann je vergangenem Tag); Zeile = Haken, Titel, „war Mo“, Schloss, Verschieben-Knopf (kein ⋯): zwei Tipps bis zum Tag, auch am Handy.
- Aktionen: „Alle auf heute“ (ein Undo), „Verteilen …“ (Vorschau über `propose()`, Festes bleibt und wird genannt), „Auswählen“ → ein Tag für mehrere (die Mehrfachauswahl wird hier einmal gebaut; Paket 5 nutzt sie für das Tagesblatt).
- Zeile oben auf heute: „Von Mo, Di ist noch etwas offen. · Ansehen“ (mehr als drei Tage: „Seit Do, 12. ist noch etwas offen.“); Punkt am Reiter, nie eine Zahl; leer: „Nichts offen von früher.“; nach 14 Tagen Angebot „Vom Tag nehmen“.

## Nicht in diesem Paket
- Mehrwochen-Ansicht (4), Ziehen (5).

## Abnahme
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`). Ziel: U1 `repairTaps` ≤ 10 in einem Durchgang, `untraceable` 0; eigener Pfad „Alle auf heute“ = 1 Tipp.
- FOCUS-Checkliste im PR (keine Zahl, kein Rot, Aus-Schalter: die Zeile auf heute ist abschaltbar unter „Fokus & Aufmerksamkeit“).
- Eine Live-Meldung je Handlung, Fokus auf die nächste Zeile.

## Skills
`review loop`. `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
