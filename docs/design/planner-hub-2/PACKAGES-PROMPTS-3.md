# Planner hub 2 – prompts, packages 5a, 8 and 1

Plan, order, target figures, the shared block `#common` and „as built“: [PACKAGES](PACKAGES.md). One prompt per chat, pasted as it stands. Model: Claude Opus.

## Prompt – package 5a: steps and „Los“ (`feat/plan-steps`)

```
# Aufgabe: Planer-Zentrale 2, Paket 5a – ein Ding mit Schritten ist eine Zeile; „Los“ zeigt nur den nächsten Schritt
Routing: Claude Code · Planer-Zentrale 2 Paket 5a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-steps` von frischem `develop`, nach dem Merge von Paket 2. Hotspots ansagen: `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts`, `modules/routines/services.ts`.

## Ausgangslage
CONCEPT-ROWS.md „Idea 5“ (5a); Entscheidung Richtung A in DESIGN.md §3 (vom Maintainer bestätigt 2026-11-23); handoff/05-bundle.md (Abschnitte „Closed row“, „Expanded“, „Los“); COPY.md B1, B3–B7, B10, B14 (nur „Als Routine speichern“), B16, B19, B23–B26, X7; die Ecke „Verlassen“ wie gebaut (`t.focus.mode.leave`); A11Y.md („Los“).

## Pflichtliste
- Vertrag: `PlannableItem.steps?` und `PlannableSource.onStepDone?` (nur Anzeige und „Los“, nie im Eingabe-Hash – Test nach dem Muster `linksDisplayOnly`).
- Quellen: ToDos (Checkliste), Listen (offene Einträge), Routinen (Schritte des heutigen Laufs).
- Zeile: Meta B1; Schritte-Panel über `PlanPanelHost` (ToDos- und Listen-Panel aus 4a bekommen den Fuß „Los“ · ⋯ · „Ganz öffnen“; Routinen ein eigenes).
- „Los“: `FocusPage` im Schritt-Modus (`?step=1`) genau nach der Tabelle der Übergabe – kein Ring, keine Uhr, keine Liste der übrigen Schritte (die Bühne: Kopfzeile, Titel, Knöpfe, „Verlassen“); B7 „Pause“, pausiert das gebaute `t.focus.mode.resume` („Weiter“); überlebt Neuladen; Tasten: Enter ist die eigene Auslösung des fokussierten Knopfs; S und P nur, solange der Fokus auf einem der Knöpfe der Bühne steht (nicht global, WCAG 2.1.4); Esc wie gehabt; der Schrittwechsel wird höflich mit B24 angesagt. Die Startzeile „Anfangen mit … · Fokus starten“ von „Tag kippt“ bleibt unverändert; ist ihr Ding eins mit Schritten, führt sie in den Schritt-Modus. Letzter Schritt: der gefüllte Knopf heißt B23 „Fertig“, schließt den Schritt ab und hakt das tragende Ding ab – in **einem** `act`, ein Undo-Eintrag bringt beides zurück (der §7-Test im Schritt-Modus deckt den letzten Schritt) – und **kehrt in den Plan zurück** mit dessen Toast („Erledigt.“ + Rückgängig) – keine Endseite.
- „Als Routine speichern“ (zwei Griffe: ⋯, der Eintrag) nur, solange das Routinen-Modul an ist. Vor dem Senden schlägt der Planer den Namen über das allgemeine Manifest-Repo nach (Muster `quickCapture/targets/lookup.ts`, kein Modul-Import): gibt es eine Routine dieses Namens, Toast B25, nichts wird gesendet. Sonst sendet er das vorhandene `routine.requested` im `act` des Planers – heute abonniert `modules/routines/services.ts` mit `(req) => void addRequested(req)`, der Bus wartet nicht auf das Schreiben; dieses Paket macht den Handler abwartbar (gibt das Promise zurück); danach bestätigt dasselbe Nachschlagen die Routine → Toast B16 „· Ansehen · Rückgängig“ (ein Undo-Eintrag), sonst X7. „Ansehen“ öffnet `/routines`. Bei einem ToDo nur, wenn es eine einfache Aufgabe ist – kein alter `links[]`-Eintrag und keine `origin`-Link-Zeile (die Regel des URL-Chips); Listen und Routinen wie sie sind. Tests: Modul aus (kein Eintrag), doppelter Name (B25, nichts geschrieben), Handler wirft (X7), Erfolg (ein Undo-Eintrag); ein Mail-ToDo mit `links[]`, aber ohne `_links`-Zeile bekommt den Eintrag nicht.
- Jeder Schritt-Haken ist rückgängig machbar: jedes `onStepDone` (Haken im Panel und „Fertig · weiter“) läuft in seinem eigenen `act`; in „Los“ trägt der leise Toast B26 „Schritt erledigt. · Rückgängig“ ihn. Regel-Test nach planner-rethink §7 für den Schritt-Modus.
- Im Feld: „Name: a, b, c“ wird erst mit Paket 3 erkannt – hier nicht.

