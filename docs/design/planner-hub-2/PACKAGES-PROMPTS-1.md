# Planner hub 2 – prompts, packages 10a to 4a

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 10a: the link contract grows (`feat/plan-link-contract`)

```
# Aufgabe: Planer-Zentrale 2, Paket 10a – der Link-Vertrag wächst: vier neue Beziehungen, fünf neue Link-Ziele, `links` auf den Anfrage-Ereignissen
Routing: Claude Code · Planer-Zentrale 2 Paket 10a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-link-contract` von frischem `develop`. Hotspots ansagen: `web/src/core/modules/types.ts`, `web/src/core/events/events.ts`.

## Ausgangslage
Konzept: docs/design/planner-hub-2/CONCEPT.md §0 und §1 (ganz). Bestand: `web/src/core/entitylinks/**`, docs/decisions/plan-links.md. Kein sichtbares Paket: keine neue Fläche, kein neues Wort.

## Pflichtliste
- `LinkRel` um `before`, `after`, `topic`, `place` (CONCEPT §1.1; `wait` gehört zur gestrichenen Idee 7 und kommt nicht dazu); `LINK_RELS`, `linkRel`, `types.test.ts`; unbekannte Werte lesen weiter als `about`.
- `plan.requested` und `todo.requested`: neues optionales `links?: { to: EntityRef; rel: LinkRel; label: string }[]` neben dem veralteten `link`. Der Handler schreibt dafür `_links`-Zeilen (`addLinksIfAbsent` im selben `undoable`), nie einen Eintrag in das eingefrorene `links[]` eines ToDos. Test: kein Kreis mit `migrate.ts`.
- `contributions.linkTarget` für `subscriptions`, `bookmarks`, `people`, `vault`, `routines` nach der Tabelle CONCEPT §1.3 (Titel-Spalte wörtlich): nur eigene Daten, kein Netz, fremde/kaputte id → `gone`, weich gelöscht → `gone`, `done` wo das Modul eins hat. Unterlagen: Titel und Link-Label sind das Kategorie-Wort, nie der Dokumenttitel – `vaultPlanPrivacy.test` um Links erweitern. Personen: Anzeigename; der Titel eines Geschenks nennt nie das Geschenk.
- `exclusion.test.ts` wächst: `accounts` bleibt für jede neue Beziehung und jedes neue Ziel ausgeschlossen; keine neue Zeile erreicht Daten-API, lokale API, Assistent, Suche, Diagnose.
- `sync.test.ts`: zwei Geräte fügen dieselbe `topic`-Zeile hinzu → eine Zeile; Entfernen gewinnt gegen späteres stilles Wieder-Hinzufügen.
- docs/decisions/plan-links.md: ein Bullet (Beziehungen, `links` am Ereignis, die fünf Ziele, Unterlagen-Regel).

## Nicht in diesem Paket
Die Marke „Im Plan“ in den Modulen (10b), `planner`- und `maps`-Ziele (5b/11, 6), jede sichtbare Änderung, neue Tabellen, `db:bump`.

## Abnahme
`npm run check`, `test`, `e2e` grün; `npx vitest run src/core/entitylinks src/modules/{subscriptions,bookmarks,people,vault,routines}`; Mess-Skript unverändert grün (`IST` bleibt).

