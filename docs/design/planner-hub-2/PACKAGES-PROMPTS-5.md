# Planner hub 2 – prompts, packages 11, M, the parked 5b and the struck 7 and 6

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 11: topic (`feat/plan-topic`)

```
# Aufgabe: Planer-Zentrale 2, Paket 11 – Thema als Klammer: Dinge aus mehreren Modulen zusammenhalten, den Planer auf ein Thema schrumpfen
Routing: Claude Code · Planer-Zentrale 2 Paket 11 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-topic` von frischem `develop`, nach dem Merge von Paket 9. Hotspots ansagen: Dexie-Version / `schema.snapshot.json`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT.md §0.1, §1.1 (`topic`); CONCEPT-INTAKE.md „Idea 11“ (mit „Why a topic and not a tag“); handoff/11-topic.md; COPY.md T1–T4, T6, T8–T12, K8, K9.

## Pflichtliste
- Sammlung `planner_topic` (`title` ≤ 60; Datensatz-id `t_<uuid>`, damit der Link-Schlüssel `planner:<Datensatz-id>` ist und `sweepPurged` ihn findet); `db:bump`, Schema-Historie, `manifest.version`; `planner`-`linkTarget` nur für Themen; Mitgliedschaft nur als `topic`-Link (Thema → Ding), geschrieben nur von der eigenen Aktion „Thema …“ (`addLink` in ihrer rückgängig machbaren Aktion), ein Thema je Ding (ein zweites ersetzt das erste im selben Undo). Der Link speichert das Ding selbst (`entityId` bei Vorkommens-Zeilen); der Filter trifft Zeilen nach der Präfix-Regel aus CONCEPT §1.2; „Thema …“ gibt es nur auf Zeilen, deren Modul verknüpfbar ist (`isLinkable`), und auf Termin-(Blocker-)Zeilen; nie auf Stapel- und Bündel-Zeilen. Wird `planner` hier (für Themen) verknüpfbar, bleibt „Bündeln …“ trotzdem für Zeilen der Art `pile` und `bundle` ausgeschlossen (Test). `sync.test.ts` um den `topic`-Fall (aus 10a hierher verschoben).
- Wähler (Dialog T2) aus Zeilen-⋯ und Auswahlleiste; der Planer liest keine ToDo-Tags. Nach dem ersten Gebrauch bietet das ⋯ einer Zeile das zuletzt benutzte Thema direkt als T12 „Thema: {Umzug}“ über T1 an (gerätelokal gemerkt, nicht synchronisiert).
- Filter aus dem Seiten-⋯ (T3): Zeile T4, Blatt, Band, „Noch ohne Tag“, „Noch offen“ zeigen nur Mitglieder; die Frei-Zeit des Tagesblatts zählt weiter den ganzen Tag; die Kopfzahl weicht T4. Ein Termin mit dem Thema bleibt als Blocker-Zeile sichtbar, Blocker ohne das Thema sind ausgeblendet. Filter ist Gerätezustand (`_meta`), schreibt nichts Synchronisiertes (Schreib-Spion).
- Neues im Feld bei aktivem Filter bekommt das Thema (Vor-Chip T11 mit ✕ vor der Eingabe, nach A2; über die eigene `addFromField` des Planers, nicht über den Bus; Regel aus Paket 3). Ein Ding, das bei aktivem Filter entsteht und T11 nicht annimmt (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste), endet im Toast mit K9 „Nicht im Thema „Umzug“ · Alles zeigen“ (beendet den Filter), damit es nicht wortlos verschwindet (Test); eine Aufgabe nur mit T11 bekommt K8. Nur eine einfache Aufgabe – auch eine mit Schritten – nimmt die Vor-Chips an (A2 → Link und Tag, T11 → Thema). Bei jeder anderen Art (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) werden die Chips durchgestrichen gezeichnet, solange K1 steht, und nicht angewendet. Gibt ein Chip den Tag, nennt K1 bzw. der Toast des Feldes diesen Tag.
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
- `web/e2e/usecases/planner-hub-2.spec.ts`: jede Zahl gegen `TARGET` und die Stufen in docs/design/planner-hub-2/FIGURES.md prüfen; wo eine Zahl ihr Ziel nicht erreicht, steht der Grund im PR und in ANALYSIS.md („measured after“-Tabelle), nichts wird gelockert. C2 heißt dort „nicht gebaut: 5b geparkt“ – kein verfehltes Ziel; sein `IST` bleibt, `TARGET` bleibt im Skript für den Tag, an dem 5b gebaut wird.
- `npm run measure:stimulus` für Planer 1920 und 412: vorher/nachher gegen `web/e2e/stimulus-budget.json`.
- Das Gestrichene und Geparkte bleibt: der geparkte Prompt 5b und die gestrichenen Prompts 7, 6 aus `PACKAGES-PROMPTS-5.md`, die Abschnitte „parked with 5b“ von `handoff/05-bundle.md` (als eigene Datei), `handoff/06-errand.md`, `07-wait.md`, `mockups/05-bundle-a.html` (wegen der geparkten 5b-Zustände), `06-errand.html`, `07-wait.html`, `mock.css`, `render.mjs` und `CONCEPT-STRUCK.md` wandern nach `docs/design/planner-hub-2/struck/`; dazu kommen Kopien des Blocks `#common` aus PACKAGES.md und von `handoff/00-common.md` nach `struck/` (die gestrichenen und geparkten Prompts zitieren sie), und deren Links zeigen auf diese Kopien. Paket 8 ist gebaut und bleibt nicht in `struck/`. Die übrigen Arbeitsdokumente der Runde werden gelöscht (PACKAGES*.md, die anderen Übergaben und Mockups); FIGURES.md bleibt, auf ihn zeigt der Kopf des Mess-Skripts; README.md auf „gebaut“ stellen, Entscheidungen stehen in docs/decisions/plan-hub-2.md; Label `no-changelog`.

## Skills
`review-loop` (eine Runde), `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 5b (parked by the figures – only on the maintainer's explicit yes; not before 5a): bundling things (`feat/plan-bundles`)

```
# Aufgabe: Planer-Zentrale 2, Paket 5b – mehrere Dinge zu einem Bündel: eine Zeile, ein Startpunkt, ein Undo
Routing: Claude Code · Planer-Zentrale 2 Paket 5b · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-bundles` von frischem `develop`, frühestens nach 5a; nur auf das ausdrückliche „ja“ des Maintainers (geparkt nach den Zahlen: eine Zeile und drei Arbeitsgriffe weniger gegen 14 / 13 Griffe einmal und einen Weg nach Listen). Hotspots ansagen: Dexie-Version / `schema.snapshot.json`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT.md §0.1; CONCEPT-ROWS.md „Idea 5“ (5b); handoff/05-bundle.md („5b: making and unmaking“, Zustände); COPY.md B2, B11–B18, B20, B21, B25, M5.

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

## Prompt – package 6 (struck by principle 1): places and map of an errand round (`feat/plan-errand`) – only on the maintainer's explicit yes

```
# Aufgabe: Planer-Zentrale 2, Paket 6 – Besorgungsrunde mit Orten: Stopps, „Ort …“, Sprung auf die Karte
Routing: Claude Code · Planer-Zentrale 2 Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-errand` von frischem `develop`, frühestens nach 5b (das selbst geparkt ist).

## Ausgangslage
Setzt 5b voraus (geparkt): die Runde als Bündel, die Liste im Bündel abhaken. Gestrichen und hier nachzuholen: CONCEPT-INTAKE.md „Idea 6“ (Abschnitt „Struck parts“); handoff/06-errand.md; COPY.md E1–E3.

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
