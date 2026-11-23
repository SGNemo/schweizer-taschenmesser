# Planner hub 2 – prompts, packages 6 to M (and the struck 8)

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 6: errand round (`feat/plan-errand`)

```
# Aufgabe: Planer-Zentrale 2, Paket 6 – Besorgungsrunde: Dinge außer Haus als ein Bündel mit Stopps, Liste und Orten
Routing: Claude Code · Planer-Zentrale 2 Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-errand` von frischem `develop`, nach dem Merge von Paket 3.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 6“; handoff/06-errand.md (baut auf 05-bundle.md); COPY.md E1–E3, B12 (Schalter „Unterwegs“).

## Pflichtliste
- Bündel der Art `errand`: Schalter im Dialog „Bündeln …“; Zeile mit Stopps (E1); Panel nach der Skizze (nummerierte Stopps, Listen-Stopp offen mit seinen Haken).
- `maps`: `linkTarget` für Orte (Name; nur eigene Daten, id nicht vertrauenswürdig) und ein fauler Namens-Leser für den Dialog „Ort …“; Link `place` vom Mitglied zum Ort.
- „Auf der Karte ansehen“ → `/maps?places=<ids>&from=plan`: Erlaubt-Liste, ≤ 20 ids, unbekannte fallen weg, null Schreibvorgänge, Parameter verlässt die URL.
- „Los“ über Stopps; ein Listen-Stopp zeigt seine Haken unter dem Titel.

## Nicht in diesem Paket
Eine Karte im Planer (gestrichen), Routen, Wegezeiten, Adressfelder an Dingen, ein Vorschlag, was „außer Haus“ ist.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-errand.seed.spec.ts`; Mess-Skript C2: Zeilen 3 → 1, Modulwechsel 2 → 0 (der Kartensprung wird getrennt gezählt).

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 9: before and after an appointment (`feat/plan-appointment`)

```
# Aufgabe: Planer-Zentrale 2, Paket 9 – ein Termin bietet „Vorbereiten …“ und „Danach …“ an
Routing: Claude Code · Planer-Zentrale 2 Paket 9 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-appointment` von frischem `develop`, nach dem Merge von Paket 6.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 9“; handoff/09-appointment.md; COPY.md A1–A4; A11Y.md (Termin).

## Pflichtliste
- Die Blocker-Zeile eines Termins klappt auf (Titel als Knopf); Kalender liefert `planPanel`: Tag · Zeit · Ort, verknüpfte Dinge unter „Vorbereitung“ / „Danach“ als Haken-Zeilen (es sind ToDos), die zwei Knöpfe A1.
- Ein Tipp setzt den Fokus ins Feld mit dem Vor-Chip A2 (✕, zweite Wahl A3) im Platz der Vorschauzeile aus Paket 3; Enter legt ein ToDo auf den Tag des Termins (bzw. davor/danach) mit `links: [{ rel: 'before' | 'after' }]`; ein Undo.
- Die neue Zeile trägt Chip A4 und sortiert im Tag direkt vor bzw. nach dem Blocker; sie bekommt keine Uhrzeit (der Planer bleibt ein Tagesplaner).
- Termin verschoben: nichts bewegt sich von selbst. Termin gelöscht: der Chip sagt es in Worten.

## Nicht in diesem Paket
Automatische Zeilen, Wegezeit, Vorlagen je Terminart, ganztägige Termine.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-appointment.seed.spec.ts`; Mess-Skript D3: Modulwechsel 2 → 0, Griffe 7 → 3; `check:stimulus` unverändert.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 11: topic (`feat/plan-topic`)

```
# Aufgabe: Planer-Zentrale 2, Paket 11 – Thema als Klammer: Dinge aus mehreren Modulen zusammenhalten, den Planer auf ein Thema schrumpfen
Routing: Claude Code · Planer-Zentrale 2 Paket 11 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-topic` von frischem `develop`, nach dem Merge von Paket 9. Hotspots ansagen: Dexie-Version / `schema.snapshot.json`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT.md §0.1, §1.1 (`topic`); CONCEPT-INTAKE.md „Idea 11“ (mit „Why a topic and not a tag“); handoff/11-topic.md; COPY.md T1–T9.

## Pflichtliste
- Sammlung `planner_topic` (`title` ≤ 60); `db:bump`, Schema-Historie, `manifest.version`; `planner`-`linkTarget` für `t_`-ids; Mitgliedschaft nur als `topic`-Link (`planner:t_<id>` → Ding), ein Thema je Ding (ein zweites ersetzt das erste im selben Undo).
- Wähler (Dialog T2) aus Zeilen-⋯ und Auswahlleiste; Angebot T7 aus ToDo-Tags (höchstens 3, nur ein Tipp übernimmt, nichts wird zurück in Tags geschrieben).
- Filter aus dem Seiten-⋯ (T3): Zeile T4, Blatt, Band, „Noch ohne Tag“, „Noch offen“ zeigen nur Mitglieder; die Kopfzahl zählt weiter den ganzen Tag; „Auch im Thema“ (T5) für verknüpfte Dinge, die keine Planzeilen sind (Unterlagen nur mit Kategorie-Wort); Filter ist Gerätezustand (`_meta`), schreibt nichts Synchronisiertes (Schreib-Spion).
- Neues im Feld bei aktivem Filter bekommt das Thema (Vor-Chip mit ✕).
- Verwalten in den Planer-Einstellungen: umbenennen, löschen (T9: entfernt nur die Links, ein Undo).
- Zwei Geräte: dasselbe Ding offline in zwei Themen → beide Zeilen bleiben, gelesen wird die spätere; aufgeräumt wird erst beim nächsten Tipp an diesem Ding, nie im Hintergrund.

