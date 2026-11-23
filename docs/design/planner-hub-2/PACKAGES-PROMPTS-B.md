# Planner hub 2 – prompts, packages 5a to 3

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 5a: steps and „Los“ (`feat/plan-steps`)

```
# Aufgabe: Planer-Zentrale 2, Paket 5a – ein Ding mit Schritten ist eine Zeile; „Los“ zeigt nur den nächsten Schritt
Routing: Claude Code · Planer-Zentrale 2 Paket 5a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-steps` von frischem `develop`, nach dem Merge von Paket 2. Hotspots ansagen: `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts`.

## Ausgangslage
CONCEPT-ROWS.md „Idea 5“ (5a); Entscheidung Richtung A in DESIGN.md §3; handoff/05-bundle.md (Abschnitte „Closed row“, „Expanded“, „Los“); COPY.md B1, B3–B10, B14 (nur „Als Routine speichern“), B16; A11Y.md („Los“).

## Pflichtliste
- Vertrag: `PlannableItem.steps?` und `PlannableSource.onStepDone?` (nur Anzeige und „Los“, nie im Eingabe-Hash – Test nach dem Muster `linksDisplayOnly`).
- Quellen: ToDos (Checkliste), Listen (offene Einträge), Routinen (Schritte des heutigen Laufs).
- Zeile: Meta B1; Schritte-Panel über `PlanPanelHost` (ToDos- und Listen-Panel aus 4a bekommen den Fuß „Los“ · ⋯ · „Ganz öffnen“; Routinen ein eigenes).
- „Los“: `FocusPage` im Schritt-Modus (`?step=1`) genau nach der Tabelle der Übergabe – kein Ring, keine Liste der übrigen Schritte, Uhr zählt hoch und folgt „Uhr ausblenden“; überlebt Neuladen; Tasten S, P, Esc. Die Startzeile „Anfangen mit … · Fokus starten“ von „Tag kippt“ bleibt unverändert; ist ihr Ding eins mit Schritten, führt sie in den Schritt-Modus.
- „Als Routine speichern“ sendet das vorhandene `routine.requested`; Toast B16.
- Im Feld: „Name: a, b, c“ wird erst mit Paket 3 erkannt – hier nicht.

## Nicht in diesem Paket
Bündel aus mehreren Dingen (5b), Besorgungen (6), Dauer messen (8, gestrichen), Schritt-Dauern, Verschachtelung.

## Abnahme
Tests der Übergabe (5a); Mess-Skript C1 neu gemessen mit einem ToDo samt Checkliste: Zeilen 5 → 1, Durcharbeiten 10 → 6 Griffe, `nextStepOnly` ja, `savedAsRoutine` ja in 2 Griffen; kopf-leer- und tag-kippt-Skript grün.

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
CONCEPT.md §0.1; CONCEPT-ROWS.md „Idea 5“ (5b); handoff/05-bundle.md („5b: making and unmaking“, Zustände); COPY.md B2, B11–B15, B17, B18, M5.

## Pflichtliste
- Daten: Sammlung `planner_bundle` (`title`, `kind`), Felder `bundle`, `step` auf `planner_item`; `npm run db:bump`, vorherige Stores nach `core/db/schema-history.json`, `manifest.version` + leerer Migrationsschritt; `dataApi: false` bleibt für das ganze Modul.
- Die eigene Quelle des Planers listet Bündel (Art `bundle`, Schlüssel `planner:b_<id>`, `steps` = Mitglieder in Reihenfolge); ein Mitglied mit `bundle` steht nicht selbst auf dem Blatt, solange das Bündel lebt. `planner`-`linkTarget` für `b_`-ids (Titel des Bündels).
- Aktionen, je genau ein Undo-Eintrag: „Bündeln …“ (Auswahlleiste, Dialog B12 ohne den Schalter „Unterwegs“ – der kommt mit Paket 6), „Auflösen“, „Aus dem Bündel nehmen“, „Umbenennen …“, Sortieren. Die Regel-Tests von planner-rethink CONCEPT-MIGRATION §7 um diese Aktionen erweitern (Schnappschuss aller Planer-Zeilen vor/nach jedem Undo).
- „Los“ über Mitglieder (ein Mitglied ohne Haken zeigt sein Panel als Schritt); „Als Routine speichern“ nur, wenn alle Mitglieder einfache Aufgaben sind.
- `PlanMark` zeigt M5 für Mitglieder.
- Zwei Geräte: `bundle`/`step` konvergieren feldweise (Test in der Art von `core/entitylinks/sync.test.ts`); ein Bündel löschen löscht kein Mitglied.

## Nicht in diesem Paket
Besorgungsrunde und Orte (6), Thema (11), Bündel in Bündeln, ein automatischer Vorschlag zu bündeln.

## Abnahme
Tests der Übergabe (5b); `e2e/seed/plan-bundle.seed.spec.ts`; Mess-Skript C2 (ohne Karte): Zeilen 3 → 1 neu gemessen.

## Skills
`council` (Daten, Migration, zwei Geräte), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 1: share into the planner (`feat/share-planner`)

