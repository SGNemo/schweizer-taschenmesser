# Planner hub 2 – prompts, packages 11, M and the struck 7, 8 and 6

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 11: topic (`feat/plan-topic`)

```
# Aufgabe: Planer-Zentrale 2, Paket 11 – Thema als Klammer: Dinge aus mehreren Modulen zusammenhalten, den Planer auf ein Thema schrumpfen
Routing: Claude Code · Planer-Zentrale 2 Paket 11 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-topic` von frischem `develop`, nach dem Merge von Paket 9. Hotspots ansagen: Dexie-Version / `schema.snapshot.json`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT.md §0.1, §1.1 (`topic`); CONCEPT-INTAKE.md „Idea 11“ (mit „Why a topic and not a tag“); handoff/11-topic.md; COPY.md T1–T4, T6, T8–T12.

## Pflichtliste
- Sammlung `planner_topic` (`title` ≤ 60; Datensatz-id `t_<uuid>`, damit der Link-Schlüssel `planner:<Datensatz-id>` ist und `sweepPurged` ihn findet); `db:bump`, Schema-Historie, `manifest.version`; `planner`-`linkTarget` nur für Themen; Mitgliedschaft nur als `topic`-Link (Thema → Ding), geschrieben nur von der eigenen Aktion „Thema …“ (`addLink` in ihrer rückgängig machbaren Aktion), ein Thema je Ding (ein zweites ersetzt das erste im selben Undo). Der Link speichert das Ding selbst (`entityId` bei Vorkommens-Zeilen); der Filter trifft Zeilen nach der Präfix-Regel aus CONCEPT §1.2; „Thema …“ gibt es nur auf Zeilen, deren Modul verknüpfbar ist (`isLinkable`), und auf Termin-(Blocker-)Zeilen; nie auf Stapel- und Bündel-Zeilen. `sync.test.ts` um den `topic`-Fall (aus 10a hierher verschoben).
- Wähler (Dialog T2) aus Zeilen-⋯ und Auswahlleiste; der Planer liest keine ToDo-Tags. Nach dem ersten Gebrauch bietet das ⋯ einer Zeile das zuletzt benutzte Thema direkt als T12 „Thema: {Umzug}“ über T1 an (gerätelokal gemerkt, nicht synchronisiert).
- Filter aus dem Seiten-⋯ (T3): Zeile T4, Blatt, Band, „Noch ohne Tag“, „Noch offen“ zeigen nur Mitglieder; die Frei-Zeit des Tagesblatts zählt weiter den ganzen Tag; die Kopfzahl weicht T4. Ein Termin mit dem Thema bleibt als Blocker-Zeile sichtbar, Blocker ohne das Thema sind ausgeblendet. Filter ist Gerätezustand (`_meta`), schreibt nichts Synchronisiertes (Schreib-Spion).
- Neues im Feld bei aktivem Filter bekommt das Thema (Vor-Chip T11 mit ✕ vor der Eingabe, nach A2; über die eigene `addFromField` des Planers, nicht über den Bus; Regel aus Paket 3). Nur eine einfache Aufgabe – auch eine mit Schritten – nimmt die Vor-Chips an (A2 → Link und Tag, T11 → Thema). Bei jeder anderen Art (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) werden die Chips durchgestrichen gezeichnet, solange K1 steht, und nicht angewendet. Gibt ein Chip den Tag, nennt K1 bzw. der Toast des Feldes diesen Tag.
- Verwalten in den Planer-Einstellungen: umbenennen, löschen (T9: entfernt nur die Links, ein Undo).
- Zwei Geräte: dasselbe Ding offline in zwei Themen → beide Zeilen bleiben, gelesen wird die spätere; aufgeräumt wird nur in der nächsten Aktion „Thema …“ an diesem Ding – nie im Hintergrund, nie im Undo-Eintrag einer anderen Aktion.

