# Use case „Wochenende retten“ – packages (phase 3, final prompts)

Decisions: [TARGET.md](TARGET.md) §5 answered 2026-11-14 with the recommended options (Q1 a, Q2 a, Q3 a, Q4 a), recorded in [`docs/decisions/features-wochenende.md`](../../../decisions/features-wochenende.md) – a package adds a decision bullet **only where it builds differently**. Friction ids: [ANALYSIS.md](ANALYSIS.md) (W01–W22). Council round 1 (2026-11-14) folded in. One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Template: kopf-leer's package plan (git history, `9113e74d1^:docs/design/usecases/kopf-leer/PACKAGES.md`). **State 2026-11-15:** packages 1–3 are merged (#870, #880, #888); next is package 4. Second opinion before 4–8: [REVIEW-FABLE.md](REVIEW-FABLE.md).

**Order (revised 2026-11-15 after [REVIEW-FABLE.md](REVIEW-FABLE.md), maintainer: „wie empfohlen“):** 1 → 2 → 3 (merged) → 4a → 5a → 6 → 8, one after another: all touch `modules/planner/**`, 4a and 5a the quick-capture parser. **Parked, each needs its own go:** 4b day parts (only if the order of a day is still wrong after 4a), 5b deadline time (`due.time`, contract), 7 „Beantwortet?“ (after the decision on a shared Google OAuth client, W15; the „Antworten: …“ line is dropped). Their first prompts are in the git history (`e5f14e183:docs/design/usecases/wochenende/PACKAGES.md`, packages 4, 5, 7). Each package lowers `MAX` in the script for the paths it improves to the value it measured (never raises one). Not now: W15, auto-enabling time tracking (W14), demo-mail search (W16).

| #   | Package                                                   | Branch                            | Scope (short)                                                                                                                                                                                                    | Hotspots to announce (row in CHATS.md „Hotspots“)           | Skill         | Acceptance figures (script `web/e2e/usecases/wochenende.spec.ts`; `MAX` is lowered only in package 8) |
| --- | --------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Quick fixes: deadline day, deadline line, day chips, head | `fix/plan-weekend-quick`          | `modules/planner/actions.ts` (W20), `quickCapture/parser/index.ts` (W04 only), `DaySheet.tsx` + `PlannerPage.tsx` (W08, W09, W13), `CaptureForm.tsx` order (W07)                                                 | none                                                        | `review-loop` | B detours 3 → 2; C ≤ 9 taps; G detours 2 → 1                                                          |
| 2   | „Tage einteilen“ – the three-step sheet                   | `feat/plan-days-setup`            | new `modules/planner/components/DaySetup.tsx`, `PlannerPage.tsx` (empty state, `?start=1`), `layout/setup/WelcomeCard.tsx` (secondary link), strings                                                             | `layout/setup/WelcomeCard.tsx` (small)                      | `review-loop` | A 10 → 1 tap, 3 → 1 screen, detours 1 → 0; C over the sheet, Sunday has rows (C detours 1 → 0)        |
| 3   | „Rest verteilen“ in the evening                           | `feat/plan-rest-evening`          | `modules/planner/actions.ts` (`restToTomorrow` = the ops of `moveAll`), `core/plan/instructions.ts` (sentence), head link, `widgets/WeekWidget.tsx`, `todos/widgets/NextWidget.tsx` (bus), optional notification | `core/events` types (one event, additive)                   | `council`     | F 9 → 2 taps, detours 1 → 0, today empty                                                              |
| 4a  | Break and estimates                                       | `feat/plan-break-estimates`       | quick capture and sheet: „Pause …“/„Freizeit …“ lines become a blocker; row ⋯ „Als Pause …“ converts the ToDo (blocker in, ToDo out, one undo); row ⋯ „Dauer …“ (5/15/30/60)                                     | `core/modules/types.ts` (one additive callback `onRemove?`) | `council`     | C ≤ 11 taps and no worse than before; „Zocken“ is a break and no open ToDo; B unchanged or better     |
| 5a  | Reminders „einmal“                                        | `feat/plan-remind-once`           | calendar `once?` + migration, `modules/calendar/notifications.ts`, every reminder from quick capture or planner field carries it; a row in the multi-line preview switches to „Erinnerung“ in one tap            | none                                                        | `review-loop` | reminders from capture/field never repeat; B: the Monday line is a reminder after one tap             |
| 6   | „Tagesende“ as a head sentence                            | `feat/plan-day-end`               | one optional planner setting „Tagesende“, head sentence with the existing „Rest verteilen“ link, quiet link in `DaySetup.tsx`; **no** engine change                                                              | none                                                        | `review-loop` | H 3 → 2 taps, detours 1 → 0                                                                           |
| 8   | Nachmessen                                                | `qa/usecase-wochenende-remeasure` | `web/e2e/usecases/wochenende.spec.ts` (assertions, `MAX` check), `ANALYSIS.md`/`TARGET.md` (one „measured after“ table)                                                                                          | none                                                        | `review-loop` | every revised figure of TARGET §4 met, or the difference named with its reason                        |
| 4b  | parked: day parts                                         | `feat/plan-day-parts`             | engine order by part, fixed clock borders (12:00, 18:00) cut to the window, never thirds                                                                                                                         | `core/plan/**`                                              | `council`     | only after 4a, only on the maintainer's go                                                            |
| 5b  | parked: deadline time                                     | `feat/plan-due-time`              | `due.time?` in the contract, planner + todos migrations, „1 Std vorher“                                                                                                                                          | `core/modules/types.ts`                                     | `council`     | only on the maintainer's go                                                                           |
| 7   | parked: „Beantwortet?“ on mail rows                       | `feat/mail-answered`              | part (b) of the first plan only                                                                                                                                                                                  | `core/events`                                               | `council`     | only after W15                                                                                        |

