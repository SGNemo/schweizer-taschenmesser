# Planner hub 2 – prompts, packages 5a to 1

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 5a: steps and „Los“ (`feat/plan-steps`)

```
# Aufgabe: Planer-Zentrale 2, Paket 5a – ein Ding mit Schritten ist eine Zeile; „Los“ zeigt nur den nächsten Schritt
Routing: Claude Code · Planer-Zentrale 2 Paket 5a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-steps` von frischem `develop`, nach dem Merge von Paket 2. Hotspots ansagen: `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts`, `modules/routines/services.ts`.

## Ausgangslage
CONCEPT-ROWS.md „Idea 5“ (5a); Entscheidung Richtung A in DESIGN.md §3 (vom Maintainer bestätigt 2026-11-23); handoff/05-bundle.md (Abschnitte „Closed row“, „Expanded“, „Los“); COPY.md B1, B3–B7, B10, B14 (nur „Als Routine speichern“), B16, B19, B22–B26; die Ecke „Verlassen“ wie gebaut (`t.focus.mode.leave`); A11Y.md („Los“).

## Pflichtliste
- Vertrag: `PlannableItem.steps?` und `PlannableSource.onStepDone?` (nur Anzeige und „Los“, nie im Eingabe-Hash – Test nach dem Muster `linksDisplayOnly`).
- Quellen: ToDos (Checkliste), Listen (offene Einträge), Routinen (Schritte des heutigen Laufs).
- Zeile: Meta B1; Schritte-Panel über `PlanPanelHost` (ToDos- und Listen-Panel aus 4a bekommen den Fuß „Los“ · ⋯ · „Ganz öffnen“; Routinen ein eigenes).
- „Los“: `FocusPage` im Schritt-Modus (`?step=1`) genau nach der Tabelle der Übergabe – kein Ring, keine Liste der übrigen Schritte, Uhr zählt hoch und folgt „Uhr ausblenden“; überlebt Neuladen; Tasten: Enter ist die eigene Auslösung des fokussierten Knopfs; S und P nur, solange der Fokus auf einem der Knöpfe der Bühne steht (nicht global, WCAG 2.1.4); Esc wie gehabt; der Schrittwechsel wird höflich mit B24 angesagt. Die Startzeile „Anfangen mit … · Fokus starten“ von „Tag kippt“ bleibt unverändert; ist ihr Ding eins mit Schritten, führt sie in den Schritt-Modus. Letzter Schritt: der gefüllte Knopf heißt B23 „Fertig“, schließt den Schritt ab, hakt das tragende Ding ab und **kehrt in den Plan zurück** mit dessen Toast („Erledigt.“ + Rückgängig) – keine Endseite.
- „Als Routine speichern“ (zwei Griffe: ⋯, der Eintrag) sendet das vorhandene `routine.requested` – als **ein** Undo-Eintrag: heute abonniert `modules/routines/services.ts` mit `(req) => void addRequested(req)`, der Bus wartet nicht auf das Schreiben; dieses Paket macht den Handler abwartbar (gibt das Promise zurück) und sendet im `act` des Planers. Toast B16 „· Ansehen · Rückgängig“; gibt es eine Routine dieses Namens schon und wird nichts geschrieben, B25. Bei einem ToDo nur, wenn es eine einfache Aufgabe ist – kein alter `links[]`-Eintrag und keine `origin`-Link-Zeile (die Regel des URL-Chips); Listen und Routinen wie sie sind. Tests: ein Undo-Eintrag; B25 bei doppeltem Namen; ein Mail-ToDo mit `links[]`, aber ohne `_links`-Zeile bekommt den Eintrag nicht.
- Jeder Schritt-Haken ist rückgängig machbar: jedes `onStepDone` (Haken im Panel und „Fertig · weiter“) läuft in seinem eigenen `act`; in „Los“ trägt der leise Toast B26 „Schritt erledigt. · Rückgängig“ ihn. Regel-Test nach planner-rethink §7 für den Schritt-Modus.
- Im Feld: „Name: a, b, c“ wird erst mit Paket 3 erkannt – hier nicht.

## Nicht in diesem Paket
Bündel aus mehreren Dingen (5b), Besorgungen (6), Dauer messen (8, gestrichen), Schritt-Dauern, Verschachtelung.