## Nicht in diesem Paket
Eine Themen-Seite außerhalb des Planers, Farben je Thema, Thema in der Eingabe-Syntax, Verschachtelung, neue Felder in anderen Modulen.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-topic.seed.spec.ts`; Mess-Skript D4: Zeilen 20 → 7, 3 Griffe für 5 Dinge.

## Skills
`council` (Daten, Link-Vertrag, zwei Geräte), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 7: „Warte auf Antwort“ (`feat/plan-wait`) – start only after the maintainer's yes

```
# Aufgabe: Planer-Zentrale 2, Paket 7 – „Warte auf Antwort“: eine Zeile verschwindet bis zu einem Tag und kommt mit Person oder Mail wieder
Routing: Claude Code · Planer-Zentrale 2 Paket 7 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-wait` von frischem `develop`, nach dem Merge von Paket 11. Hotspot ansagen: `core/modules/types.ts`.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 7“; handoff/07-wait.md; COPY.md W1–W6. Bestand: ToDos `startDate` (blendet bis zu dem Tag aus), `onLater`/`listLater` als Muster.

## Pflichtliste
- Vertrag: `PlannableSource.onWait?(id, until | undefined)` und `listWaiting?()`; ToDos setzen `startDate`.
- Zeilen-⋯ W1 → Dialog W2 → eine Aktion, ein Undo (Tag, „fest“ und der `wait`-Link kommen zusammen zurück); gefaltete Zeile W3 unter „Nächste Wochen“; „Zurückholen“.
- Am Tag steht das Ding wieder unter „Noch ohne Tag“ mit Chip W5 – ohne dass an dem Tag etwas geschrieben wird (Schreib-Spion mit verstellter Uhr).
- Keine Benachrichtigung, kein Lesen von Mail, kein Zähler am Kopf.

## Nicht in diesem Paket
Erkennen einer Antwort, Erinnerungen, Warten für Rechnungen oder Listen, Mitglieder eines Bündels.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-wait.seed.spec.ts`; Mess-Skript D5: 3 Zeilen weniger auf dem Blatt, 3 Griffe zum Parken, 2 zum Zurückholen.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package M: measure after, close the round (`qa/planner-hub-2-remeasure`)

```
# Aufgabe: Planer-Zentrale 2, Paket M – nachmessen und die Runde schließen
Routing: Claude Code · Planer-Zentrale 2 Paket M · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `qa/planner-hub-2-remeasure` von frischem `develop`, nach dem letzten gebauten Paket.

## Pflichtliste
- `web/e2e/usecases/planner-hub-2.spec.ts`: jede Zahl gegen `TARGET` prüfen; wo eine Zahl ihr Ziel nicht erreicht, steht der Grund im PR und in ANALYSIS.md („measured after“-Tabelle), nichts wird gelockert.
- `npm run measure:stimulus` für Planer 1920 und 412: vorher/nachher gegen `web/e2e/stimulus-budget.json`.
- Arbeitsdokumente der Runde entfernen (PACKAGES*.md, handoff/, mockups/), README.md auf „gebaut“ stellen, Entscheidungen stehen in docs/decisions/plan-hub-2.md; Label `no-changelog`.

## Skills
`review-loop` (eine Runde), `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 8 (struck by principle 1): measured duration (`feat/plan-measure`) – only on the maintainer's explicit yes

```
# Aufgabe: Planer-Zentrale 2, Paket 8 – echte Dauer: „Los“ misst, ein neues gleiches Ding schlägt die gemessene Zeit vor
Routing: Claude Code · Planer-Zentrale 2 Paket 8 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-measure` von frischem `develop`, frühestens nach 5a. Hotspots ansagen: Dexie-Version / `schema.snapshot.json`.

## Ausgangslage
CONCEPT-ROWS.md „Idea 8“ (ganz; „The same thing“ ist die Regel); handoff/08-duration.md; COPY.md D1–D3. Frühere Entscheidung: nichts ändert eine Schätzung von selbst – das bleibt: nur ein **neues** Ding bekommt den Vorschlag als Startwert.

## Pflichtliste
- `planner_measure` (`key`, `minutes`, `on`), `db:bump`, Schema-Historie, `manifest.version`; aufgezeichnet in der Aktion „Erledigt“ / „Fertig · weiter“ einer Fokus-Runde (Pausen abgezogen; < 1 Min und > 8 h nicht), dort auch auf 5 je Schlüssel gekürzt.
- Schlüssel: stabile Quell-id vor Titel; Titel-Normalisierung = die von `pastePlan.ts`; kein unscharfer Treffer.
- Vorschlag: Median der letzten 5 bei ≥ 2, auf 5 gerundet, nur beim Anlegen ohne Minuten; Anzeige D1, Zeile D2 in „Dauer …“; Schalter und „Gemessene Zeiten löschen“ (D3).
- Ausschluss-Test: die Sammlung erreicht keinen Export, keinen Kopiertext, keine Daten-API, kein Assistenten-Schema, keine Diagnose.

## Nicht in diesem Paket
Zeiterfassung an- oder einschalten, bestehende Schätzungen ändern, Statistik-Ansichten, Vergleiche „geplant gegen gebraucht“.

## Abnahme
Tests der Übergabe; Mess-Skript C1: `learned` ja, `durationProposed` beim zweiten Mal = gemessen.

## Skills
`council` (Daten, Privatsphäre), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