Each package: own branch from fresh `develop` (after the previous PR is merged), PR against `develop`, a CHATS.md row only for its hotspot and the „Wartet auf Sven“ line moved on, `.changes/` note (DE/EN; package 8: `no-changelog`), STATUS one line in its own `docs(status)` PR, the focus checklist 1–9 answered in the PR text with before/after figures, the use-case script green (`USECASE_SEED_URL` for path E, `E2E_SEED=0` unless the seed project is needed), and the kopf-leer script green when the planner or the capture changes (`e2e/usecases/kopf-leer.spec.ts`: its planner bounds sit exactly at their target). Health guard for every package: the app stores only the typed title – no field, category, flag or inference from words like „krank“, „Arzt“ or „Gesundheit“. Model: Claude Opus (package 8: Fable). Every package lowers `MAX` for its own paths to what it measured. UI texts German and English only.

### Prompt – package 1: quick fixes (`fix/plan-weekend-quick`)

```
# Aufgabe: Wochenende retten – Frist am richtigen Tag, „bis So 18:00“ als Frist, Tagesblatt mit Chips, ruhiger Kopfsatz (Paket 1 von 8)

Routing: Claude Code · Wochenende Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/plan-weekend-quick` von frischem `develop`. Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild freigegeben: docs/design/usecases/wochenende/TARGET.md (§1, F1 kleinster Schritt, F4 kleinster Schritt), Reibung in ANALYSIS.md W04, W07, W08, W09, W13, W20; Entscheidungen docs/decisions/features-wochenende.md. Lies `modules/planner/actions.ts` (`addFromField`, Z. 177–195: die Frist kommt aus `extractDuePhrase`, das Datum des ToDos aber aus dem Rest-Text „… 18:00“ → heute), `modules/planner/dueWords.ts`, `quickCapture/parser/index.ts` (Z. 59, 76, 105–106, 280–312: Datum + Uhrzeit wird Termin), `modules/planner/components/DaySheet.tsx` (Stepper Z. 75–90, `AVAILABLE_STEP` in `actions.ts:263`), `routes/PlannerPage.tsx` (Z. 340–347 Kopfsatz, Z. 569 und 776: erst Tag wählen, dann Kopf erneut tippen), `quickCapture/ui/CaptureForm.tsx` (Reihenfolge der Vorschauzeilen).