## Abnahme
Tests der Übergabe (5a); Mess-Skript C1 neu gemessen mit einem ToDo samt Checkliste, das in ToDos angelegt wird (Feld „Haushalt“, aufklappen, „Ganz öffnen“, am Desktop „Bearbeiten“, fünf Zeilen, „Speichern“, zurück): `createTaps` 12 → 11 (Handy 10), `moduleSwitches` 4 / 5 → 2, `workTaps` 7 (gemessen 8 seit 4a, `IST` stand bei 7; Zeile öffnen, „Los“, fünf Schritte – der letzte Knopf B23 „Fertig“ hakt das Ding ab und kehrt in den Plan zurück), `taps` 19 → 18 (Handy 17), gemessen `perThing` 7 (Preis, dauerhaft; `IST` bleibt 6), `nextStepOnly` nein → ja – das beendet den C1-Preis (`workTaps`, `taps`); `savedAsRoutine` bleibt ja. `createTaps` 1, `taps` 8 und `moduleSwitches` 0 kommen erst mit Paket 3. kopf-leer- und tag-kippt-Skript grün. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

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
CONCEPT.md §0.1; CONCEPT-ROWS.md „Idea 5“ (5b); handoff/05-bundle.md („5b: making and unmaking“, Zustände); COPY.md B2, B11–B18, B20, B21, B25, M5.

## Pflichtliste
- Daten: Sammlung `planner_bundle` (`title`; Datensatz-id `b_<uuid>`), Felder `bundle`, `step` auf `planner_item`; `npm run db:bump`, vorherige Stores nach `core/db/schema-history.json`, `manifest.version` + leerer Migrationsschritt; `dataApi: false` bleibt für das ganze Modul.
- Die eigene Quelle des Planers (`planner/plannable.ts` aus Paket 2) listet Bündel (Art `bundle`, Schlüssel `planner:<Datensatz-id>`) und liefert nur den Titel des Bündels und die Schlüssel seiner Mitglieder in Reihenfolge – das Blatt, das die Einträge aller Quellen schon hält, fügt Titel, Minuten und Erledigt-Stand hinzu; ein Mitglied, das keine Quelle mehr listet, ist erledigt oder weg, unterschieden über `resolveLink` (`done` / `gone`); die eigene Quelle ruft nie den Sammler; ein gebündeltes Ding ist nie Mitglied eines Stapels (Test); ein Mitglied mit `bundle` steht nicht selbst auf dem Blatt, solange das Bündel lebt, fehlt in den Eingaben des Laufs und in jedem Vorschlag (seine Minuten zählen einmal, in der Summe des Bündels) und gilt als geplant am Tag des Bündels (`plannedDay`, Plan-Stand in ToDos, Marke M5) – Tests für alle drei. Solange das Bündel lebt, werden eigene Zuweisungs-Zeilen eines Mitglieds von Blatt, Lauf, Vorschlägen und `plannedDay` übergangen: das Bündel gewinnt. Kein Link-Ziel für Bündel (Mitgliedschaft ist kein Link).
- „Alle Schritte erledigt“ ist abgeleitet (gezeichnet wie erledigt), nie geschrieben; Schreib-Spion: ein Mitglied, das in seinem Modul erledigt oder gelöscht wird, schreibt nichts in Planer-Tabellen.
- Besorgungsrunde (Idee 6, hier eingebaut): ein Mitglied, das eine Liste ist, zeigt im Panel des Bündels seine offenen Einträge als Haken-Zeilen (Körper des Listen-Panels aus 4a); in „Los“ ist die Liste ein Schritt mit diesen Zeilen.
- „Bündeln …“ nur für Zeilen verknüpfbarer Module (dieselbe Regel wie „Thema …“); ein Mitglied wird über seine `entityId` aufgelöst, sonst über seine Item-id – ein Mitglied eines nicht verknüpfbaren Moduls kann es nicht geben (Test).
- Aktionen, je genau ein Undo-Eintrag: „Bündeln …“ (Auswahlleiste, Dialog B12), „Auflösen“, „Aus dem Bündel nehmen“, „Umbenennen …“, Sortieren. Die Regel-Tests von planner-rethink CONCEPT-MIGRATION §7 um diese Aktionen erweitern (Schnappschuss aller Planer-Zeilen vor/nach jedem Undo).
- „Los“ über Mitglieder (ein Mitglied ohne Haken zeigt sein Panel als Schritt; nach dem letzten Mitglied dieselbe Rückkehr in den Plan, nichts abzuhaken); „Als Routine speichern“ nur, wenn alle Mitglieder einfache Aufgaben sind (ToDos ohne alten `links[]`-Eintrag und ohne `origin`-Link-Zeile: der Titel eines Mail-ToDos ist der Betreff und darf nicht in Routinen wandern; Test mit einem Mail-ToDo, das `links[]` hat, aber keine `_links`-Zeile), als ein Undo-Eintrag mit B16 / B25 wie in 5a.
- `PlanMark` zeigt M5 für Mitglieder.
- Zwei Geräte: `bundle`/`step` konvergieren feldweise (Test in der Art von `core/entitylinks/sync.test.ts`); Gerät A bündelt X, während Gerät B X auf Donnerstag legt → X ist im Bündel und steht am Tag des Bündels, „Auflösen“ legt es auf den Tag des Bündels (Sync-Test); ein Bündel löschen löscht kein Mitglied.

