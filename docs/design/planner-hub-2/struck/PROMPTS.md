# Planner hub 2 – parked and struck prompts

Kept when the round closed (package M, 2026-11-26): 5b is parked (build only on the maintainer's explicit yes, not before 5a – 5a is built), 7 and 6 are struck by principle 1. Paths in the prompts are from the repository root; the shared block they cite is [common](common.md), the hand-off rules [00-common](00-common.md).

## Prompt – package 5b (parked by the figures – only on the maintainer's explicit yes; not before 5a): bundling things (`feat/plan-bundles`)

```
# Aufgabe: Planer-Zentrale 2, Paket 5b – mehrere Dinge zu einem Bündel: eine Zeile, ein Startpunkt, ein Undo
Routing: Claude Code · Planer-Zentrale 2 Paket 5b · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/struck/common.md
Branch `feat/plan-bundles` von frischem `develop`, frühestens nach 5a; nur auf das ausdrückliche „ja“ des Maintainers (geparkt nach den Zahlen: eine Zeile und drei Arbeitsgriffe weniger gegen 14 / 13 Griffe einmal und einen Weg nach Listen). Hotspots ansagen: Dexie-Version / `schema.snapshot.json`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT.md §0.1; CONCEPT-ROWS.md „Idea 5“ (5b); struck/05-bundle-parked.md („5b: making and unmaking“, Zustände); COPY.md B2, B11–B18, B20, B21, B25, M5.

## Pflichtliste
- Daten: Sammlung `planner_bundle` (`title`; Datensatz-id `b_<uuid>`), Felder `bundle`, `step` auf `planner_item`; `npm run db:bump`, vorherige Stores nach `core/db/schema-history.json`, `manifest.version` + leerer Migrationsschritt; `dataApi: false` bleibt für das ganze Modul.
- Die eigene Quelle des Planers (`planner/plannable.ts` aus Paket 2) listet Bündel (Art `bundle`, Schlüssel `planner:<Datensatz-id>`) und liefert nur den Titel des Bündels und die Schlüssel seiner Mitglieder in Reihenfolge – das Blatt, das die Einträge aller Quellen schon hält, fügt Titel, Minuten und Erledigt-Stand hinzu; ein Mitglied, das keine Quelle mehr listet, ist erledigt oder weg, unterschieden über `resolveLink` (`done` / `gone`); die eigene Quelle ruft nie den Sammler; ein gebündeltes Ding ist nie Mitglied eines Stapels (Test); ein Mitglied mit `bundle` steht nicht selbst auf dem Blatt, solange das Bündel lebt, fehlt in den Eingaben des Laufs und in jedem Vorschlag (seine Minuten zählen einmal, in der Summe des Bündels) und gilt als geplant am Tag des Bündels (`plannedDay`, Plan-Stand in ToDos, Marke M5) – Tests für alle drei. Solange das Bündel lebt, werden eigene Zuweisungs-Zeilen eines Mitglieds von Blatt, Lauf, Vorschlägen und `plannedDay` übergangen: das Bündel gewinnt. Kein Link-Ziel für Bündel (Mitgliedschaft ist kein Link).
- „Alle Schritte erledigt“ ist abgeleitet (gezeichnet wie erledigt), nie geschrieben; Schreib-Spion: ein Mitglied, das in seinem Modul erledigt oder gelöscht wird, schreibt nichts in Planer-Tabellen.
- Besorgungsrunde (Idee 6, hier eingebaut): ein Mitglied, das eine Liste ist, zeigt im Panel des Bündels seine offenen Einträge als Haken-Zeilen (Körper des Listen-Panels aus 4a); in „Los“ ist die Liste ein Schritt mit diesen Zeilen.
- „Bündeln …“ nur für Zeilen verknüpfbarer Module (dieselbe Regel wie „Thema …“) und nie für eine Zeile der Art `pile` oder `bundle` (keine Verschachtelung; Test); Dialog B12 belegt den Namen nur aus einem Mitglied vor, das eine einfache Aufgabe ist (das erste in der Auswahl), sonst ist das Feld leer und „Bündeln“ wartet auf einen getippten Namen (Test: ein Mail-ToDo zuerst → leeres Feld); ein Mitglied wird über seine `entityId` aufgelöst, sonst über seine Item-id – ein Mitglied eines nicht verknüpfbaren Moduls kann es nicht geben (Test).
- Aktionen, je genau ein Undo-Eintrag: „Bündeln …“ (Auswahlleiste, Dialog B12), „Auflösen“, „Aus dem Bündel nehmen“, „Umbenennen …“, Sortieren. Die Regel-Tests von planner-rethink CONCEPT-MIGRATION §7 um diese Aktionen erweitern (Schnappschuss aller Planer-Zeilen vor/nach jedem Undo).
- „Los“ über Mitglieder (ein Mitglied ohne Haken zeigt sein Panel als Schritt; nach dem letzten Mitglied dieselbe Rückkehr in den Plan, nichts abzuhaken); „Als Routine speichern“ nur, wenn alle Mitglieder einfache Aufgaben sind (ToDos ohne alten `links[]`-Eintrag und ohne `origin`-Link-Zeile: der Titel eines Mail-ToDos ist der Betreff und darf nicht in Routinen wandern; Test mit einem Mail-ToDo, das `links[]` hat, aber keine `_links`-Zeile), mit Nachschlagen, Senden und Toasts B16 / B25 / X7 wie in 5a, nur solange Routinen an ist.
- `PlanMark` zeigt M5 für Mitglieder.
- Zwei Geräte: `bundle`/`step` konvergieren feldweise (Test in der Art von `core/entitylinks/sync.test.ts`); Gerät A bündelt X, während Gerät B X auf Donnerstag legt → X ist im Bündel und steht am Tag des Bündels, „Auflösen“ legt es auf den Tag des Bündels (Sync-Test); ein Bündel löschen löscht kein Mitglied.

## Nicht in diesem Paket
Orte und Karte (gestrichen), Thema (11), Bündel in Bündeln, ein automatischer Vorschlag zu bündeln.

## Abnahme
Tests der Übergabe (5b); `e2e/seed/plan-bundle.seed.spec.ts`; Mess-Skript C2: `rows` 2 → 1, `oneRow` ja, `workTaps` 9 / 8 → 6; gemessen `createTaps` 14 (Handy 13) und `perThing` 7 – im Skript-Kopf benannte Preise, dauerhaft; `IST` bleibt 0 / 5 (darin der eine Weg nach Listen für „In den Plan“: eine Einkaufsliste ist nur auf Anfrage eine Planzeile, docs/decisions/plan-sources.md – das bleibt so; `moduleSwitches` bleiben 2). Lesart des Skripts ändern: `rows` nach dem Anlegen des Bündels lesen (wie C1 `created` liest) und `oneRow` aus diesem Ergebnis (eine Zeile hält die Runde); das ⋯ der Zeile bietet nie „Bündeln …“. Dünn nach den Zahlen: vor dem Start entscheiden, ob es das wert ist. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

## Skills
`council` (Daten, Migration, zwei Geräte), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 7 (struck by principle 1): „Warte auf Antwort“ (`feat/plan-wait`) – only on the maintainer's explicit yes

```
# Aufgabe: Planer-Zentrale 2, Paket 7 – „Warte auf Antwort“: eine Zeile verschwindet bis zu einem Tag und kommt mit Person oder Mail wieder
Routing: Claude Code · Planer-Zentrale 2 Paket 7 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/struck/common.md
Branch `feat/plan-wait` von frischem `develop`, frühestens nach Paket 11. Hotspot ansagen: `core/modules/types.ts`.

## Ausgangslage
struck/CONCEPT-STRUCK.md „Idea 7“; struck/07-wait.md; COPY.md W1–W6. Bestand: ToDos `startDate` (blendet bis zu dem Tag aus), `onLater`/`listLater` als Muster.

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

## Prompt – package 6 (struck by principle 1): places and map of an errand round (`feat/plan-errand`) – only on the maintainer's explicit yes

```
# Aufgabe: Planer-Zentrale 2, Paket 6 – Besorgungsrunde mit Orten: Stopps, „Ort …“, Sprung auf die Karte
Routing: Claude Code · Planer-Zentrale 2 Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/struck/common.md
Branch `feat/plan-errand` von frischem `develop`, frühestens nach 5b (das selbst geparkt ist).

## Ausgangslage
Setzt 5b voraus (geparkt): die Runde als Bündel, die Liste im Bündel abhaken. Gestrichen und hier nachzuholen: CONCEPT-INTAKE.md „Idea 6“ (Abschnitt „Struck parts“); struck/06-errand.md; COPY.md E1–E3.

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