## Pflichtliste
- W20 (Fehler): im Planer-Feld gewinnt die Frist der „bis/Frist <Tag>“-Phrase auch für das Datum des ToDos; eine Uhrzeit im Rest bleibt wie heute nur als Notizzeile (die Uhrzeit als Feld kommt in Paket 5). Unit-Test: „Team-Sachen lesen bis So 18:00“ am Samstag → ToDo-Datum = Planer-Frist = Sonntag.
- W04: Schnellerfassung – „bis/spätestens <Tag> [<Uhrzeit>]“ macht ein ToDo mit Fälligkeit (nicht Termin), Uhrzeit wie heute als Notizzeile; Korpus um die Zeile aus ANALYSIS §2 (Pfad B) und Gegenzeilen („Termin bis 18 Uhr“, „Mo 9:30 Teamrunde“, „Fr 20 Uhr Kino mit Anna“ bleiben Termine); Diff des ganzen Korpus (quick-capture und kopf-leer) im PR.
- **Nicht** in diesem Paket: „Mo 7:30 … falls nötig“ als Erinnerung (W06) – das kommt mit „einmal“ in Paket 5, sonst würde die Erinnerung nach der heutigen Regel wiederholen (Entscheidung Q4 a).
- W07: in der Mehrzeilen-Vorschau stehen Zeilen, die kein ToDo werden, oben (oder eine Zusammenfassung „9 ToDos · 3 Termine“ über den Zeilen – du entscheidest, im PR begründen).
- W08/W09: der gewählte Tag zeigt „Verfügbar“ mit Chips „keine Zeit · 2 h · 4 h · 6 h · ganzer Tag“ (ganzer Tag = 12 h; „frei“ bleibt das Wort für freie Zeit; Zahlen über `core/i18n/format`) direkt im Tagesbereich, oder ein Tipp öffnet das Tagesblatt; −/+ bleibt für Feinschritte. Neue Strings DE + EN.
- W13: leerer Planer-Kopf ohne Widerspruch: „Noch nichts geplant – heute <frei> frei.“ (FOCUS-WORDING-Zeile „Day plan head“ ergänzen).
- Mess-Skript `web/e2e/usecases/wochenende.spec.ts`: Pfad C nutzt die Chips (ehrlich zählen: die Wege einer Person ohne Vorwissen), Pfade B, C, G grün; `MAX` **nicht** senken (Paket 8). kopf-leer-Skript grün.

## Nicht in diesem Paket
Das Blatt „Tage einteilen“ (2), Pause und Abschnitte (4), Uhrzeit als Fristfeld, „einmal“ und W06 (5), Vertrags- oder Engine-Änderungen, Modul-Standards.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `E2E_SEED=0 npx playwright test e2e/usecases/wochenende.spec.ts e2e/usecases/kopf-leer.spec.ts e2e/planner.spec.ts e2e/quick-capture.spec.ts`; `npx vitest run src/quickCapture src/modules/planner`.
- Zahlen vorher/nachher im PR-Text: B Umwege 3 → 2, C Taps 23 → ≤ 9, G Umwege 2 → 1; Fokus-Checkliste 1–9; Entfernt: der widersprüchliche Kopfsatz.
- Docs: `.changes/` (DE/EN), STATUS-Zeile im eigenen `docs(status)`-PR, „Wartet auf Sven“-Zeile auf Paket 2 weiterstellen.

## Skills
`review-loop` (ein Opus-Reviewer: Parser-Korpus mit Gegenzeilen für Freizeit- und Bürotermine, kein Wort der Parser-Listen setzt aus Gesundheitswörtern (krank, Arzt …) ein Feld oder eine Kategorie – ein Wort entscheidet nur ToDo vs. Termin; Wording nach FOCUS-WORDING), dann `full stop`.
```

### Prompt – package 2: „Tage einteilen“ (`feat/plan-days-setup`)

```
# Aufgabe: Wochenende retten – „Tage einteilen“: ein Blatt in drei Schritten, von der Willkommenskarte und dem leeren Planer (Paket 2 von 8)