## Nicht in diesem Paket
Orte und Karte (gestrichen), Thema (11), Bündel in Bündeln, ein automatischer Vorschlag zu bündeln.

## Abnahme
Tests der Übergabe (5b); `e2e/seed/plan-bundle.seed.spec.ts`; Mess-Skript C2: `rows` 2 → 1, `oneRow` ja, `workTaps` 9 / 8 → 6; gemessen `createTaps` 14 (Handy 13) und `perThing` 7 – im Skript-Kopf benannte Preise, dauerhaft; `IST` bleibt 0 / 5 (darin der eine Weg nach Listen für „In den Plan“: eine Einkaufsliste ist nur auf Anfrage eine Planzeile, docs/decisions/plan-sources.md – das bleibt so; `moduleSwitches` bleiben 2). Lesart des Skripts ändern: `rows` nach dem Anlegen des Bündels lesen (wie C1 `created` liest) und `oneRow` aus diesem Ergebnis (eine Zeile hält die Runde); das ⋯ der Zeile bietet nie „Bündeln …“. Dünn nach den Zahlen: vor dem Start entscheiden, ob es das wert ist. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

## Skills
`council` (Daten, Migration, zwei Geräte), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 1: share into the planner (`feat/share-planner`)

```
# Aufgabe: Planer-Zentrale 2, Paket 1 – Teilen → Planer: geteilter Text oder Link liegt mit einem Tipp unter „Noch ohne Tag“
Routing: Claude Code · Planer-Zentrale 2 Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/share-planner` von frischem `develop`, nach dem Merge von 5b (teilt den Planer-Block von `strings.ts` mit 5b: nicht parallel). Hotspots ansagen: `web/src/pages/ShareTarget.tsx`, `web/src/core/modules/types.ts`, `strings.ts`.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 1“ (ganz, mit dem Abschnitt gegen docs/security/LAUNCH-REVIEW-2026-11.md); handoff/01-share.md; COPY.md S1, S2, S5, S7–S9, S14, S16. Bestand – darauf wird gebaut, nicht daneben: `web/src/pages/ShareTarget.tsx` (Karte „Geteilt“, Karte „Vorschlag“ mit `CaptureForm` – `oneEntry`, `initialText`, `initialType?`, `extra`, speichert auf seinem eigenen „Speichern“ seit U17 und ruft `onSaved(saved)` mit `id`, `type`, `moduleId`, `undo()`; Haken „Text als Notiz“ → `extra.note`; „oder im Modul öffnen“), `quickCapture/ui/announceSaved.ts`, das Erfassungsziel `plan` in `quickCapture/targets/adapters.ts`, `web/src/quickCapture/nativeShare.ts`, `web/src-tauri/plugins/share-intent/**`.