## Nicht in diesem Paket
Eine Themen-Seite außerhalb des Planers, Farben je Thema, Thema in der Eingabe-Syntax, Verschachtelung, neue Felder in anderen Modulen.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-topic.seed.spec.ts`; Mess-Skript D4: `rows` 20 → 7, `moduleSwitches` 2 → 0, `planFilter` nein → ja, `perThing` 20 / 15 → 15, `taps` Desktop 27 → 22, Handy gemessen 23 – ein im Skript-Kopf benannter Preis, dauerhaft; `IST` bleibt 22 (Donnerstags Rechnung wartet unter dem gefalteten „Danach“ des Handys). Lesart des Skripts ändern: `rows` (die „· n Dinge“ der Kacheln plus „Termine“) und `planFilter` nach dem Einschalten des Filters lesen; heute werden beide vor dem Weg über einen Knopfnamen gelesen. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

## Skills
`council` (Daten, Link-Vertrag, zwei Geräte), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package M: measure after, close the round (`qa/planner-hub-2-remeasure`)

```
# Aufgabe: Planer-Zentrale 2, Paket M – nachmessen und die Runde schließen
Routing: Claude Code · Planer-Zentrale 2 Paket M · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `qa/planner-hub-2-remeasure` von frischem `develop`, nach dem letzten gebauten Paket.

## Pflichtliste
- `web/e2e/usecases/planner-hub-2.spec.ts`: jede Zahl gegen `TARGET` und die Stufen in docs/design/planner-hub-2/FIGURES.md prüfen; wo eine Zahl ihr Ziel nicht erreicht, steht der Grund im PR und in ANALYSIS.md („measured after“-Tabelle), nichts wird gelockert.
- `npm run measure:stimulus` für Planer 1920 und 412: vorher/nachher gegen `web/e2e/stimulus-budget.json`.
- Das Gestrichene bleibt: die gestrichenen Prompts 7, 8, 6 aus `PACKAGES-PROMPTS-5.md`, `handoff/06-errand.md`, `07-wait.md`, `08-duration.md`, `mockups/06-errand.html`, `07-wait.html`, `08-duration.html`, `mock.css`, `render.mjs` und `CONCEPT-STRUCK.md` wandern nach `docs/design/planner-hub-2/struck/`; dazu kommen Kopien des Blocks `#common` aus PACKAGES.md und von `handoff/00-common.md` nach `struck/` (die gestrichenen Prompts zitieren sie), und die Links der gestrichenen Prompts zeigen auf diese Kopien. Die übrigen Arbeitsdokumente der Runde werden gelöscht (PACKAGES*.md, die anderen Übergaben und Mockups); FIGURES.md bleibt, auf ihn zeigt der Kopf des Mess-Skripts; README.md auf „gebaut“ stellen, Entscheidungen stehen in docs/decisions/plan-hub-2.md; Label `no-changelog`.

## Skills
`review-loop` (eine Runde), `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 7 (struck by principle 1): „Warte auf Antwort“ (`feat/plan-wait`) – only on the maintainer's explicit yes

```
# Aufgabe: Planer-Zentrale 2, Paket 7 – „Warte auf Antwort“: eine Zeile verschwindet bis zu einem Tag und kommt mit Person oder Mail wieder
Routing: Claude Code · Planer-Zentrale 2 Paket 7 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-wait` von frischem `develop`, frühestens nach Paket 11. Hotspot ansagen: `core/modules/types.ts`.

## Ausgangslage
CONCEPT-STRUCK.md „Idea 7“; handoff/07-wait.md; COPY.md W1–W6. Bestand: ToDos `startDate` (blendet bis zu dem Tag aus), `onLater`/`listLater` als Muster.

## Pflichtliste
- Vertrag: `LinkRel` um `wait`; `PlannableSource.onWait?(id, until | undefined)` und `listWaiting?()`; ToDos setzen `startDate`.
- Zeilen-⋯ W1 → Dialog W2 → eine Aktion, ein Undo (Tag, „fest“ und der `wait`-Link kommen zusammen zurück); gefaltete Zeile W3 unter „Nächste Wochen“; „Zurückholen“.
- Am Tag steht das Ding wieder unter „Noch ohne Tag“ mit Chip W5 – ohne dass an dem Tag etwas geschrieben wird (Schreib-Spion mit verstellter Uhr).
- Keine Benachrichtigung, kein Lesen von Mail, kein Zähler am Kopf.

## Nicht in diesem Paket
Erkennen einer Antwort, Erinnerungen, Warten für Rechnungen oder Listen, Mitglieder eines Bündels.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-wait.seed.spec.ts`; Mess-Skript D5: Griffe 7 → 5, sonst unverändert.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 8 (struck by principle 1): measured duration (`feat/plan-measure`) – only on the maintainer's explicit yes