## Skills
`council` (Vertrag; Architect: ein Vertrag, kein Modul importiert ein anderes, kein Kreis in der Kopie, zwei Geräte konvergieren; Guardian: kein Inhalt im Link, Unterlagen-Titel, `accounts`), `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 10b: „Im Plan · Mi“ everywhere (`feat/plan-mark-everywhere`)

```
# Aufgabe: Planer-Zentrale 2, Paket 10b – die Marke „Im Plan · Mi“ an jedem Ding, eine Quelle der Wahrheit
Routing: Claude Code · Planer-Zentrale 2 Paket 10b · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-mark-everywhere` von frischem `develop`, nach dem Merge von 10a. Hotspot: `web/src/strings.ts` (nur anhängen, je Modulblock).

## Ausgangslage
Konzept CONCEPT.md §1.2 (letzter Punkt), §1.3, §1.4; Übergabe handoff/10-mark.md und 00-common.md; Wörter COPY.md M1–M7 – wörtlich übernehmen, nicht neu gestalten.

## Pflichtliste
- `core/entitylinks/PlanMark.tsx` (Varianten `meta`, `detail`; Zustände der Übergabe); `todos/components/PlanMark.tsx` geht darin auf (Filter „Stand im Plan“ bleibt).
- Einbau je Modul nach der Tabelle „Where“ der Übergabe (elf Module); Ziel `/planner?item=<key>`.
- Merkliste und Abos lesen den Stand über `planRowState`; `inPlan` und `plannedDeadline` bleiben gespeichert, werden nicht mehr geschrieben; ein einmaliger Schritt je Gerät macht aus gesetzten Feldern eine Planer-Anfrage (`requestIntoPlan`, nur wenn keine da ist) – der einzige Schreibvorgang ohne Tipp, läuft genau einmal (Merker in `_meta`), mit Test.
- „In den Plan“ / „Nicht mehr planen“ (M7) im ⋯ von Kalender-Terminen über `usePlanRowEntries`.
- `npm run check:stimulus`: bricht eine Modulansicht ihr Budget, wandert die Marke dort nur ins Detail (im PR nennen).

## Nicht in diesem Paket
Neue Planquellen, ein Link-Editor, Bündel-Name in der Marke (M5 kommt mit 5b: Vorkehrung als Prop, nichts anzeigen), Thema.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-mark.seed.spec.ts` neu; Mess-Skript D1 neu gemessen: `markVisible` 1 → 5, `markAgrees` 2 → 5. Screenshots 1920 und 412 von drei Modulen im PR.

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
Konzept CONCEPT-ROWS.md „Idea 4“; Entscheidung Richtung A in DESIGN.md §2; Übergabe handoff/04-expand.md und 00-common.md; Wörter COPY.md X1–X8, X13, X14; Tastatur A11Y.md.

## Pflichtliste
- Vertrag `contributions.planPanel` + `PlanPanelProps` (CONCEPT-ROWS; `compact` = die Ein-Zeilen-Form für Mitglieder in Stapel und Bündel) in `core/modules/types.ts`; `core/modules/PlanPanelHost.tsx` (lazy, Fehlergrenze, Standard-Panel, nie für `accounts`, Modul aus → X5).
- `RowCompartment`, `PanelLine` (additiv in `@/ui`), Titel als Knopf mit `aria-expanded` statt Link (Zahl der bedienbaren Elemente je Zeile bleibt gleich), eins offen zur Zeit (`useOpenRow`), Esc, Fokus-Rückgabe; in „Auswählen“ klappt nichts auf.
- Panels: Standard, ToDos (Notiz, Checkliste), Listen (offene Einträge, 8 + „n weitere“, „Fertig eingekauft“), Merkliste. Jedes schreibt nur im eigenen Modul mit dessen eigenem Undo-Toast.
- Schreib-Spion: Auf- und Zuklappen schreibt nirgends; der Planer schreibt bei einem Panel-Tipp nichts.
- `copyInput`-Test: Panel-Inhalt steht nie in „Plan als Text kopieren“.
- docs/decisions/plan-hub.md: ein Bullet (Titel klappt auf, „Ganz öffnen“ ist der alte Sprung; der Planer schreibt weiter nichts in fremde Module).

## Nicht in diesem Paket
Rechnungen, Abos (4b), E-Mail (4c), Stapel (2), Schritte und „Los“ (5a), Kalender-Panel (9), Aufklappen im Wochenband, im 4-Wochen-Raster oder im Widget.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-expand.seed.spec.ts` neu (zwei Listen-Einträge und eine Checklisten-Zeile abhaken, ohne `/planner` zu verlassen); `check:stimulus` unverändert; kopf-leer-Skript grün; Mess-Skript C2 neu gemessen (die Liste lässt sich im Plan abhaken: ein Modulwechsel weniger).

## Skills
`council` (Manifest-Vertrag, docs/PROMPT-TEMPLATES.md#review), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