## Pflichtliste
- Bei eingeschaltetem Planer startet das Formular der Karte „Vorschlag“ mit `initialType="plan"` (Zielwort S1 wie gebaut: `t.quickCapture.target.plan`); er kann die Art im Formular wie gebaut ändern – dann gehen S2 und S16, und die Seite verhält sich genau wie gebaut (andere Erfassungsziele lassen `extra.note` fallen). Unter `plan` liest das Formular wie gebaut: ein getipptes Tageswort wird das eigene Datum des ToDos, kein Planertag – das Ding liegt unter „Noch ohne Tag“. Die Zeile ist die gebaute (`sharedLine`); der gebaute Parser nimmt eine Adresse aus dem Titel. Planer aus: die Seite genau wie heute. **Keine** neue Zielliste, keine Radiogruppe, keine Tages-Chips, kein neuer Knopf – der Knopf ist „Speichern“ des Formulars. Kein Bus-Ereignis, keine Änderung an `DateChips`.
- Unter dem Formular S2 (nur solange die Art `plan` ist); bei einer geteilten http/https-Adresse von ≤ 2 048 Zeichen dazu S16 mit dem Host, ebenfalls nur bei der Art `plan` – die Adresse wird dann als erste Zeile der Notiz des ToDos gespeichert (`extra.note`), auch ohne Haken; eine längere oder nicht-http-Adresse wird nicht als Link gespeichert (sie bleibt Teil des Textes). „Text als Notiz“ wie gebaut für den Rest; der Rest wird auf 4 000 Zeichen minus die Adresszeile gekürzt (S5 sagt es). Die Karte „Geteilt“ zeigt den ganzen geteilten Inhalt wie gebaut – nichts Gespeichertes ist verborgen.
- Test: **jedes gespeicherte Feld wird auf der Seite gezeigt** (Titel = der gelesene Titel des Formulars; Adresse = S16; Rest = der Haken). Vor „Speichern“ wird nichts geschrieben (Schreib-Spion); `accounts` wird nie angeboten.
- Nach „Speichern“ (`onSaved`) geht die Seite nicht mehr zur Startseite, sondern zeigt S8 „Abgelegt.“ mit „Ansehen“ (`/planner?item=todos:<id>`, ohne Tag; baut auf das Aufklappen von „Noch ohne Tag“ aus 10b), „Rückgängig“ (`saved.undo()`) und S9 „Fertig“ (Android zurück in die teilende App, PWA öffnet den Planer). Der Toast der Erfassung bleibt wie gebaut (`announceSaved`). Ein Rückgängig, im Gleichschritt: die Seite folgt dem gespeicherten ToDo live; ist es weg (ihr eigenes „Rückgängig“ oder das des Toasts), zeigt sie S14 „Zurückgenommen.“ und kein „Ansehen“ (Test). Kein Schließen nach Zeit.
- Chip S7 an der Zeile: `PlannableItem.url?` (neu in `core/modules/types.ts`) – die ToDos-Quelle reicht es nur weiter, wenn die eigene Notiz der Aufgabe mit genau einer nackten http/https-Adresse von ≤ 2 048 Zeichen beginnt **und** die Aufgabe keinen alten `links[]`-Eintrag und keine `origin`-Link-Zeile hat (die Webmail-Adresse eines Mail-ToDos wird nie ein Chip; Test mit einem Mail-ToDo, das `links[]` hat, aber noch keine `_links`-Zeile). Schema und Host beim Lesen, beim Zeichnen und beim Öffnen geprüft; Host aus `new URL().hostname` (Punycode bei Nicht-ASCII); der Chip ist ein Link oder hat einen zugänglichen Namen, der den Host enthält; er öffnet erst auf Tipp den Systembrowser; nichts wird je abgerufen (kein Titel, kein Vorschaubild, kein Favicon). Der Planer liest nie die Notiz eines ToDos. `url?` ist nur Anzeige: für den Chip, nie im Eingabe-Hash, nie in „Plan als Text kopieren“, im Kalender-Chip, im Widget oder in Lauf-Titeln (Tests: im Stil von `linksDisplayOnly` und ein `copyInput`-Fall).
- docs/security/LAUNCH-REVIEW-2026-11.md, Zeile B9, wörtlich: „the share page stores only on the capture card's own button (since U17). New: with the planner on the planner is the preselected kind, and a shared link's address is stored with the thing; both are shown on the page before the button.“ – eine Zeile, im PR benannt.
- Android: **keine** Änderung an Intent-Filtern, exportierten Komponenten oder am zusammengeführten Manifest – der NS4-Check bleibt unverändert grün; braucht „Fertig“ einen neuen nativen Befehl, gilt seine Berechtigung nur für das Webview `main`.
- Handtest (echtes Handy: aus Browser, Messenger, Notiz-App teilen) mit id in docs/MANUAL-TESTS.md.

## Nicht in diesem Paket
Bilder und Dateien (gestrichen, CONCEPT-INTAKE „Struck part“), Rückweg in die Quell-App, Teilen aus dem Planer heraus, Empfang im Hintergrund.

## Abnahme
Tests der Übergabe; `e2e/seed/share-planner.seed.spec.ts` (PWA-Weg); Mess-Skript D2 („Speichern“, „Ansehen“): `taps` 5 → 2, `moduleSwitches` 2 / 3 → 1, `forms` 1, `inPlanner` ja, `wayBack` nein → ja. Lesart des Skripts ändern: der Rückweg zählt, wenn die Zeile einen Link auf den geteilten Host hält oder ein Bedienelement, dessen zugänglicher Name den Host enthält (heute prüft es nur `href` und das Attribut `aria-label`). `cargo`-Tests des Plugins unverändert grün. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

## Skills
`council` (Eingang von außen; Guardian: gespeichert nur auf „Speichern“ der Erfassungskarte, jedes gespeicherte Feld gezeigt, Schema-Tor, Längen, nichts abrufen, Manifest unverändert), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
