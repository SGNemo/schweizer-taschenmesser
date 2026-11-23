# Planner hub 2 – prompts, packages 10a to 4a

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 10a: the link contract grows (`feat/plan-link-contract`)

```
# Aufgabe: Planer-Zentrale 2, Paket 10a – der Link-Vertrag wächst: drei neue Beziehungen, vier neue Link-Ziele; `plan.requested` bekommt `links?`, `day?`, `note?`, `origin?`, `answer?`, `PlannableItem` bekommt `entityId?`, `todo.requested` nur `links?`
Routing: Claude Code · Planer-Zentrale 2 Paket 10a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-link-contract` von frischem `develop`. Hotspots ansagen: `web/src/core/modules/types.ts`, `web/src/core/events/events.ts`.

## Ausgangslage
Konzept: docs/design/planner-hub-2/CONCEPT.md §0 und §1 (ganz). Bestand: `web/src/core/entitylinks/**`, `web/src/modules/planner/actions.ts` (`addRequested`, `placeRequested`, `placeMany`), docs/decisions/plan-links.md (lesen). Kein sichtbares Paket: keine neue Fläche, kein neues Wort.

## Pflichtliste
- `LinkRel` um `before`, `after`, `topic` (CONCEPT §1.1; `wait` und `place` gehören zu Gestrichenem und kommen nicht dazu); `LINK_RELS`, `linkRel`, `types.test.ts`; unbekannte Werte lesen weiter als `about`.
- Die vollständige Liste (sechs Zusätze, CONCEPT §1.2): `plan.requested` bekommt `links?`, `day?` (auch auf Titel- und `ref`-Weg), `note?`, `origin?: 'share'`, `answer?`; `PlannableItem` bekommt `entityId?`. `todo.requested` bekommt nur `links?`.
- `links?: { to: EntityRef; rel: LinkRel; label: string }[]` neben dem veralteten `link`. Der Handler prüft sie **vor** Beginn der Aktion mit `toRow` (ein abgelehntes Ende – `accounts`, kein Link-Ziel, es selbst – wird übersprungen, nie in der Aktion geworfen; Test: ein schlechter Link unter fünf ergibt genau einen Undo-Eintrag) und schreibt `_links`-Zeilen mit `addLink` im selben `undoable` – höchstens 5, das Label eines Unterlagen-Ziels kommt aus dessen eigenem `resolveLink`-Titel, nie vom Aufrufer – und nie einen Eintrag in das eingefrorene `links[]` eines ToDos. `rel` wird über `linkRel` gelesen (unbekannt → `about`); über den Bus gelten nur `origin | about | before | after` – `topic` und `dunning` werden wie ein abgelehntes Ende übersprungen (Test; `topic` schreibt nur die eigene Aktion „Thema …“ des Planers, Paket 11). Test: kein Kreis mit `migrate.ts`.
- `plan.requested.day?: string | null` gilt auf jedem Weg, auch dem Titel-Weg und dem `ref`-Weg (heute nur mit `refs`): ein gültiges Datum `>= today()` = dorthin (dieselbe Prüfung wie `placeMany`), jede andere Zeichenkette = heute (Test), `null` = „ohne Tag“ (keine Zuweisung), fehlt = heute wie bisher. `requestIntoPlan` bekommt `day`. `plan.requested.note?: string` (≤ 4 000; der Handler reicht es an das Erfassungsziel). `plan.requested.origin?: 'share'` (nur Typ und Durchreichen; den Toast dazu baut Paket 1). `plan.requested.answer?: (r: { ok: boolean; key?: string; undo?: () => Promise<void> }) => void` (Muster `pantry.needsRequested`): der Handler ruft es in jedem Fall, auch bei Fehlschlag; `key` ist der Schlüssel der Zeile, `undo` macht genau diesen Eintrag rückgängig (`undoEntry`). Test: Antwort bei Erfolg und bei Fehlschlag.
- `PlannableItem.entityId?: string`: Quellen, deren Zeilen Vorkommen sind (Abos, Unterlagen, Routinen), nennen das Ding dahinter; Links von oder zu so einer Zeile speichern dieses Ding.
- `contributions.linkTarget` für `subscriptions`, `bookmarks`, `vault`, `routines` nach der Tabelle CONCEPT §1.3 (Titel-Spalte wörtlich): nur eigene Daten, kein Netz, fremde/kaputte id → `gone`, weich gelöscht → `gone`, `done` wo das Modul eins hat; aufgelöst wird die id des Dings (Abo, Dokument, Routine), nicht der Vorkommens-Schlüssel. Unterlagen: Titel ist das Kategorie-Wort, nie der Dokumenttitel und nie `detail` (das ist der Dokumentname) – `modules/vault/__tests__/vault.plannable.test.ts` um Links erweitern.
- `exclusion.test.ts` wächst: `accounts` bleibt für jede neue Beziehung und jedes neue Ziel ausgeschlossen; keine neue Zeile erreicht Daten-API, lokale API, Assistent, Suche, Automationen, Teilen-Datei (`_links` ist `core`, also `NEVER_SHARED`), Diagnose. Schreib-Spion: der Handler schreibt nur Planer-Sammlungen, `_links` (über `addLink` / `removeLink`) und den eigenen Einstellungs-Datensatz.
- `sync.test.ts`: zwei Geräte fügen dieselbe `before`-Zeile zwischen zwei heute schon verknüpfbaren Enden hinzu → eine Zeile; Entfernen gewinnt gegen späteres stilles Wieder-Hinzufügen. (Der `topic`-Fall kommt mit Paket 11: `planner` ist erst dort ein Link-Ziel.)
- docs/decisions/plan-hub-2.md: ein Bullet (Beziehungen, die sechs Zusätze am Ereignis und an `PlannableItem`, welche `rel` der Bus annimmt, die `day`-Prüfung, die vier Ziele, Unterlagen-Regel).