## Nicht in diesem Paket
Bündel aus mehreren Dingen (5b), Besorgungen (6), Dauer messen (8, gestrichen), Schritt-Dauern, Verschachtelung.

## Abnahme
Tests der Übergabe (5a); Mess-Skript C1 neu gemessen mit einem ToDo samt Checkliste, das in ToDos angelegt wird (Feld „Haushalt“, aufklappen, „Ganz öffnen“, am Desktop „Bearbeiten“, fünf Zeilen, „Speichern“, zurück): `createTaps` 12 → 11 (Handy 10), `moduleSwitches` 4 / 5 → 2, `workTaps` 7 (gemessen 8 seit 4a, `IST` stand bei 7; Zeile öffnen, „Los“, fünf Schritte – der letzte Knopf B23 „Fertig“ hakt das Ding ab und kehrt in den Plan zurück), `taps` 19 → 18 (Handy 17), gemessen `perThing` 7 (Preis, dauerhaft; `IST` bleibt 6), `nextStepOnly` nein → ja – das beendet den C1-Preis (`workTaps`, `taps`); `savedAsRoutine` bleibt ja. `createTaps` 1, `taps` 8 und `moduleSwitches` 0 kommen erst mit Paket 3. kopf-leer- und tag-kippt-Skript grün. Herleitung je Griff, Stufen und Lesart des Skripts: docs/design/planner-hub-2/FIGURES.md.

## Skills
`council` (Manifest-Vertrag), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 8: measured duration (`feat/plan-measure`)

```
# Aufgabe: Planer-Zentrale 2, Paket 8 – echte Dauer: „Los“ misst, ein neues gleiches Ding schlägt die gemessene Zeit vor
Routing: Claude Code · Planer-Zentrale 2 Paket 8 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/plan-measure` von frischem `develop`, nach dem Merge von 5a. Hotspots ansagen: Dexie-Version / `schema.snapshot.json`.

## Ausgangslage
CONCEPT-ROWS.md „Idea 8“ (ganz; „The same thing“ ist die Regel); handoff/08-duration.md; COPY.md Z1–Z3. Vom Maintainer am 2026-11-24 freigegeben, obwohl es weder Zeilen noch Modulwechsel senkt. Frühere Entscheidung: nichts ändert eine Schätzung von selbst – das bleibt: nur ein **neues** Ding bekommt den Vorschlag als Startwert.

## Pflichtliste
- `planner_measure` (`key`, `minutes`, `on`), `db:bump`, Schema-Historie, `manifest.version`; aufgezeichnet in der Aktion „Erledigt“ / „Fertig · weiter“ einer Fokus-Runde (Pausen abgezogen; < 1 Min und > 8 h nicht), dort auch auf 5 je Schlüssel gekürzt.
- Schlüssel: stabile Quell-id vor Titel; Titel-Normalisierung = die von `pastePlan.ts`; kein unscharfer Treffer.
- Vorschlag: Median der letzten 5 bei ≥ 2, auf 5 gerundet, nur beim Anlegen ohne Minuten; Anzeige Z1, Zeile Z2 in „Dauer …“; Schalter und „Gemessene Zeiten löschen“ (Z3).
- Ausschluss-Test: die Sammlung erreicht keinen Export, keinen Kopiertext, keine Daten-API, kein Assistenten-Schema, keine Diagnose.

## Nicht in diesem Paket
Zeiterfassung an- oder einschalten, bestehende Schätzungen ändern, Statistik-Ansichten, Vergleiche „geplant gegen gebraucht“.

## Abnahme
Tests der Übergabe; Mess-Skript C1: `learned` ja, `durationProposed` beim zweiten Mal = gemessen.

## Skills
`council` (Daten, Privatsphäre), `design:accessibility-review`, `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```

## Prompt – package 1: share into the planner (`feat/share-planner`)

