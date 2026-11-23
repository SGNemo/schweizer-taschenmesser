# Planner hub 2 – prompts, packages 3 and 9

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

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
- Eintragen: `saveCapture(<Art>)` und das Legen in den Plan („ohne Tag“) für Rechnung, Einkaufsliste, Bündel in **einer** rückgängig machbaren Aktion – das Feld lebt im Planer und ruft dessen eigene Lege-Funktion direkt (nicht den Bus: der schluckt Fehler und zeigt einen eigenen Toast), nimmt ihr Ergebnis und nimmt bei Misserfolg das Angelegte zurück (Rollback-Test). Gibt es die Planzeile schon, bleibt sie, wie sie ist: „Milch“ hebt nie ein „Nicht planen“ der Einkaufsliste auf (Test). Termin, Notiz, Merkliste ohne Planzeile, Toast bietet „In den Plan“.
- Toast K4; kein Betrag im Toast bei „Werte ausblenden“.
- Schalter K5 in den Planer-Einstellungen (an).
- Kein neuer Modell-Aufruf, kein Netz: die vorhandene lokale Stufe (Desktop) bleibt unverändert, läuft wie heute nur für Einträge ohne Vorschauzeile und erzeugt nie eine.

## Nicht in diesem Paket
Ein Arten-Wähler, ein zweites Feld, Erkennung in „Plan einfügen“, neue Parser-Arten, Lernen aus „Als Aufgabe eintragen“.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-kinds.seed.spec.ts`; Mess-Skript A1: `rightKind` 4 → 12, Zeilen 11 → 7, `linkedToPlan` 10; C1 `createTaps` 1; Parser-Korpus (quick-capture, kopf-leer) unverändert grün, Diff im PR.

## Skills
`council` (Daten entstehen in fremden Modulen aus einer Zeile; Guardian: nie stillschweigend falsch, ein Undo, kein Lesepfad), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```



## Prompt – package 9: before and after an appointment (`feat/plan-appointment`)

```
# Aufgabe: Planer-Zentrale 2, Paket 9 – ein Termin bietet „Vorbereiten …“ und „Danach …“ an
Routing: Claude Code · Planer-Zentrale 2 Paket 9 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-appointment` von frischem `develop`, nach dem Merge von Paket 3.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 9“; handoff/09-appointment.md; COPY.md A1–A5; A11Y.md (Termin).

## Pflichtliste
- Die Blocker-Zeile eines Termins klappt auf (Titel als Knopf); Kalender liefert `planPanel`: Tag · Zeit · Ort, verknüpfte Dinge unter „Vorbereitung“ / „Danach“ (A5) als Haken-Zeilen – es sind ToDos: gelesen über `linkEntries`, abgehakt über `todo.doneRequested` in `undoable`, nie durch einen Import von `todos` –, die zwei Knöpfe A1.
- Ein Tipp setzt den Fokus ins Feld mit dem Vor-Chip A2 (✕, zweite Wahl A3) im Platz der Vorschauzeile aus Paket 3; Enter legt ein ToDo auf den Tag des Termins (bzw. davor/danach; `day` auf dem Titel-Weg seit 10a) mit `links: [{ rel: 'before' | 'after' }]`; ein Undo.
- Die neue Zeile trägt Chip A4 und sortiert im Tag direkt vor bzw. nach dem Blocker; sie bekommt keine Uhrzeit (der Planer bleibt ein Tagesplaner).
- Termin verschoben: nichts bewegt sich von selbst. Termin gelöscht: der Chip sagt es in Worten.

## Nicht in diesem Paket
Automatische Zeilen, Wegezeit, Vorlagen je Terminart, ganztägige Termine.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-appointment.seed.spec.ts`; Mess-Skript D3: Modulwechsel 4 → 0, Griffe 14 → 3; `check:stimulus` unverändert.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