## Nicht in diesem Paket
Die Marke „Im Plan“ in den Modulen (10b), das `planner`-Ziel (11), Personen (in dieser Runde nicht verknüpfbar) und Orte (gestrichen) als Ziele, jede sichtbare Änderung, neue Tabellen, `db:bump`, jede Migration.

## Abnahme
`npm run check`, `test`, `e2e` grün; `npx vitest run src/core/entitylinks src/modules/planner src/modules/{subscriptions,bookmarks,vault,routines}`; Mess-Skript unverändert grün: dieses Paket bewegt keine Zahl (`IST` bleibt), es ist die Grundlage von 10b, 4, 9, 11, 1, 3.

## Skills
`council` (Vertrag; Architect: ein Vertrag, kein Modul importiert ein anderes, kein Kreis in der Kopie, zwei Geräte konvergieren; Guardian: kein Inhalt im Link, Unterlagen-Titel, `accounts`), `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 10b: „Im Plan · Mi“ everywhere (`feat/plan-mark-everywhere`)

```
# Aufgabe: Planer-Zentrale 2, Paket 10b – die Marke „Im Plan · Mi“ an jedem Ding, gelesen aus dem Plan
Routing: Claude Code · Planer-Zentrale 2 Paket 10b · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-mark-everywhere` von frischem `develop`, nach dem Merge von 10a. Hotspot: `web/src/strings.ts` (nur anhängen, je Modulblock).

## Ausgangslage
Konzept CONCEPT.md §1.2 (die Punkte „Occurrence keys“ und „Bookmarks and subscriptions“), §1.3, §1.4; Übergabe handoff/10-mark.md und 00-common.md; Wörter COPY.md M1–M7 – wörtlich übernehmen, nicht neu gestalten (M6 beginnt mit dem sichtbaren Text: „Im Plan · Mi – Mittwoch, 2. Dezember. Im Planer zeigen“).

## Pflichtliste
- `core/entitylinks/PlanMark.tsx` (Varianten `meta`, `detail`; Zustände der Übergabe); `todos/components/PlanMark.tsx` geht darin auf (Filter „Stand im Plan“ bleibt).
- Zwei neue Lesarten in `planRow.ts` / `plannedDay`, dieselbe Präfix- und Träger-Lesart in `planFacts` (Sperre → M2): ein Planschlüssel gehört zum Ding, wenn er `<module>:<id>` ist **oder mit `<module>:<id>:` beginnt** (Abos, Routinen, Unterlagen planen je Vorkommen); für M4 die späteste lebende Zuweisung vor heute, wenn ab heute keine liegt. Der Tag eines Dings, das selbst keine Planzeile ist, kommt nur von ToDos, die mit `origin` oder `about` darauf zeigen – nie `before`, `after`, `topic`. Tests: `todos:ab` trifft nie `todos:abc`; eine Vorbereitung am Vortag verschiebt die Marke des Termins nicht.
- Einbau je Modul nach der Tabelle „Where“ der Übergabe (zehn Module). Ziel ist **die Planzeile, die getroffen wurde** (`rowKey` = Vorkommens-Schlüssel, Schlüssel des Träger-ToDos oder des Bündels): M1 / M2 / M5 `/planner?day=<d>&item=<rowKey>`, M4 `/planner?tab=open&item=<rowKey>`, M3 `/planner?item=<rowKey>` (der Planer klappt „Noch ohne Tag“ auf und fokussiert die Zeile). `?item=` trifft `data-row-key` genau auf dem gezeigten Blatt und wählt keinen Tag – darum steht der Tag in der URL, wie in `todos/planState.ts`. Tests: ein am Mittwoch gelegtes Abo, eine Notiz über ihr ToDo, (ab 5b) ein Bündel-Mitglied – jedes landet auf seiner Zeile.
- Merkliste und Abos: ihre Felder `inPlan` / `plannedDeadline` bleiben, was sie sind (die Anfrage des Moduls an den Plan, von der Quelle gelesen, von älteren Apps gelesen) – **keine Migration, kein Schreiben beim Start**. Nur ihr eigener Text „im Plan“ weicht der Marke; sie bekommt das Feld als `fallback` (M3), solange der Planer noch keine Zeile hat. Schreib-Spion: App-Start und das Zeichnen von Marken schreiben nichts.
- `npm run check:stimulus`: bricht eine Modulansicht ihr Budget, wandert die Marke dort nur ins Detail (im PR nennen).

## Nicht in diesem Paket
Neue Planquellen, „In den Plan“ für Kalender-Termine (ein Termin ist ein Blocker seines Tages), ein Link-Editor, Bündel-Name in der Marke (M5 kommt mit 5b: Vorkehrung als Prop, nichts anzeigen), Thema.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-mark.seed.spec.ts` neu; Mess-Skript D1 neu gemessen: `markVisible` 1 → 5, `markAgrees` 2 → 5, `tripsToPlanner` 8 → 0; `taps` 11, `perThing` 5, `moduleSwitches` 10 bleiben. Screenshots 1920 und 412 von drei Modulen im PR.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 4a: the row opens (`feat/plan-row-expand`)