Routing: Claude Code · Wochenende Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-days-setup` von frischem `develop` – nach dem Merge von Paket 1. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `layout/setup/WelcomeCard.tsx` (ein zweiter, sekundärer Link). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q1 a (docs/decisions/features-wochenende.md), Zielbild TARGET.md F1 (mittel), Reibung W01, W02, W03, W10. Lies `layout/setup/WelcomeCard.tsx` (Z. 25–28: heute „Einrichtung starten“ primär + „Später“), docs/rules/core-privacy.md (Einrichtung: nie Daten im Fortschritt, nie eine Nörgelei), `core/setup/profiles.ts` (bleibt unverändert), `quickCapture/targets/index.ts` (`saveCaptures`), `modules/planner/actions.ts` (`setAvailable`, Vorschau `showPreview`), `components/PlanPreview.tsx`, die Chips aus Paket 1.

## Pflichtliste
- `modules/planner/components/DaySetup.tsx`: Schritt 1 „Was steht an?“ (Mehrzeilenfeld der Schnellerfassung, eine Zeile = ein Ding, Entwurf bleibt beim Schließen), Schritt 2 „Wie viel Zeit hast du?“ (heute und die zwei nächsten Tage als Zeilen mit den Chips aus Paket 1; schreibt Tageszeilen dieser drei Tage, nie die Wochentags-Standards), Schritt 3 Vorschau des Planers („Neu im Plan“ je Tag) → „Übernehmen“ / „Zurück“; ein Rückgängig für alles („Eingeplant: Sa, So, Mo · Rückgängig“). Ein Hauptknopf je Schritt. Weil die Zeit vor dem Verteilen steht, nimmt ein Sonntag mit Zeit Dinge auf (W10).
- Erreichbar: Willkommenskarte – „Einrichtung starten“ bleibt der eine Hauptknopf, „Tage einteilen“ ist ein sekundärer Knopf daneben; nach jedem der beiden Wege verschwindet die Karte wie nach „Später“ (Einrichtung bleibt über Einstellungen und die Checkliste erreichbar). „Tage einteilen“ öffnet `/planner?start=1`, schaltet `planner` (+ `todos` über `requires`) ein, schaltet nichts aus. Außerdem: leerer Planer (seine eine Aktion), Planer-⋯. Nie von selbst geöffnet. Danach ist die Planer-Gruppe in der Seitenleiste offen (W03).
- Gegen-Szenarien im PR prüfen: Werktag mit Bürozeiten als Terminen (die Termine blocken weiter), ohne Mail-Modul (unverändert), Planer aus (die Karte schaltet ihn nur auf Tipp ein).
- Mess-Skript: Pfade A und C gehen über das Blatt (ehrliche Zählung); Sonntag hat Zeilen (der Umweg in C fällt weg); `MAX` nicht senken.

## Nicht in diesem Paket
Tagesabschnitte (4), Tagesende (6), Änderungen an Profilen oder Einrichtungsfragen, neue Verträge (der Einstieg ist ein Link, keine neue Contribution).

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `e2e/a11y.spec.ts` um das Blatt; wochenende-, kopf-leer-Skript und `e2e/setup.spec.ts` grün.
- Zahlen: A 10 → 1 Tap, 3 → 1 Bildschirm, 1 → 0 Umwege; C über das Blatt, Umwege 1 → 0; Fokus-Checkliste 1–9; Entfernt: Stepper als erster Weg.
- Docs: Planer-Feature-Doku zwei Sätze, Nutzerdoku `docs/user/` DE + EN (`check:readme`), `.changes/`, STATUS im eigenen PR, CHATS-Hotspot-Zeile raus im letzten Commit.

## Skills
`review-loop` (Opus-Reviewer: Einrichtung ohne Daten im Fortschritt, ein Hauptknopf je Ansicht, nichts öffnet sich von selbst, AA-Kontrast, 44 px), dann `full stop`.
```

### Prompt – package 3: „Rest verteilen“ (`feat/plan-rest-evening`)