```
# Aufgabe: Planer-Zentrale 2, Paket 1 – Teilen → Planer: geteilter Text oder Link liegt mit einem Tipp unter „Noch ohne Tag“
Routing: Claude Code · Planer-Zentrale 2 Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/share-planner` von frischem `develop`, nach dem Merge von 5b (teilt keine Planer-Datei mit 5b: darf parallel zu 5b laufen, wenn Sven es will).

## Ausgangslage
CONCEPT-INTAKE.md „Idea 1“ (ganz, mit dem Abschnitt gegen docs/security/LAUNCH-REVIEW-2026-11.md); handoff/01-share.md; COPY.md S1–S7. Bestand: `web/src/pages/ShareTarget.tsx`, `web/src/quickCapture/nativeShare.ts`, `web/src-tauri/plugins/share-intent/**`.

## Pflichtliste
- Ziel „In den Planer“ als erste, vorgewählte Wahl (nur bei eingeschaltetem Planer); Tageswahl „ohne Tag · Heute · Morgen“; „Ablegen“ → `plan.requested` (`day: null` bzw. der Tag); Toast S4 mit „Ansehen“ (`/planner?item=`) und „Rückgängig“.
- Titel: erste Zeile, ≤ 160, Steuer- und Bidi-Zeichen entfernt; Rest als Notiz ≤ 4 000 mit Hinweis S5; nur-URL → lesbarer Titel aus Host und erstem Pfadteil.
- Link: nur http/https wird zum Chip S7 und öffnet erst auf Tipp den Systembrowser; nichts wird je abgerufen (kein Titel, kein Vorschaubild, kein Favicon).
- Vor „Ablegen“ wird nichts geschrieben (Schreib-Spion); `accounts` wird nie angeboten.
- Android: nach dem Ablegen zurück in die teilende App (Activity beenden); **keine** Änderung an Intent-Filtern, exportierten Komponenten oder am zusammengeführten Manifest – der NS4-Check bleibt unverändert grün.
- Handtest (echtes Handy: aus Browser, Messenger, Notiz-App teilen) mit id in docs/MANUAL-TESTS.md.

## Nicht in diesem Paket
Bilder und Dateien (gestrichen, CONCEPT-INTAKE „Struck part“), Rückweg in die Quell-App, Teilen aus dem Planer heraus, Empfang im Hintergrund.

## Abnahme
Tests der Übergabe; `e2e/seed/share-planner.seed.spec.ts` (PWA-Weg); Mess-Skript D2: Griffe 6 → 2, Modulwechsel 1 → 0. `cargo`-Tests des Plugins unverändert grün.

## Skills
`council` (Eingang von außen; Guardian: nur vorbefüllen, Schema-Tor, Längen, nichts abrufen, Manifest unverändert), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 3: kinds in the field (`feat/plan-field-kinds`)

```
# Aufgabe: Planer-Zentrale 2, Paket 3 – Abladen mit Art-Erkennung: das eine Feld sagt vor dem Eintragen, was aus der Zeile wird
Routing: Claude Code · Planer-Zentrale 2 Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-field-kinds` von frischem `develop`, nach dem Merge von Paket 1. Hotspots ansagen: `PlannerPage.tsx`, `strings.ts`; `quickCapture/parser/**` nur lesen und über neue Tests festnageln.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 3“ (Tabelle „Sure when“ ist die Regel, wörtlich); handoff/03-kinds.md; COPY.md K1–K5; A11Y.md (Vorschauzeile).

## Pflichtliste
- `planner/fieldKind.ts`: reine Funktion Text → sichere Art oder nichts, auf dem vorhandenen Parser und dem lokalen Nachschlagen der Einkaufs- und Vorratsnamen (`quickCapture/targets/lookup.ts`); die eigenen Lesarten des Planers (Datum, „fest“, „Pause …“, „heute nur …“, eingefügter Plan) gehen vor. Je Tabellenzeile zwei Treffer und drei Beinahe-Treffer als Test.
- `Capture.tsx`: Prop `preview` – Zeile K1 mit „Als Aufgabe eintragen“ (K3, auch Alt+Enter); Beispiele und Vorschau nie zugleich; 412: Zeile über dem Feld; Live-Region entprellt.
- Eintragen: `saveCapture(<Art>)` + `requestIntoPlan` für Rechnung, Einkaufsliste, Bündel in **einer** rückgängig machbaren Aktion (schlägt die Plan-Anfrage fehl, wird das Angelegte zurückgenommen); Termin, Notiz, Merkliste ohne Planzeile, Toast bietet „In den Plan“.
- Toast K4; kein Betrag im Toast bei „Werte ausblenden“.
- Schalter K5 in den Planer-Einstellungen (an).
- Kein Modell, kein Netz: die lokale Modell-Stufe (Desktop) läuft wie heute nur für Einträge ohne Vorschauzeile.

## Nicht in diesem Paket
Ein Arten-Wähler, ein zweites Feld, Erkennung in „Plan einfügen“, neue Parser-Arten, Lernen aus „Als Aufgabe eintragen“.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-kinds.seed.spec.ts`; Mess-Skript A1: `rightKind` 12 von 12 allein mit dem Feld, Formulare 0, Modulwechsel 0; Parser-Korpus (quick-capture, kopf-leer) unverändert grün, Diff im PR.

## Skills
`council` (Daten entstehen in fremden Modulen aus einer Zeile; Guardian: nie stillschweigend falsch, ein Undo, kein Lesepfad), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