```
# Aufgabe: Planer-Zentrale 2, Paket 1 – Teilen → Planer: geteilter Text oder Link liegt mit einem Tipp unter „Noch ohne Tag“
Routing: Claude Code · Planer-Zentrale 2 Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Gemeinsamer Block (gilt ganz): docs/design/planner-hub-2/PACKAGES.md#common
Branch `feat/share-planner` von frischem `develop`, nach dem Merge von 8. Hotspots ansagen: `web/src/pages/ShareTarget.tsx`, `web/src/core/modules/types.ts`, `strings.ts`.

## Ausgangslage
CONCEPT-INTAKE.md „Idea 1“ (ganz, mit dem Abschnitt gegen docs/security/LAUNCH-REVIEW-2026-11.md); handoff/01-share.md; COPY.md S1, S2, S5, S7–S9, S14, S16, S19. Bestand – darauf wird gebaut, nicht daneben: `web/src/pages/ShareTarget.tsx` (Karte „Geteilt“, Karte „Vorschlag“ mit `CaptureForm` – `oneEntry`, `initialText`, `initialType?`, `extra`, speichert auf seinem eigenen „Speichern“ seit U17 und ruft `onSaved(saved)` mit `id`, `type`, `moduleId`, `undo()`; Haken „Text als Notiz“ → `extra.note`; „oder im Modul öffnen“), `quickCapture/ui/announceSaved.ts`, das Erfassungsziel `plan` in `quickCapture/targets/adapters.ts`, `web/src/quickCapture/nativeShare.ts`, `web/src-tauri/plugins/share-intent/**`.

## Pflichtliste
- Bei eingeschaltetem Planer startet das Formular der Karte „Vorschlag“ mit `initialType="plan"` (Zielwort S1 wie gebaut: `t.quickCapture.target.plan`); er kann die Art im Formular wie gebaut ändern – dann gehen S2 und S16, und die Seite verhält sich genau wie gebaut: die Adresszeile kommt nur bei der Art `plan` in `extra.note`; bei jeder anderen Art ist `extra.note` genau der Rest des Hakens, wie gebaut (ToDo, Termin, Erinnerung, Rechnung und Notiz behalten ihn; Tests mit Notiz und ToDo). Unter `plan` liest das Formular wie gebaut: ein getipptes Tageswort wird das eigene Datum des ToDos, kein Planertag – das Ding liegt unter „Noch ohne Tag“. Die Zeile ist die gebaute (`sharedLine`); der gebaute Parser nimmt eine Adresse aus dem Titel. Planer aus: die Seite genau wie heute. **Keine** neue Zielliste, keine Radiogruppe, keine Tages-Chips, kein neuer Knopf – der Knopf ist „Speichern“ des Formulars. Kein Bus-Ereignis, keine Änderung an `DateChips`.
- Unter dem Formular S2 (nur solange die Art `plan` ist); bei einer geteilten http/https-Adresse von ≤ 2 048 Zeichen dazu S16 mit dem Host, ebenfalls nur bei der Art `plan` – die Adresse wird dann als erste Zeile der Notiz des ToDos gespeichert (`extra.note`), auch ohne Haken; eine Adresse ohne http/https-Schema (z. B. `www.…`) oder länger als 2 048 Zeichen wird **nicht gespeichert** (der gebaute Parser nimmt sie aus dem Titel, das Ziel `plan` hat kein URL-Feld): an der Stelle von S16 steht S19 „Dieser Link wird nicht mit abgelegt.“, die Karte „Geteilt“ zeigt sie wie immer (Test). „Text als Notiz“ wie gebaut für den Rest; der Rest wird auf 4 000 Zeichen minus die Adresszeile gekürzt (S5 sagt es). Die Karte „Geteilt“ zeigt den ganzen geteilten Inhalt wie gebaut – nichts Gespeichertes ist verborgen.
- Test: **jedes gespeicherte Feld wird auf der Seite gezeigt** (Titel = der gelesene Titel des Formulars; Adresse = S16; Rest = der Haken). Vor „Speichern“ wird nichts geschrieben (Schreib-Spion); `accounts` wird nie angeboten.
- Nach „Speichern“ (`onSaved`) mit `saved.type === 'plan'` – nur dann; jede andere Art behält das gebaute Verhalten (Toast der Erfassung, zur Startseite; Test) – geht die Seite nicht mehr zur Startseite, sondern zeigt S8 „Abgelegt.“ mit „Ansehen“ (`/planner?item=todos:<id>`, ohne Tag; baut auf das Aufklappen von „Noch ohne Tag“ aus 10b), „Rückgängig“ (`saved.undo()`) und S9 „Fertig“ (Android zurück in die teilende App, PWA öffnet den Planer). Der Toast der Erfassung bleibt wie gebaut (`announceSaved`). Ein Rückgängig, im Gleichschritt: die Seite folgt dem gespeicherten ToDo live; ist es weg (ihr eigenes „Rückgängig“ oder das des Toasts), zeigt sie S14 „Zurückgenommen.“ und kein „Ansehen“ (Test). Kein Schließen nach Zeit.
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
