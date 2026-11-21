# Planner rethink – packages

After the answers of 2026-11-21 ([README](README.md)). Order: **1 → 2 strictly**; then 3, 4 in parallel if `routes/PlannerPage.tsx` is coordinated (heads-up in the notes repo), 5 after 4, 6 after 3, 7 last. Every package holds the four rules of [CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §7 and re-measures `IST` in the measuring script for the paths it changes. Prompts 4–7: [PACKAGES-4-7](PACKAGES-4-7.md). Package 1 is built by the chat that wrote this plan.

| # | Package | Branch | Scope | Target from CONCEPT §8 | Review |
| --- | --- | --- | --- | --- | --- |
| 1 | State model, migration, „nothing moves by itself“ | `feat/plan-stays-put` | `propose()`, `locked`, one-time migration, no background run, plain tab „Noch offen“, entering on the day on the sheet ([HANDOFF](HANDOFF.md)) | unasked moves 0, collateral 0, new thing on its day | council |
| 2 | Lock, lock words, overbooking, date in the text | `feat/plan-lock-overbook` | one-tap lock, „… fest“ / „…!“, the calm overbooking line, „Rest verteilen“ per day | lock in one tap | council |
| 3 | Tab „Noch offen“ in one move | `feat/plan-open-tab` | group actions, fixed things first, the line on today | repair ≤ 10 taps in 1 pass, 1 for all | review loop |
| 4 | More than a week | `feat/plan-weeks` | paging band, „4 Wochen“, four-week picker in „Verschieben …“ | a day in three weeks in 3 taps | review loop |
| 5 | Moving | `feat/plan-move` | drag, keyboard, multi-select | one row changes per drop | review loop |
| 6 | Sources, proposals, „Woche vorschlagen“ | `feat/plan-suggest` | chips, muted ToDo row, `suggestNew` | counter-scenarios not worse | council |
| 7 | Re-measure | `chore/plan-rethink-measure` | `TARGET` asserted, phone paths, clean-up of the round | all targets | review loop |

Hotspots across the packages: `web/src/core/plan/**`, `web/src/modules/planner/{run,services,actions,board}.ts`, `routes/PlannerPage.tsx`, `web/src/modules/todos/{plannable,planMark}.ts`, `web/src/core/modules/types.ts` (1, maybe 6), `web/src/strings.ts` (all).

### Prompt – package 1: Zustandsmodell, Migration, „nichts wandert von selbst“ (`feat/plan-stays-put`)

```
# Aufgabe: Planer neu gedacht – Zustandsmodell, Migration, „nichts wandert von selbst“ (Paket 1 von 7)

Routing: Claude Code · Planer neu gedacht Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-stays-put` von frischem `develop` – nach dem Merge von #1034 (Design). Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/core/plan/**` (Engine → Vorschlagswerk), `web/src/modules/planner/{run,services,actions,board}.ts`, `web/src/modules/todos/{plannable,planMark}.ts` (Rückschreiben), `web/src/core/modules/types.ts` (`PlannableItem.day?`), `web/src/strings.ts`, `core/backup` (Restore löscht `planner.model`).
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“.

## Ausgangslage
- Gemessen auf `develop`: 5 von 10 gelegten Dingen wechseln nach zwei verpassten Tagen den Tag, 17 Handgriffe zur Reparatur, Neues landet nie am gewählten Tag (ANALYSIS.md §1). Ursache: jeder Lauf plant alles neu (ANALYSIS §2–§3).
- HANDOFF.md beschreibt, was nach diesem Paket auf dem Bildschirm ist.

## Pflichtliste
- `core/plan`: `propose()` und `load()` nach CONCEPT §2 (`stay` unangetastet, `loose` je Einheit, nie teilen, stabil bei teilweisem Übernehmen); `plan()` und die Regeln kept/carried/bumped/pulled entfallen; Fixtures S1–S6 als (stay, loose) → Vorschläge neu, je eine Zeile Begründung.
- Daten: `locked` auf `planner_assignment`, `manifest.version` + Migration; `PlannableItem.day?` (nur Fitness, Routinen); einmalige Migration nach CONCEPT-MIGRATION §2 (Flag `planner.model` in `_meta`, Restore löscht es, `autoReplan` einmal auf aus).
- `services.ts`: kein Lauf mehr aus Live-Query, Mitternacht, Sichtbarkeit, Start, Sync; Mitternacht rendert nur neu. `runUser` wird zu Handlungen, die nur ihr Ding schreiben (ein Undo-Eintrag).
- Handlungen: Eintragen legt auf den Tag auf dem Blatt, sonst heute; „Verschieben …“ = Tag setzen (sperrt nicht); „Später“ = nächster Tag; Haken ruft nur `onDone`; „Vom Tag nehmen“/„Nicht planen“ entfernen die Zeile.
- Lesen: ein Selektor `placements(range)` (CONCEPT-MIGRATION §3) für Blatt, Band, Widget, Kalender-Chips, `plannedOn`; `dayOf` nach CONCEPT §1.
- Oberfläche nach HANDOFF.md: Reiter „Noch offen“ (schlicht), „Noch ohne Tag“ statt „Wartet auf freie Zeit“, „fest“ nur für das Schloss, keine Grundzeilen, Ein-Fakt-Toasts.
- Vorschauen („Rest verteilen“, „Tage einteilen“, Sätze) laufen über `propose()`.
- ToDo-Helfer: Marke ohne `prior`; Abschalten behält `plannedFor`; Entfernen löscht nur ein planer-eigenes Datum (CONCEPT-MIGRATION §4).
- Texte DE + EN (`check:i18n`), Change-Note (DE/EN) mit dem Satz „erst alle Geräte aktualisieren, dann planen“.

## Nicht in diesem Paket
- Schloss mit einem Tipp, Sperr-Wörter, ruhige Überbuchungszeile (2) · Gruppen-Aktionen im Reiter (3) · Blättern, 4 Wochen (4) · Ziehen, Mehrfachauswahl (5) · Chips „Vorschlag“/„In ToDos“, „Woche vorschlagen“ (6).

## Abnahme
- Tests aus HANDOFF §8, darunter die vier Regeln (Zeilen-Schnappschuss je Handlung, Schreib-Spion) und die Migrationstabelle; „zwei Geräte“: Verschieben auf A + Sperren auf B → Tag von A, fest.
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`). Ziel hier: U1 `unaskedAfterTwoDays` 0, `collateral` 0, `layCollateral` 0; U2–U4 „ja“.
- `check`, `test`, `e2e` grün; `check:modules`, `check:docs`; `docs/howto/planning-modules.md` an das neue Modell angepasst.

## Skills
`council` (Architect: Zustandsmodell eindeutig, Vorschlagswerk deterministisch, kein Schreiben ohne Handlung, zwei Geräte konvergieren; Guardian: keine Platzierung geht verloren, jede schreibende Handlung ist ein Undo-Eintrag, kein stilles Schreiben; Advocate: Leitsätze 1–6, ruhige Wörter, Tippzahlen). `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

### Prompt – package 2: Sperren, Sperr-Wörter, Überbuchung, Datum im Text (`feat/plan-lock-overbook`)

```
# Aufgabe: Planer neu gedacht – Sperren, Sperr-Wörter, Überbuchung, Datum im Text (Paket 2 von 7)

Routing: Claude Code · Planer neu gedacht Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-lock-overbook` von frischem `develop` – nach dem Merge von Paket 1. Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/strings.ts`, `web/src/modules/planner/dueWords.ts` (Parser).
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“.

## Ausgangslage
- Nach Paket 1 bleibt alles liegen; „fest“ gibt es nur über das Menü, ein voller Tag zeigt nur seine Zahl.

## Pflichtliste
- Schloss an jeder Zeile: ein Tipp, `button` mit `aria-pressed`, Name „Fest an diesem Tag: <Titel>“, Wort „fest“ + Symbol; Toast „Fest: Mi“ / „Nicht mehr fest: Mi“; von Hand verschobenes Festes behält das Schloss („… liegt auf Mi · fest“).
- Feld: Datum im Text gewinnt; „… fest“, „… lock“, „…!“ nach einem Tag sperren, ohne Tag bleiben sie Titel; das `p`-Präfix behält seine Wirkung (ANALYSIS R13).
- Überbuchung: Zeile „2 h 10 mehr als planbar“ mit Link „Rest verteilen“ (die nicht festen Dinge dieses Tags, Vorschau), Band-Kachel „+ 2 h 10 mehr“; Hinweis beim Eintragen auf einen vollen bzw. frei gehaltenen Tag (CONCEPT-COPY).
- Feste Blöcke zeigen nur ihre Zeit.

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
Branch `feat/plan-open-tab` von frischem `develop` – nach dem Merge von Paket 2 (parallel zu 4 und 5 möglich, wenn `PlannerPage.tsx` abgestimmt ist). Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/modules/planner/routes/PlannerPage.tsx`, `web/src/strings.ts`.
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“.

## Ausgangslage
- Paket 1 hat den Reiter schlicht gebaut (Zeilen je Tag, Menü). Svens Antwort: von dort neu verteilen; Festes landet auch dort, anders markiert, damit er es schneller verteilt.

## Pflichtliste
- Gruppen im Reiter: Festes zuerst („braucht einen neuen Tag“), dann je vergangenem Tag; Zeile = Haken, Titel, „war Mo“, Schloss, Verschieben-Knopf (kein ⋯): zwei Tipps bis zum Tag, auch am Handy.
- Aktionen: „Alle auf heute“ (ein Undo), „Verteilen …“ (Vorschau über `propose()`, Festes bleibt und wird genannt), „Auswählen“ → ein Tag für mehrere.
- Zeile oben auf heute: „Von Mo, Di ist noch etwas offen. · Ansehen“; Punkt am Reiter, nie eine Zahl; leer: „Nichts offen von früher.“; nach 14 Tagen Angebot „Vom Tag nehmen“.
- Vergangene Tage in Band/Raster: „offen“ ohne Zahl.

## Nicht in diesem Paket
- Mehrwochen-Ansicht (4), Ziehen (5).

## Abnahme
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`). Ziel: U1 `repairTaps` ≤ 10 in einem Durchgang, `untraceable` 0; eigener Pfad „Alle auf heute“ = 1 Tipp.
- FOCUS-Checkliste im PR (keine Zahl, kein Rot, Aus-Schalter: die Zeile auf heute ist abschaltbar unter „Fokus & Aufmerksamkeit“).
- Eine Live-Meldung je Handlung, Fokus auf die nächste Zeile.

## Skills
`review loop`. `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