```
# Aufgabe: Wochenende retten – „Rest verteilen“ am Abend in einem Tipp, mit Vorschau (Paket 3 von 8)

Routing: Claude Code · Wochenende Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-rest-evening` von frischem `develop` – nach dem Merge von Paket 2. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/events` (ein Ereignis `plan.restRequested`, additiv). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild TARGET.md F3 (mittel), Reibung W18, W19; FOCUS-GUIDELINES „Notification limits“. Lies `core/plan/instructions.ts` (`moveAll`, Z. 207–216: Tag auf 0, `earliest` je Ding, harte Frist davor bleibt), `modules/planner/actions.ts` (`later` schreibt das Datum der Quelle – **nicht** das Vorbild; `showPreview`, ops), `routes/PlannerPage.tsx` (Kopf-⋯ Z. 349–356, Textlink „Woche prüfen“ als Muster), `widgets/WeekWidget.tsx`, `modules/todos/widgets/NextWidget.tsx` (Z. 86, 104 „Tag abschließen“), `modules/todos/progress.ts:125`, `core/notifications/policy.ts` (`applyQuiet`).

## Pflichtliste
- `restToTomorrow` = die ops von `moveAll(heute, morgen)`: heute verfügbar 0, jede offene Einheit von heute `earliest = morgen`; festgenagelte Einheiten und harte Fristen von heute bleiben. Vorschau („Verschoben · Sa → Mo …“) → „Übernehmen“; Rückgängig-Hinweis „Auf die nächsten Tage verteilt. · Rückgängig“. Unit-Test: deterministisch, Fixpunkt danach.
- Planer-Feld versteht „Rest verteilen“, „Rest auf morgen“.
- Erreichbar: stiller Textlink im Planer-Kopf ab 17:00 (Schalter `focus.eveningWrapUp`), Textaktion im Widget „Wochenlast“ ab 17:00, „Tag abschließen“ im ToDo-Widget ruft bei aktivem Planer über `plan.restRequested` (Event-Bus, kein Modul-Import) statt „Auf morgen schieben“ – und öffnet dieselbe Vorschau, nichts bewegt sich vor „Übernehmen“ (e2e-Test für diesen Weg).
- Optionale Benachrichtigung „Rest verteilen?“ um 20:00 (vor der Ruhezeit): `soft: true`, über `collectDue`, Schalter in „Ruhige Erinnerungen“, Standard **aus**, höchstens einmal am Tag, nie wiederholt, keine Zahl.
- Mess-Skript Pfad F über den Kopf-Link oder das Widget; Assertion: heute leer danach. `MAX` nicht senken.

## Nicht in diesem Paket
Verteilen ohne Tipp, Änderungen an Engine-Regel 6 (nichts rückt von selbst), Tagesende (6).

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; wochenende-, kopf-leer-Skript und `e2e/planner.spec.ts` grün; Benachrichtigung: Unit-Test Standard aus, einmal am Tag, 20:00 außerhalb der Ruhezeit.
- Zahlen: F 9 → 2 Taps, 1 → 0 Umwege; Fokus-Checkliste 1–9; Entfernt: „Auf morgen schieben“ bei aktivem Planer.
- Docs: FOCUS-WORDING eine Zeile (so / nicht so) für den neuen Satz; Entscheidungs-Bullet in docs/decisions/plan-contract.md (Op und Ereignis), `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` über den Diff (Guardian: nichts verschiebt sich ohne Tipp, Rückgängig stellt alles her, Benachrichtigung aus und gedrosselt; Advocate: ein ruhiger Satz, keine Zahl des Liegengebliebenen; Architect: ops wie `moveAll`, deterministisch, Ereignis additiv, kein Modul-Import), dann `full stop`.
```

### Prompt – package 4a: break and estimates (`feat/plan-break-estimates`)

