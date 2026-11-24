# Planner hub 2 – prompts, packages 3 and 9

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 3: kinds in the field (`feat/plan-field-kinds`)

```
# Aufgabe: Planer-Zentrale 2, Paket 3 – Abladen mit Art-Erkennung: das eine Feld sagt vor dem Eintragen, was aus der Zeile wird
Routing: Claude Code · Planer-Zentrale 2 Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-field-kinds` von frischem `develop`, nach dem Merge von Paket 1. Hotspots ansagen: `PlannerPage.tsx`, `strings.ts`, `web/src/quickCapture/parser/types.ts`, `web/src/quickCapture/targets/adapters.ts`; sonst `quickCapture/parser/**` nur lesen und über neue Tests festnageln.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 3“ (Tabelle „Sure when“ ist die Regel, wörtlich); handoff/03-kinds.md; COPY.md K1–K9, K7b, A7; A11Y.md (Vorschauzeile).

## Pflichtliste
- Namens-Nachschlagen **neu bauen** in `web/src/quickCapture/targets/lookup.ts` (dort steht heute nur `findOpenInvoice`): Namen der Vorrats-Einträge und der Einkaufslisten-Einträge, gelesen über das allgemeine Manifest-Repo wie `findOpenInvoice` (Kern, kein Modul-Import), exakt, ohne Groß/Klein, lokal, nur solange diese Module an sind. Test: Treffer, Beinahe-Treffer, Modul aus.
- `planner/fieldKind.ts`: reine Funktion Text → sichere Art oder nichts, auf dem vorhandenen Parser und dem neuen Namens-Nachschlagen. Reihenfolge der Lesarten: die eigenen Lesarten des Planers „fest“, „Pause …“, „heute nur …“ und eingefügter Plan gehen vor; dann gewinnt eine sichere Art, die ein Datum nutzt (Rechnung: Wort + Betrag; Termin: Tag + Uhrzeit), über die Datums-Lesart des Planers und nimmt das Datum als Frist / Tag; ein Datumswort ohne sichere Art („Wäsche morgen“) bleibt beim Planer. Tests: „Rechnung Stadtwerke 80 € bis Fr“, „Mi 15:00 Friseur“, „Wäsche morgen“. „Mahnung“ ist keine sichere Art (sie würde eine offene Rechnung doppeln). Je Tabellenzeile zwei Treffer und drei Beinahe-Treffer als Test.
- `Capture.tsx`: Prop `preview` – Zeile K1 mit „Als Aufgabe eintragen“ (K3, auch Alt+Enter); Beispiele und Vorschau nie zugleich; 412: Zeile über dem Feld; Live-Region entprellt.
- Eintragen: `saveCapture(<Art>)` (ein Erfassungsziel des Kerns – der eine Weg, auf dem der Planer in einem anderen Modul etwas anlegt, nur auf seinen Tipp und im einen Undo-Eintrag des Planers) – Rechnung und Einkaufsliste „ohne Tag“, eine Aufgabe mit Schritten auf den Tag des Blatts wie jedes ToDo aus dem Feld. Enter ist **eine** `runUser`-Aktion des Planers. Darin: `saveCapture(<Art>)`; dann schreibt der Planer für Rechnung und Einkaufsliste seine eigene Item-Zeile für das Ding mit `itemPatch` – **nur wenn noch keine Item-Zeile existiert**; er rührt `excluded` nie an, entfernt oder setzt nie eine Tageszeile, legt nichts (das Ding steht unter „Noch ohne Tag“). Eine einfache Aufgabe / Aufgabe mit Schritten geht den normalen Weg des Feldes (`addFromField`). Nach der Rückkehr von `runUser`: listet die Quelle das Ding nicht (Muster `placeRequested`: `run.outcome.inputs.titles[key]`), ruft die Aktion `undoEntry(run.entry.id)` – das Angelegte wird zurückgenommen. Ein Toast (K4), nur aus dieser Aktion. Nie `placeMany` (eine vollständige Nutzer-Aktion mit eigenem `runUser`, die sich in der seriellen Kette des Planers anstellt – in einer anderen Aktion gerufen, blockiert sie; sie hebt auch „Nicht planen“ auf, entfernt Tageszeilen und zeigt einen eigenen Toast), nie `requestIntoPlan` (die Bus-Sendung, die Fehler schluckt); `requestIntoPlan` nur für das spätere Angebot „In den Plan“ im Toast bei Notiz und Merkliste. Gibt es die Planzeile schon, bleibt sie, wie sie ist: „Milch“ hebt nie ein „Nicht planen“ der Einkaufsliste auf. Tests: die Aktion kehrt zurück (kein Blockieren); ein Undo-Eintrag; `excluded` unverändert („Milch“ bei „Nicht planen“ der Einkaufsliste); eine vorhandene Tageszeile bleibt; Rücknahme, wenn die Quelle das Ding nicht listet. Termin, Notiz, Merkliste ohne Planzeile; nur bei Notiz und Merkliste bietet der Toast „In den Plan“, beim Termin nicht (er ist ein Blocker seines Tages). Schreib-Spion: Planer-Tabellen + `_links` + seine `_meta`-Schlüssel + genau die Sammlung des einen Erfassungsziels.
- Aufgabe mit Schritten: `CaptureFields.checklist?` neu in `quickCapture/parser/types.ts` und seine Abbildung im ToDo-Erfassungsziel (`quickCapture/targets/adapters.ts`); Test. Die Zeile ist eine gewöhnliche ToDo-Zeile: keine Bündel-Einträge (Auflösen, Umbenennen …); „Als Routine speichern“ wie in 5a, wenn sie eine einfache Aufgabe ist; „Thema …“ wird angeboten.
- Toast K4, für eine einfache Aufgabe mit Vor-Chip A2 K7 („vor“) bzw. K7b („nach“), nur mit T11 K8; ein Ding, das bei aktivem Themenfilter entsteht und T11 nicht annimmt (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste), bekommt am Ende seines Toasts K9 „Nicht im Thema „…“ · Alles zeigen“ (beendet den Filter); ein durchgestrichener Vor-Chip trägt A7 als Beschreibung (`aria-describedby`); mehr Namen in K1: K6; kein Betrag im Toast bei „Werte ausblenden“.
- Vor-Chips und Vorschau (ein Platz, eine Reihenfolge; handoff/00-common.md): Vor-Chips stehen vor der Eingabe (A2 aus Paket 9, T11 aus Paket 11; höchstens zwei, A2 zuerst), K1 bleibt unter dem Feld. Nur eine einfache Aufgabe – auch eine mit Schritten – nimmt die Vor-Chips an (A2 → Link und Tag, T11 → Thema). Bei jeder anderen Art (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) werden die Chips durchgestrichen gezeichnet, solange K1 steht, und nicht angewendet. Gibt ein Chip den Tag, nennt K1 bzw. der Toast des Feldes diesen Tag. Dieses Paket baut den Platz so, dass 9 und 11 nur ihren Chip hinzufügen.
- Schalter K5 in den Planer-Einstellungen (an).
- Kein neuer Modell-Aufruf, kein Netz: die vorhandene lokale Stufe (Desktop) bleibt unverändert, läuft wie heute nur für Einträge ohne Vorschauzeile und erzeugt nie eine.

