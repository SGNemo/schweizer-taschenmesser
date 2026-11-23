# Planner hub 2 – prompts, packages 5a to 1

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 5a: steps and „Los“ (`feat/plan-steps`)

```
# Aufgabe: Planer-Zentrale 2, Paket 5a – ein Ding mit Schritten ist eine Zeile; „Los“ zeigt nur den nächsten Schritt
Routing: Claude Code · Planer-Zentrale 2 Paket 5a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-steps` von frischem `develop`, nach dem Merge von Paket 2. Hotspots ansagen: `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT-ROWS.md „Idea 5“ (5a); Entscheidung Richtung A in DESIGN.md §3; handoff/05-bundle.md (Abschnitte „Closed row“, „Expanded“, „Los“); COPY.md B1, B3–B10, B14 (nur „Als Routine speichern“), B16, B19, B22, B23; A11Y.md („Los“).

## Pflichtliste
- Vertrag: `PlannableItem.steps?` und `PlannableSource.onStepDone?` (nur Anzeige und „Los“, nie im Eingabe-Hash – Test nach dem Muster `linksDisplayOnly`).
- Quellen: ToDos (Checkliste), Listen (offene Einträge), Routinen (Schritte des heutigen Laufs).
- Zeile: Meta B1; Schritte-Panel über `PlanPanelHost` (ToDos- und Listen-Panel aus 4a bekommen den Fuß „Los“ · ⋯ · „Ganz öffnen“; Routinen ein eigenes).
- „Los“: `FocusPage` im Schritt-Modus (`?step=1`) genau nach der Tabelle der Übergabe – kein Ring, keine Liste der übrigen Schritte, Uhr zählt hoch und folgt „Uhr ausblenden“; überlebt Neuladen; Tasten Enter, S, P, Esc – die Buchstaben nur, solange der Fokus in keinem Textfeld steht. Die Startzeile „Anfangen mit … · Fokus starten“ von „Tag kippt“ bleibt unverändert; ist ihr Ding eins mit Schritten, führt sie in den Schritt-Modus.
- „Als Routine speichern“ sendet das vorhandene `routine.requested`; Toast B16.
- Im Feld: „Name: a, b, c“ wird erst mit Paket 3 erkannt – hier nicht.

## Nicht in diesem Paket
Bündel aus mehreren Dingen (5b), Besorgungen (6), Dauer messen (8, gestrichen), Schritt-Dauern, Verschachtelung.

## Abnahme
Tests der Übergabe (5a); Mess-Skript C1 neu gemessen mit einem ToDo samt Checkliste: Modulwechsel beim Durcharbeiten 0, `workTaps` 7 (Zeile öffnen, „Los“, fünf Schritte – der letzte Knopf B23 „Fertig“ hakt das Ding mit ab), `nextStepOnly` ja, `savedAsRoutine` ja über ⋯ im Panel (`createTaps` 1 erst mit Paket 3); kopf-leer- und tag-kippt-Skript grün.

## Skills
`council` (Manifest-Vertrag), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 5b: bundling things (`feat/plan-bundles`)

```
# Aufgabe: Planer-Zentrale 2, Paket 5b – mehrere Dinge zu einem Bündel: eine Zeile, ein Startpunkt, ein Undo
Routing: Claude Code · Planer-Zentrale 2 Paket 5b · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-bundles` von frischem `develop`, nach dem Merge von 5a. Hotspots ansagen: Dexie-Version / `schema.snapshot.json`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT.md §0.1; CONCEPT-ROWS.md „Idea 5“ (5b); handoff/05-bundle.md („5b: making and unmaking“, Zustände); COPY.md B2, B11–B15, B17, B18, B20, B21, M5.

## Pflichtliste
- Daten: Sammlung `planner_bundle` (`title`; Datensatz-id `b_<uuid>`), Felder `bundle`, `step` auf `planner_item`; `npm run db:bump`, vorherige Stores nach `core/db/schema-history.json`, `manifest.version` + leerer Migrationsschritt; `dataApi: false` bleibt für das ganze Modul.
- Die eigene Quelle des Planers (`planner/plannable.ts` aus Paket 2) listet Bündel (Art `bundle`, Schlüssel `planner:<Datensatz-id>`, `steps` = Mitglieder in Reihenfolge); ein Mitglied mit `bundle` steht nicht selbst auf dem Blatt, solange das Bündel lebt, fehlt in den Eingaben des Laufs und in jedem Vorschlag (seine Minuten zählen einmal, in der Summe des Bündels) und gilt als geplant am Tag des Bündels (`plannedDay`, Plan-Stand in ToDos, Marke M5) – Tests für alle drei. Kein Link-Ziel für Bündel (Mitgliedschaft ist kein Link).
- „Alle Schritte erledigt“ ist abgeleitet (gezeichnet wie erledigt), nie geschrieben; Schreib-Spion: ein Mitglied, das in seinem Modul erledigt oder gelöscht wird, schreibt nichts in Planer-Tabellen.
- Besorgungsrunde (Idee 6, hier eingebaut): ein Mitglied, das eine Liste ist, zeigt im Panel des Bündels seine offenen Einträge als Haken-Zeilen (Körper des Listen-Panels aus 4a); in „Los“ ist die Liste ein Schritt mit diesen Zeilen.
- Aktionen, je genau ein Undo-Eintrag: „Bündeln …“ (Auswahlleiste, Dialog B12), „Auflösen“, „Aus dem Bündel nehmen“, „Umbenennen …“, Sortieren. Die Regel-Tests von planner-rethink CONCEPT-MIGRATION §7 um diese Aktionen erweitern (Schnappschuss aller Planer-Zeilen vor/nach jedem Undo).
- „Los“ über Mitglieder (ein Mitglied ohne Haken zeigt sein Panel als Schritt); „Als Routine speichern“ nur, wenn alle Mitglieder einfache Aufgaben sind (ToDos ohne `origin`-Link: der Titel eines Mail-ToDos ist der Betreff und darf nicht in Routinen wandern).
- `PlanMark` zeigt M5 für Mitglieder.
- Zwei Geräte: `bundle`/`step` konvergieren feldweise (Test in der Art von `core/entitylinks/sync.test.ts`); ein Bündel löschen löscht kein Mitglied.

## Nicht in diesem Paket
Orte und Karte (gestrichen), Thema (11), Bündel in Bündeln, ein automatischer Vorschlag zu bündeln.

## Abnahme
Tests der Übergabe (5b); `e2e/seed/plan-bundle.seed.spec.ts`; Mess-Skript C2: Zeilen 2 → 1, `oneRow` ja, `workTaps` 9 / 8 → 6; `createTaps` 0 → 8 ist ein im Skript-Kopf benannter Preis (darin der eine Weg nach Listen für „In den Plan“: eine Einkaufsliste ist nur auf Anfrage eine Planzeile, docs/decisions/plan-sources.md – das bleibt so; die Modulwechsel bleiben beim ersten Mal 2).

## Skills
`council` (Daten, Migration, zwei Geräte), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 1: share into the planner (`feat/share-planner`)

```
# Aufgabe: Planer-Zentrale 2, Paket 1 – Teilen → Planer: geteilter Text oder Link liegt mit einem Tipp unter „Noch ohne Tag“
Routing: Claude Code · Planer-Zentrale 2 Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/share-planner` von frischem `develop`, nach dem Merge von 5b (teilt `planner/actions.ts` und den Planer-Block von `strings.ts` mit 5b: nicht parallel).

## Ausgangslage
CONCEPT-INTAKE.md „Idea 1“ (ganz, mit dem Abschnitt gegen docs/security/LAUNCH-REVIEW-2026-11.md); handoff/01-share.md; COPY.md S1–S10. Bestand: `web/src/pages/ShareTarget.tsx`, `web/src/quickCapture/nativeShare.ts`, `web/src-tauri/plugins/share-intent/**`.

## Pflichtliste
- Ziel „In den Planer“ als erste, vorgewählte Wahl (nur bei eingeschaltetem Planer); Tageswahl „ohne Tag · Heute · Morgen“; „Ablegen“ → `plan.requested` mit `note` (Rest des Textes; bei einem Link die URL als erste Zeile), `day` (`null` bzw. der Tag) und `origin: 'share'` (alles seit 10a). Den Toast S4 mit „Ansehen“ (`/planner?item=`) und „Rückgängig“ sagt der Handler des Planers – kein zweiter Toast von der Seite. Ob gespeichert wurde, erfährt die Seite über `answer` (seit 10a): `ok` → S8, sonst (oder keine Antwort nach 3 s) S6.
- docs/security/LAUNCH-REVIEW-2026-11.md, Zeile B9: aus „nur vorbefüllen“ wird „gespeichert wird nur auf den Tipp ‚Ablegen‘ unter einer Karte, die genau zeigt, was gespeichert wird“ – eine Zeile, im PR benannt.
- Die Seite zeigt danach S8 „Abgelegt.“ mit dem einen Knopf S9 „Fertig“ und bleibt, bis er tippt – „Rückgängig“ ist das des Toasts (S2 und S4 haben je eine Fassung mit Tag) („Fertig“: Android zurück in die teilende App, PWA öffnet den Planer). Kein Schließen nach Zeit.
- Titel: erste Zeile, ≤ 160, Steuer- und Bidi-Zeichen entfernt (bei einem Titel aus einer URL erst nach dem Prozent-Dekodieren); Rest als Notiz ≤ 4 000 mit Hinweis S5; nur-URL → lesbarer Titel aus Host und erstem Pfadteil.
- Link: nur http/https wird zum Chip S7 (Host aus `new URL().hostname`, Punycode bei Nicht-ASCII) und öffnet erst auf Tipp den Systembrowser; nichts wird je abgerufen (kein Titel, kein Vorschaubild, kein Favicon).
- Vor „Ablegen“ wird nichts geschrieben (Schreib-Spion); `accounts` wird nie angeboten.
- Android: **keine** Änderung an Intent-Filtern, exportierten Komponenten oder am zusammengeführten Manifest – der NS4-Check bleibt unverändert grün; braucht „Fertig“ einen neuen nativen Befehl, gilt seine Berechtigung nur für das Webview `main`.
- Handtest (echtes Handy: aus Browser, Messenger, Notiz-App teilen) mit id in docs/MANUAL-TESTS.md.

## Nicht in diesem Paket
Bilder und Dateien (gestrichen, CONCEPT-INTAKE „Struck part“), Rückweg in die Quell-App, Teilen aus dem Planer heraus, Empfang im Hintergrund.

## Abnahme
Tests der Übergabe; `e2e/seed/share-planner.seed.spec.ts` (PWA-Weg); Mess-Skript D2: Griffe 5 → 2, Modulwechsel 2 / 3 → 1, `wayBack` ja. `cargo`-Tests des Plugins unverändert grün.

## Skills
`council` (Eingang von außen; Guardian: nur vorbefüllen, Schema-Tor, Längen, nichts abrufen, Manifest unverändert), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