```
# Aufgabe: Wochenende retten – Pause als Block statt als offenes ToDo, Dauer an der Zeile (Paket 4a)

Routing: Claude Code · Wochenende Paket 4a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-break-estimates` von frischem `develop`. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/modules/types.ts` (ein Rückruf `onRemove?` an `PlannableSource`, additiv), ein Chat. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild docs/design/usecases/wochenende/TARGET.md F2 in der kleinsten Größe, geändert durch REVIEW-FABLE.md R2, R3, R8 (PR #892): keine Tagesabschnitte, keine Engine-Änderung. Seit Paket 2 ist die getippte Reihenfolge die Reihenfolge des Tages (`modules/planner/daySetup.ts`, `createdAt: at + i`). Reibung W05, W11. Lies `core/modules/types.ts` (`PlannableSource`: `onDone`, `onEstimate` bestehen), `modules/todos/plannable.ts`, `modules/planner/{actions,schema,run}.ts` (Blocker der Tageszeile, `blockerSchema`), `routes/PlannerPage.tsx` (`rowMenu`), `core/plan/instructions.ts` (op `duration`; „Sa 14 bis 16 Uhr Zocken“ ist schon ein Blocker), `modules/todos/components/TaskEditor.tsx:49` (`ESTIMATES`), `quickCapture/parser/index.ts`, `quickCapture/targets/adapters.ts` (Planer-Ziel).

## Pflichtliste
- Schnellerfassung und Blatt „Tage einteilen“: Zeilen, die mit „Pause“ oder „Freizeit“ beginnen, werden bei aktivem Planer ein Blocker, sonst ein ToDo. Tag = getipptes Datum ?? heute, Länge = getippte Spanne oder Dauer ?? 1 Std, `from`/`to` nur, wenn getippt; über das bestehende Planer-Ziel in die Blocker des Tages; es entsteht **kein** ToDo; ein Rückgängig. Je Fall eine Korpus-Zeile. Ein bloßes „Zocken“ bleibt ein ToDo – die App rät nicht, was Freizeit ist.
- Zeile ⋯ „Als Pause …“ (ein Eintrag, der die Wahl 1 h · 2 h · 3 h öffnet): **wandelt um** – Blocker dieser Länge am Tag der Zeile, das ToDo wird entfernt (weich gelöscht) über den neuen additiven Rückruf `PlannableSource.onRemove?(id)`, der eine Rückgängig-Funktion liefert; ein Rückgängig stellt ToDo, Planer-Zeile und Zuweisung wieder her und nimmt den Blocker zurück. Kein Feld `asBreakOn`, kein Sonderfall in der Engine. Test: nach der Umwandlung gibt es kein offenes ToDo (auch nicht in der Morgen-Übersicht `modules/todos/notifications.ts`), und „Erledigt heute“ zählt es nicht.
- Zeile ⋯ „Dauer …“ (ein Eintrag, der 5 · 15 · 30 · 60 Min öffnet; über `onEstimate`); Planer-Feld „Duschen 15 Min“ besteht – prüfen und einen Test ergänzen. Im PR nennen, welcher Eintrag aus dem ⋯ dafür weicht oder warum keiner (Fokus 9); das Menü wächst um höchstens zwei Einträge.
- Eine Pause zeigt ihre eigene Länge wie jeder Blocker; keine Summe, keine Bewertung, keine Freizeit-Summe über Tage, kein Widget.
- Gegen-Szenarien im PR: Werktag mit Bürozeiten, ohne Mail, Planer aus („Pause …“ bleibt ein ToDo).
- Mess-Skript Pfad C: die Pause über „Als Pause …“ oder die Zeile „Pause 2 Std Zocken“ (ehrlich zählen); Assertion: kein offenes ToDo „Zocken“, die Reihenfolge des Tages ist die getippte. `MAX` für C (und B, falls besser) auf den gemessenen Wert senken.

## Nicht in diesem Paket
Tagesabschnitte und jede Engine-Änderung (4b, geparkt), Tagesende (6), Fristen-Uhrzeit (5b, geparkt), weitere Vertragsänderungen.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `npx vitest run src/quickCapture src/modules/planner src/modules/todos`; wochenende-, kopf-leer-Skript, `e2e/planner.spec.ts`, `e2e/quick-capture.spec.ts` grün.
- Zahlen vorher/nachher im PR: C (vorher 11 Taps · 9 Tasten nach Paket 2), B; Fokus-Checkliste 1–9.
- Docs: Entscheidungs-Bullet in docs/decisions/plan-contract.md (`onRemove`), `.changes/` (DE/EN), STATUS im eigenen `docs(status)`-PR, Hotspot-Zeile raus, „Wartet auf Sven“-Zeile weiterstellen.

## Skills
`council` (Vertrag: Guardian: keine Freizeit-Zählung, kein offenes ToDo bleibt, Rückgängig verlustfrei; Advocate: höchstens zwei neue Menüeinträge, ruhige Texte; Architect: Rückruf additiv, kein Modul-Import, keine Engine-Änderung), dann `full stop`.
```

### Prompt – package 5a: reminders „einmal“ (`feat/plan-remind-once`)