## Nicht in diesem Paket
Ein Arten-Wähler, ein zweites Feld, Erkennung in „Plan einfügen“, neue Parser-Arten, Lernen aus „Als Aufgabe eintragen“.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-kinds.seed.spec.ts`; Mess-Skript A1 (der Seed des Skripts legt „Milch“, „Spülmittel“, „Batterien AA“ in die Vorräte): `rightKind` 4 → 12, `rows` 11 → 7, `linkedToPlan` 4 → 10, `taps` 12, `perThing` 0, `moduleSwitches` 0; C1 (die Runde als eine getippte Zeile): `createTaps` 11 / 10 → 1, `taps` 18 / 17 → 8, `moduleSwitches` 2 → 0, `workTaps` 7, gemessen `perThing` 7 (Preis, dauerhaft; `IST` bleibt 6). Parser-Korpus (quick-capture, kopf-leer) unverändert grün, Diff im PR. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

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
CONCEPT-INTAKE.md „Idea 9“; handoff/09-appointment.md; COPY.md A1–A7, K7, K7b; A11Y.md (Termin).

## Pflichtliste
- Die Blocker-Zeile eines Termins klappt auf (Titel als Knopf); Kalender liefert `planPanel`: Tag · Zeit · Ort, verknüpfte Dinge unter „Vorbereitung“ / „Danach“ (A5) als Haken-Zeilen – es sind ToDos: gelesen über `linkEntries`, abgehakt über `todo.doneRequested` in `undoable`, nie durch einen Import von `todos`. Die zwei Knöpfe A1 zeichnet der Planer selbst im Fuß von Blocker-Zeilen (das Kalender-Panel ist nur der Körper).
- Ein Tipp setzt den Fokus ins Feld mit dem Vor-Chip A2 (✕, zweite Wahl A3 – ausgeblendet, wenn der Termin heute ist) vor der Eingabe (Reihenfolge der Vor-Chips aus Paket 3). Nur eine einfache Aufgabe – auch eine mit Schritten – nimmt die Vor-Chips an (A2 → Link und Tag, T11 → Thema). Bei jeder anderen Art (Rechnung, Einkaufsliste, Termin, Notiz, Merkliste) werden die Chips durchgestrichen gezeichnet, solange K1 steht, und nicht angewendet. Gibt ein Chip den Tag, nennt K1 bzw. der Toast des Feldes diesen Tag. Enter erweitert die eigene `addFromField` des Planers: ToDo auf den Tag des Termins (bzw. davor/danach) und den Link `before` / `after` in ihrer einen rückgängig machbaren Aktion, mit dem Toast des Feldes K7 – nicht über den Bus. Test: ein Undo-Eintrag, eine `_links`-Zeile, kein `links[]`-Eintrag.
- Die neue Zeile trägt Chip A4 und sortiert im Tag direkt vor bzw. nach dem Blocker; sie bekommt keine Uhrzeit (der Planer bleibt ein Tagesplaner).
- Termin verschoben: nichts bewegt sich von selbst. Termin gelöscht: der Chip sagt es in Worten.

## Nicht in diesem Paket
Automatische Zeilen, Wegezeit, Vorlagen je Terminart, ganztägige Termine.

## Abnahme
Tests der Übergabe; `e2e/seed/plan-appointment.seed.spec.ts`; Mess-Skript D3 (Kachel Mittwoch, Blocker aufklappen, „Vorbereiten …“, „Bargeld holen“ + Enter): `taps` 14 → 4, `perThing` 0, `moduleSwitches` 4 → 0, `linked` ja, `onWednesday` ja. Lesart des Skripts ändern: `linked` liest `_links` (`before` vom ToDo zu `calendar:ev1`) statt `todo.links[]`, das leer bleibt. `check:stimulus` unverändert. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

## Skills
`review-loop`, `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