```
# Aufgabe: Planer-Zentrale 2, Paket 8 – echte Dauer: „Los“ misst, ein neues gleiches Ding schlägt die gemessene Zeit vor
Routing: Claude Code · Planer-Zentrale 2 Paket 8 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-measure` von frischem `develop`, frühestens nach 5a. Hotspots ansagen: Dexie-Version / `schema.snapshot.json`.

## Ausgangslage
CONCEPT-STRUCK.md „Idea 8“ (ganz; „The same thing“ ist die Regel); handoff/08-duration.md; COPY.md R1–R3. Frühere Entscheidung: nichts ändert eine Schätzung von selbst – das bleibt: nur ein **neues** Ding bekommt den Vorschlag als Startwert.

## Pflichtliste
- `planner_measure` (`key`, `minutes`, `on`), `db:bump`, Schema-Historie, `manifest.version`; aufgezeichnet in der Aktion „Erledigt“ / „Fertig · weiter“ einer Fokus-Runde (Pausen abgezogen; < 1 Min und > 8 h nicht), dort auch auf 5 je Schlüssel gekürzt.
- Schlüssel: stabile Quell-id vor Titel; Titel-Normalisierung = die von `pastePlan.ts`; kein unscharfer Treffer.
- Vorschlag: Median der letzten 5 bei ≥ 2, auf 5 gerundet, nur beim Anlegen ohne Minuten; Anzeige R1, Zeile R2 in „Dauer …“; Schalter und „Gemessene Zeiten löschen“ (R3).
- Ausschluss-Test: die Sammlung erreicht keinen Export, keinen Kopiertext, keine Daten-API, kein Assistenten-Schema, keine Diagnose.

## Nicht in diesem Paket
Zeiterfassung an- oder einschalten, bestehende Schätzungen ändern, Statistik-Ansichten, Vergleiche „geplant gegen gebraucht“.

## Abnahme
Tests der Übergabe; Mess-Skript C1: `learned` ja, `durationProposed` beim zweiten Mal = gemessen.

## Skills
`council` (Daten, Privatsphäre), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 6 (struck by principle 1): places and map of an errand round (`feat/plan-errand`) – only on the maintainer's explicit yes

```
# Aufgabe: Planer-Zentrale 2, Paket 6 – Besorgungsrunde mit Orten: Stopps, „Ort …“, Sprung auf die Karte
Routing: Claude Code · Planer-Zentrale 2 Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-errand` von frischem `develop`, frühestens nach 5b.

## Ausgangslage
Gebaut ist seit 5b: die Runde als Bündel, die Liste im Bündel abhaken. Gestrichen und hier nachzuholen: CONCEPT-INTAKE.md „Idea 6“ (Abschnitt „Struck parts“); handoff/06-errand.md; COPY.md E1–E3.

## Pflichtliste
- `LinkRel` um `place`; `maps`-`linkTarget` für Orte (Name; nur eigene Daten, id nicht vertrauenswürdig) und ein fauler Namens-Leser für den Dialog „Ort …“.
- Bündel-Art „Unterwegs“ (Feld `kind` auf `planner_bundle`, Schalter im Dialog „Bündeln …“): Zeile mit Stopps (E1), Panel nach der Skizze der Übergabe.
- „Auf der Karte ansehen“ → `/maps?places=<ids>&from=plan`: Erlaubt-Liste, ≤ 20 ids, unbekannte fallen weg, null Schreibvorgänge, Parameter verlässt die URL.

## Nicht in diesem Paket
Eine Karte im Planer, Routen, Wegezeiten, Adressfelder an Dingen.

## Abnahme
Tests der Übergabe; Mess-Skript C2 unverändert oder besser; `mapShown` neu gemessen.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