```
# Aufgabe: Wochenende retten – Erinnerungen aus der Erfassung feuern einmal (Paket 5a)

Routing: Claude Code · Wochenende Paket 5a · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-remind-once` von frischem `develop` – nach dem Merge von Paket 4a. Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q4 a, geändert durch REVIEW-FABLE.md R5, R6 (PR #892): keine neuen Auslösewörter („falls nötig“, „ggf.“ entfallen), keine Fristen-Uhrzeit (5b, geparkt). Reibung W06. Lies `modules/calendar/{schema,migrations,manifest,notifications}.ts` (`repeatSeries` für jede `kind: 'reminder'`, `focus.followUp` ist Standard an), `core/notifications/policy.ts`, `quickCapture/targets/adapters.ts`, `quickCapture/ui/{CaptureForm.tsx,batch.ts}` (Zeilenziel in der Mehrzeilen-Vorschau, `CaptureType` kennt `reminder`), docs/features/repeat-reminders.md, docs/legal/DATA-FLOWS.md Zeile `push`.

## Pflichtliste
- Kalender-Feld `once?` an Ereignissen (`manifest.version` + Migration); `notifications.ts` sendet dafür genau eine Benachrichtigung zur Uhrzeit – keine Vorab-Erinnerung (`extraMinutes`), keine gestaffelte Stufe, keine Wiederholung (Test mit `focus.staggered` und `followUp` an); die Zeile zeigt „einmal“. Jede Erinnerung aus Schnellerfassung oder Planer-Feld trägt `once`; Erinnerungen aus dem Kalender-Dialog behalten die globale Regel. `limits.test.ts`/`policy.test.ts` unverändert grün, neuer Test „once wiederholt nie“.
- W06 ohne neues Wort: „erinnere mich“ bleibt das einzige Auslösewort. In der Mehrzeilen-Vorschau lässt sich eine Zeile mit Tag und Uhrzeit mit einem Tipp von „Termin“ auf „Erinnerung“ stellen (prüfen, Test ergänzen; die Zeile „ToDo 9 · Termin 3“ zeigt das Ergebnis). Korpus: „Mo 7:30 krankmelden falls nötig“ bleibt gelesen ein Termin, „Mo 7:30 erinnere mich: krankmelden“ ist eine Erinnerung mit `once`; Gegenzeilen („Fr 20 Uhr Kino mit Anna“, „Mo 9:30 Teamrunde“) bleiben Termine.
- Titel: der getippte Text ohne Datum, Uhrzeit und „erinnere mich“ (wie heute). Kein Gesundheitsbezug: kein Feld, keine Kategorie, keine Ableitung aus dem Titel.
- Kein neuer Datenfluss (Zeile `push` wie jede Erinnerung).
- Mess-Skript Pfade B und G: ehrlich zählen (ein Tipp auf das Zeilenziel ist ein Tap, kein Umweg, wenn er zum Gemeinten führt); `MAX` für B und G auf den gemessenen Wert senken.

## Nicht in diesem Paket
`due.time`, `dueTime`, „1 Std vorher“ (5b), Vertragsänderungen, neue automatische Benachrichtigungen, Änderungen an der globalen Wiederholung oder an `core/notifications/policy.ts`.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Migrations-Test (Kalender); Korpus; wochenende-, kopf-leer-Skript, `e2e/reminders.spec.ts`, `e2e/quick-capture.spec.ts` grün.
- Zahlen B und G vorher/nachher; Erinnerungen aus der Erfassung wiederholen nie; Fokus-Checkliste 1–9.
- Docs: docs/features/repeat-reminders.md ein Satz, FOCUS-WORDING eine Zeile, `.changes/`, STATUS im eigenen PR.

## Skills
`review-loop` (Opus-Reviewer: Erinnerung nur auf Wunsch und einmal, Migration verlustfrei, „einmal“ sichtbar, keine Gesundheitsdaten), dann `full stop`.
```

### Prompt – package 6: „Tagesende“ as a head sentence (`feat/plan-day-end`)

```
# Aufgabe: Wochenende retten – „Tagesende“: ein ruhiger Satz im Planer-Kopf mit „Rest verteilen“ (Paket 6)

Routing: Claude Code · Wochenende Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-day-end` von frischem `develop` – nach dem Merge von Paket 5a. Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q3 a, verkleinert durch REVIEW-FABLE.md R4, R11 (PR #892): **keine** Engine-Änderung, kein Deckel in `capacity.ts`, kein `dayEnd` an Tageszeilen, kein „Tagesbeginn“. Wie viel auf einen Tag kommt, bestimmen die Minuten des Tages; nach dem Fensterende bekommt schon heute keine Sitzung eine Uhrzeit (`core/plan/windows.ts`). Reibung W22. Lies `modules/planner/settings.ts`, `modules/planner/rest.ts` und den Kopf-Link aus Paket 3 (`routes/PlannerPage.tsx`, `restOffered`), `components/DaySetup.tsx`, `core/settings/focus.ts` (`eveningWrapUp`).

## Pflichtliste
- Eine optionale Planer-Einstellung „Tagesende“ (`HH:mm`, Standard leer, synchron wie die übrigen Planer-Einstellungen; für alle Tage).
- Ab 30 Min vor dem Tagesende sagt der Planer-Kopf „Bald ist Tagesende.“; ist heute noch etwas offen, trägt derselbe Satz den bestehenden Link „Rest verteilen“ (ein Satz, eine Zeile – er ersetzt in dieser Zeit den Link ab 17 Uhr und montags „Woche prüfen“). Nur in der App, Schalter `focus.eveningWrapUp`; keine Benachrichtigung.
- Im Blatt „Tage einteilen“ Schritt 2 ein stiller Textlink „Tagesende festlegen“ (eingeklappt; aufgeklappt „23:00 · 0:00 · keins“), der die Einstellung setzt und sagt, dass sie für jeden Tag gilt; Rückgängig des Blatts nimmt sie mit zurück.
- Keine Schlafdaten, keine Zählung, kein Verlauf, keine Wörter wie „zu spät“; die Gewohnheit „Ins Bett bis …“ und das Zeitfenster als Grenze für Uhrzeiten werden nur in der Nutzerdoku erwähnt.
- Hinweistext des Schalters `focus.eveningWrapUp` (DE + EN) um den Tagesende-Satz ergänzen.
- Mess-Skript Pfad H über das Blatt; Assertion: mit gestellter Uhr 30 Min vor dem Tagesende steht der Satz im Kopf, mit offenem Ding samt Link. `MAX` für H auf den gemessenen Wert senken.

## Nicht in diesem Paket
Jede Änderung in `core/plan/**`, Migrationen, Gewohnheiten-Code, Schlaf-Tracking, Benachrichtigungen, Änderungen an der Ruhezeit.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Unit-Test für „wann zeigt der Kopf den Satz“; wochenende-, kopf-leer-Skript, `e2e/planner.spec.ts` grün.
- Zahlen: H 3 → 2 Taps, 1 → 0 Umwege; Fokus-Checkliste 1–9 (streng, im PR begründet).
- Docs: FOCUS-WORDING eine Zeile, Nutzerdoku DE + EN (`check:readme`), `.changes/`, STATUS im eigenen PR.

## Skills
`review-loop` (Opus-Reviewer: kein Tadel, ein Satz zur Zeit, keine Schlaf- oder Gesundheitsdaten, Einstellung additiv), dann `full stop`.
```

### Prompt – package 8: Nachmessen (`qa/usecase-wochenende-remeasure`)

```
# Aufgabe: Wochenende retten – Nachmessen nach den Paketen 1–3, 4a, 5a, 6 (Paket 8)

Routing: Claude Code · Wochenende Paket 8 · Fable
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `qa/usecase-wochenende-remeasure` von frischem `develop` – nach dem Merge der Pakete 4a, 5a und 6. Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielzahlen: docs/design/usecases/wochenende/TARGET.md §4; Messmodell und Pfade: ANALYSIS.md §2, `web/e2e/usecases/wochenende.spec.ts`.

## Pflichtliste
- Alle Pfade A–H auf leerer Installation neu messen (1920 und Pixel 7, hell/dunkel; Pfad E mit `USECASE_SEED_URL`); `MAX` steht schon je Paket auf dem gemessenen Wert – prüfen, gegen die geänderten Ziele in TARGET §4 („Revised“) halten und jeden Unterschied im Kommentar über `MAX` begründen.
- Zielzustände direkt prüfen: Sonntag hat Zeilen, heute ist nach „Rest verteilen“ leer, Frist So am ToDo, „Zocken“ ist nach „Als Pause …“ kein offenes ToDo, Erinnerungen aus der Erfassung wiederholen nie, der Tagesende-Satz steht im Kopf. Pfad G ist eine Variante von B, kein eigener Schritt des Morgens. Die Liste W01–W22 mit „gebaut in Paket … / nicht gebaut, weil …“ in ANALYSIS.md ergänzen.
- ANALYSIS.md und TARGET.md: je eine Tabelle „gemessen nach den Paketen“ (keine Historie, ein Absatz).

## Nicht in diesem Paket
Produktcode. Was beim Messen auffällt: neue Zeile in der Reibungstabelle (W23 …) und im PR-Text, kein Fix.

## Abnahme
- Skript dreimal hintereinander grün; `check:docs`; Label `no-changelog`; STATUS-Zeile „Use case Wochenende: nachgemessen“ im eigenen `docs(status)`-PR; „Wartet auf Sven“-Zeile raus.

## Skills
`review-loop` (eine Runde), dann `full stop`.
```