```
# Aufgabe: Planer-Zentrale 2, Paket 4a – Aufklappen statt hinspringen: das Fach unter der Zeile, der Panel-Vertrag, die ersten vier Panels
Routing: Claude Code · Planer-Zentrale 2 Paket 4a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-row-expand` von frischem `develop`, nach dem Merge von 10b. Hotspots ansagen: `web/src/core/modules/types.ts`, `planner/routes/PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
Konzept CONCEPT-ROWS.md „Idea 4“; Entscheidung Richtung A in DESIGN.md §2 (vom Maintainer bestätigt 2026-11-23); Übergabe handoff/04-expand.md und 00-common.md; Wörter COPY.md X1–X8, X13–X15; Tastatur A11Y.md.

## Pflichtliste
- Vertrag `contributions.planPageFoot` (ein Streifen am Fuß der Planer-Seite, einmal über den Kern eingehängt; erster Nutzer ist Paket 4c) und `contributions.planPanel` + `PlanPanelProps` (CONCEPT-ROWS; `compact` = die Ein-Zeilen-Form für Mitglieder in Stapel und Bündel) in `core/modules/types.ts`; `core/modules/PlanPanelHost.tsx` (lazy, Fehlergrenze – sie protokolliert nur Modul-id und Fehlername, nie die Meldung –, Standard-Panel, nie für `accounts`, Modul aus → X5). Schalter X15 „Zeilen aufklappen“ in den Planer-Einstellungen (an; aus = der Titel öffnet wie heute).
- `RowCompartment`, `PanelLine` (additiv in `@/ui`), Titel als Knopf mit `aria-expanded` statt Link (Zahl der bedienbaren Elemente je Zeile bleibt gleich), eins offen zur Zeit (`useOpenRow`), Esc, Fokus-Rückgabe; in „Auswählen“ klappt nichts auf.
- Panels: Standard, ToDos (Notiz, Checkliste), Listen (offene Einträge, 8 + „n weitere“, „Fertig eingekauft“), Merkliste („Im Browser öffnen“; kein eigenes „Erledigt“ – das ist der Haken der Zeile). Fuß-Regel aus 00-common: alle Aktionen im Fuß, höchstens drei, „Ganz öffnen“ rechts. Jedes schreibt nur im eigenen Modul mit dessen eigenem Undo-Toast.
- Schreib-Spion: Auf- und Zuklappen schreibt nirgends; der Planer schreibt bei einem Panel-Tipp nichts.
- `copyInput`-Test: Panel-Inhalt steht nie in „Plan als Text kopieren“.
- docs/decisions/plan-hub-2.md: ein Bullet (Titel klappt auf, „Ganz öffnen“ ist der alte Sprung; der Planer schreibt weiter nichts in fremde Module).

## Nicht in diesem Paket
Rechnungen, Abos (4b), E-Mail (4c), Stapel (2), Schritte und „Los“ (5a), Kalender-Panel (9), Aufklappen im Wochenband, im 4-Wochen-Raster oder im Widget.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-expand.seed.spec.ts` neu (zwei Listen-Einträge und eine Checklisten-Zeile abhaken, ohne `/planner` zu verlassen); `check:stimulus` unverändert; kopf-leer-Skript grün. Mess-Skript: dieses Paket ist der Rahmen für 4b, 4c, 2 und senkt selbst keine Zahl; der Sprung aus einer Zeile ins Modul kostet jetzt einen Griff mehr (aufklappen, „Ganz öffnen“) – das sind die im Skript-Kopf benannten Preise (neu messen, nicht darüber): D1 `taps` 11 → 15, `perThing` 5 → 9 (dauerhaft; `moduleSwitches` 10, Marken-Zahlen aus 10b bleiben); C1 `perThing` 6 → 7 (dauerhaft), `workTaps` 7 → 8 und `taps` 19 → 20 (`PRICE` bis 5a „Los“ bringt), `createTaps` 12 und `moduleSwitches` 4 / 5 bleiben.

## Skills
`council` (Manifest-Vertrag, docs/PROMPT-TEMPLATES.md#review), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
