# Use case „Wochenende retten“ – packages (phase 3, final prompts)

Decisions: [TARGET.md](TARGET.md) §5 answered 2026-11-14 with the recommended options (Q1 a, Q2 a, Q3 a, Q4 a), recorded in [`docs/decisions/features-wochenende.md`](../../../decisions/features-wochenende.md) – a package adds a decision bullet **only where it builds differently**. Friction ids: [ANALYSIS.md](ANALYSIS.md) (W01–W22). Council round 1 (2026-11-14) folded in. One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Template: kopf-leer's package plan (git history, `9113e74d1^:docs/design/usecases/kopf-leer/PACKAGES.md`).

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 8; package 7 after 5, in parallel to 6 (7: `modules/mail/**`, `connectors/google/gmail.ts`, `quickCapture/parser`, todos adapter; 6: `core/plan/**`, planner settings, `DaySetup.tsx` – no shared file). Serial before that because 1–6 all touch `modules/planner/**`, 1/4/5/7 the quick-capture parser, and 5 the contract in `core/modules/types.ts` (hotspot, one chat at a time). Not now (own decision later): a shared Google OAuth client (W15), auto-enabling time tracking (W14).

| #   | Package                                                   | Branch                            | Scope (short)                                                                                                                                                                                                                               | Hotspots to announce (row in CHATS.md „Hotspots“) | Skill         | Acceptance figures (script `web/e2e/usecases/wochenende.spec.ts`; `MAX` is lowered only in package 8) |
| --- | --------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------- |
| 1   | Quick fixes: deadline day, deadline line, day chips, head | `fix/plan-weekend-quick`          | `modules/planner/actions.ts` (W20), `quickCapture/parser/index.ts` (W04 only), `DaySheet.tsx` + `PlannerPage.tsx` (W08, W09, W13), `CaptureForm.tsx` order (W07)                                                                            | none                                              | `review-loop` | B detours 3 → 2; C ≤ 9 taps; G detours 2 → 1                                                          |
| 2   | „Tage einteilen“ – the three-step sheet                   | `feat/plan-days-setup`            | new `modules/planner/components/DaySetup.tsx`, `PlannerPage.tsx` (empty state, `?start=1`), `layout/setup/WelcomeCard.tsx` (secondary link), strings                                                                                        | `layout/setup/WelcomeCard.tsx` (small)            | `review-loop` | A 10 → 1 tap, 3 → 1 screen, detours 1 → 0; C over the sheet, Sunday has rows (C detours 1 → 0)        |
| 3   | „Rest verteilen“ in the evening                           | `feat/plan-rest-evening`          | `modules/planner/actions.ts` (`restToTomorrow` = the ops of `moveAll`), `core/plan/instructions.ts` (sentence), head link, `widgets/WeekWidget.tsx`, `todos/widgets/NextWidget.tsx` (bus), optional notification                            | `core/events` types (one event, additive)         | `council`     | F 9 → 2 taps, detours 1 → 0, today empty                                                              |
| 4   | Day parts, „Als Pause“, estimates on the row              | `feat/plan-day-parts`             | planner item row `part?` + migration, `core/plan/{types,engine,windows,explain}.ts`, row ⋯ („Vormittag/Nachmittag/Abend“, „Als Pause“, „dauert 15 Min“), parser „Pause …“/„Freizeit …“ lines                                                | `core/plan/**` (engine)                           | `council`     | C order asserted, „Zocken“ as a break in 2 taps; B unchanged (bare „Zocken“ stays a ToDo)             |
| 5   | Deadline time, reminders „einmal“, trigger words          | `feat/plan-due-time`              | `core/modules/types.ts` (`due.time?`), planner item `due.time` + todos `dueTime` + calendar `once` (migrations), `modules/calendar/notifications.ts`, parser (W06 by trigger words), row texts                                              | `core/modules/types.ts` (contract, additive)      | `council`     | G detours 1 → 0; B detours 2 → 1; reminders from capture/field never repeat                           |
| 6   | „Tagesende“                                               | `feat/plan-day-end`               | `modules/planner/settings.ts`, `core/plan/{capacity,explain}.ts`, `DaySetup.tsx` (row for the three days), planner head line                                                                                                                | `core/plan/**` (engine)                           | `council`     | H 3 → 1 tap, detours 1 → 0; a unit past the end moves to the next day                                 |
| 7   | „Antworten: …“ checklist, „Beantwortet?“ on mail rows     | `feat/mail-answered`              | `quickCapture/parser` + todos adapter (checklist line), `connectors/google/gmail.ts` (`lastLabelIds`), `modules/mail/**` (device flag, row hint, setting), bus event, `docs/legal/{DATA-FLOWS,data-flows-hinweise}.md` + `strings.legal.ts` | none                                              | `council`     | E +1 tap („Erledigt“, with undo); one line → one ToDo with three items                                |
| 8   | Nachmessen                                                | `qa/usecase-wochenende-remeasure` | `web/e2e/usecases/wochenende.spec.ts` (`MAX` to the measured target, assertions), `ANALYSIS.md`/`TARGET.md` (one „measured after“ table)                                                                                                    | none                                              | `review-loop` | every figure of TARGET §4 met, or the difference named with its reason                                |

Each package: own branch from fresh `develop` (after the previous PR is merged), PR against `develop`, a CHATS.md row only for its hotspot and the „Wartet auf Sven“ line moved on, `.changes/` note (DE/EN; package 8: `no-changelog`), STATUS one line in its own `docs(status)` PR, the focus checklist 1–9 answered in the PR text with before/after figures, the use-case script green (`USECASE_SEED_URL` for path E, `E2E_SEED=0` unless the seed project is needed), and the kopf-leer script green when the planner or the capture changes (`e2e/usecases/kopf-leer.spec.ts`: its planner bounds sit exactly at their target). Health guard for every package: the app stores only the typed title – no field, category, flag or inference from words like „krank“, „Arzt“ or „Gesundheit“. Model: Claude Opus (package 8: Fable). UI texts German and English only.

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
- W08/W09: der gewählte Tag zeigt „Verfügbar“ mit Chips „frei · 2 h · 4 h · 6 h · ganzer Tag“ (ganzer Tag = 12 h; Zahlen über `core/i18n/format`) direkt im Tagesbereich, oder ein Tipp öffnet das Tagesblatt; −/+ bleibt für Feinschritte. Neue Strings DE + EN.
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
- Erreichbar: stiller Textlink im Planer-Kopf ab 17:00 (Schalter `focus.eveningWrapUp`), Textaktion im Widget „Wochenlast“ ab 17:00, „Tag abschließen“ im ToDo-Widget ruft bei aktivem Planer über `plan.restRequested` (Event-Bus, kein Modul-Import) statt „Auf morgen schieben“.
- Optionale Benachrichtigung „Für morgen verteilen?“ um 20:00 (vor der Ruhezeit): `soft: true`, über `collectDue`, Schalter in „Ruhige Erinnerungen“, Standard **aus**, höchstens einmal am Tag, nie wiederholt, keine Zahl.
- Mess-Skript Pfad F über den Kopf-Link oder das Widget; Assertion: heute leer danach. `MAX` nicht senken.

## Nicht in diesem Paket
Verteilen ohne Tipp, Änderungen an Engine-Regel 6 (nichts rückt von selbst), Tagesende (6).

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; wochenende-, kopf-leer-Skript und `e2e/planner.spec.ts` grün; Benachrichtigung: Unit-Test Standard aus, einmal am Tag, 20:00 außerhalb der Ruhezeit.
- Zahlen: F 9 → 2 Taps, 1 → 0 Umwege; Fokus-Checkliste 1–9; Entfernt: „Auf morgen schieben“ bei aktivem Planer.
- Docs: Entscheidungs-Bullet in docs/decisions/plan.md (Op und Ereignis), `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` über den Diff (Guardian: nichts verschiebt sich ohne Tipp, Rückgängig stellt alles her, Benachrichtigung aus und gedrosselt; Advocate: ein ruhiger Satz, keine Zahl des Liegengebliebenen; Architect: ops wie `moveAll`, deterministisch, Ereignis additiv, kein Modul-Import), dann `full stop`.
```

### Prompt – package 4: day parts, „Als Pause“, estimates (`feat/plan-day-parts`)

```
# Aufgabe: Wochenende retten – Tagesabschnitte, „Als Pause“, Dauer an der Zeile (Paket 4 von 8)

Routing: Claude Code · Wochenende Paket 4 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-day-parts` von frischem `develop` – nach dem Merge von Paket 3. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/plan/**` (Engine), ein Chat. `core/modules/types.ts` bleibt unberührt. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q2 a, Zielbild TARGET.md F2 (mittel), Reibung W05, W11, W12; planner CONCEPT §3 (Regeln 1–8). Lies `core/plan/{types,engine,windows,explain}.ts` (Reihenfolge im Tag `engine.ts:216–233`, `isMain` Z. 78), `modules/planner/{schema,migrations,manifest}.ts`, `core/plan/instructions.ts` (op `duration`), `modules/todos/components/TaskEditor.tsx:50` (`ESTIMATES = [5, 15, 30, 60]`), `quickCapture/parser/index.ts`.

## Pflichtliste
- Planer-intern: `part?: 'morning' | 'afternoon' | 'evening'` an der eigenen Planer-Zeile (`manifest.version` + Migration) und an `PlanItem`/`PlanBlocker` in `core/plan`. **Kein** Feld in `contributions.plannable`.
- Engine-Vergleich im Tag: Stufe (festgenagelt, Frist, Rest – wie heute) → Abschnitt (ohne Abschnitt zuerst, dann Vormittag, Nachmittag, Abend) → die heutigen Schlüssel. Tage wählt die Engine wie bisher; ein Abschnitt ändert nie den Tag. Mit Zeitfenster: drei gleiche Drittel, eine Einheit bekommt Zeit in ihrem Drittel; passt sie dort nicht, den nächsten freien Platz später im Fenster, sonst keine Zeit (wie heute). Fixtures: Determinismus, Fixpunkt, „Abschnitt ändert nie den Tag“, Drittel-Überlauf; `explain` DE + EN.
- Zeile ⋯: „Vormittag · Nachmittag · Abend · Ohne“, „Als Pause“ (das ToDo wird für diesen Tag ein Blocker seiner Länge, Rückgängig), „dauert 5/15/30/60 Min“ (die bestehenden Werte; unter 30 Min ist es schon kein Hauptding). Planer-Feld: „Duschen nachmittags“, „Bude abends“, „Duschen 15 Min“.
- Schnellerfassung: Zeilen, die mit „Pause“ oder „Freizeit“ beginnen, werden bei aktivem Planer ein Blocker, sonst ein ToDo. Ein bloßes „Zocken“ bleibt ein ToDo – die App rät nicht, was Freizeit ist.
- Eine Pause zeigt ihre eigene Länge wie jeder Blocker; keine Summe, keine Bewertung, keine Freizeit-Summe über Tage, kein Widget.
- Gegen-Szenarien im PR: Werktag mit Bürozeiten (Vormittag für Fokusarbeit), ohne Mail, Planer aus.
- Mess-Skript Pfad C: Abschnitte und „Als Pause“, Reihenfolge per Assertion; Pfad B unverändert; `MAX` nicht senken.

## Nicht in diesem Paket
Uhrzeit-Planung mit Ziehen, Tagesende (6), Fristen-Uhrzeit (5), Vertragsänderung.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e`; `db:bump` falls ein Index sich ändert; Engine-Fixtures und Migrations-Test; wochenende-, kopf-leer-Skript, `e2e/planner.spec.ts` grün.
- Zahlen: C Reihenfolge Vormittag → Nachmittag → Abend, „Zocken“ als Pause in 2 Taps; Fokus-Checkliste 1–9.
- Docs: CONCEPT §3 eine Zeile (Regel 5 Abschnitt), Entscheidungs-Bullet nur bei Abweichung, `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Freizeit-Zählung, keine Daten über Spielen, Migration verlustfrei; Advocate: Abschnitt optional und hinter ⋯, keine neue Unruhe auf dem Brett; Architect: Vergleich wie beschrieben, deterministisch, Fixpunkt, keine Vertragsänderung, keine Modul-Importe), dann `full stop`.
```

### Prompt – package 5: deadline time, reminders „einmal“ (`feat/plan-due-time`)

```
# Aufgabe: Wochenende retten – Frist mit Uhrzeit, Erinnerungen „einmal“, Erinnerung nur mit Auslösewort (Paket 5 von 8)

Routing: Claude Code · Wochenende Paket 5 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-due-time` von frischem `develop` – nach dem Merge von Paket 4. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/modules/types.ts` (Vertrag `plannable`, additiv). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q4 a (nur Selbstgesetztes, einmal zur Uhrzeit, nie wiederholt; „1 Std vorher“ nur auf Wunsch), Zielbild TARGET.md F4 (mittel), Reibung W06, W21. Lies `core/modules/types.ts` (`PlannableItem.due`), `modules/planner/schema.ts:43` (`due: {date, hard}`), `modules/todos/{schema,migrations,manifest,plannable}.ts`, `modules/calendar/{schema,migrations,manifest,notifications}.ts` (Z. 78: Wiederholungsreihe für jede `kind: 'reminder'`), `core/notifications/policy.ts`, `quickCapture/targets/adapters.ts:52` (heute „Uhrzeit: …“ als Notiz), docs/features/repeat-reminders.md, docs/legal/DATA-FLOWS.md Zeile `push`.

## Pflichtliste
- Vertrag additiv `due.time?: 'HH:mm'`; Planer-Zeile `due.time` und ToDo `dueTime?` (je `manifest.version` + Migration). Die Engine plant weiter nach Tag (unverändert, Test).
- Zeile „Frist So 18:00“, danach „Frist war So 18:00“ (Glossar), nie rot. ToDo-Seite zeigt die Uhrzeit. Parser und Planer-Feld schreiben die Uhrzeit in `dueTime` statt in die Notiz.
- Kalender-Feld `once?` an Ereignissen (`manifest.version` + Migration); `notifications.ts` erzeugt dafür keine Wiederholungsreihe; die Zeile zeigt „einmal“. Jede Erinnerung aus Schnellerfassung oder Planer-Feld trägt `once`; Erinnerungen aus dem Kalender-Dialog behalten die globale Regel. `limits.test.ts`/`policy.test.ts` unverändert grün, neuer Test „once wiederholt nie“.
- W06: eine Zeile mit Tag und Uhrzeit wird nur mit Auslösewort Erinnerung – „erinnere mich“ (besteht), „falls nötig“, „ggf.“; kein Raten nach Verben. Korpus mit Gegenzeilen („Fr 20 Uhr Kino mit Anna“, „Sa 14 Uhr Fußball“, „Mo 9:30 Teamrunde“ bleiben Termine), ganzer Korpus-Diff im PR.
- Opt-in je Frist „Erinnern: 1 Std vorher“ (Standard aus) als Kalender-Erinnerung mit `once`. Kein neuer Benachrichtigungstyp, kein neuer Datenfluss: diese Erinnerungen laufen über die bestehende Zeile `push` (nur der getippte Titel).
- Kein Gesundheitsbezug: kein Feld, keine Kategorie, keine Ableitung aus dem Titel (Test: „krankmelden falls nötig“ wird gespeichert wie getippt, nichts wird daraus abgeleitet).
- Mess-Skript Pfade B und G; `MAX` nicht senken.

## Nicht in diesem Paket
Stundengenaue Planung, neue Benachrichtigungsarten, Änderungen an der globalen Wiederholung oder an `core/notifications/policy.ts`.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Migrations-Tests (Planer, ToDos, Kalender); Korpus; wochenende-, kopf-leer-Skript, `e2e/reminders.spec.ts` grün.
- Zahlen: G Umwege 1 → 0 (ToDo trägt So 18:00, keine Notizzeile), B Umwege 2 → 1; Erinnerungen aus Pfad G wiederholen nie; Fokus-Checkliste 1–9; Entfernt: Notizzeile „Uhrzeit: …“ bei Fristen.
- Docs: docs/features/repeat-reminders.md ein Satz, Entscheidungs-Bullet nur bei Abweichung, `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Gesundheitsdaten, Erinnerung nur auf Wunsch und einmal, keine neue Datenweitergabe; Advocate: ruhige Texte, nie rot, „einmal“ sichtbar; Architect: Vertrag additiv, drei Migrationen, Zeiten `HH:mm` lokal über `core/time`, keine Modul-Importe), dann `full stop`.
```

### Prompt – package 6: „Tagesende“ (`feat/plan-day-end`)

```
# Aufgabe: Wochenende retten – „Tagesende“: der Plan füllt den Tag nicht darüber hinaus (Paket 6 von 8)

Routing: Claude Code · Wochenende Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-day-end` von frischem `develop` – nach dem Merge von Paket 5 (Paket 7 darf parallel laufen). Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/plan/**`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q3 a, Zielbild TARGET.md F6 (mittel, Fokus-Checkliste besonders streng), Reibung W22. Lies `modules/planner/settings.ts` (Z. 33–72), `core/plan/{capacity,windows,engine,explain}.ts` (`placeInWindow` ist ein Nachlauf, `windows.ts:91`), `DaySetup.tsx` (Paket 2), `core/notifications/policy.ts` (`applyQuiet` schiebt `soft` aus der Ruhezeit an deren Ende – deshalb **keine** Benachrichtigung).

## Pflichtliste
- Einstellungen je Gruppe (Mo–Fr, Sa, So) „Tagesbeginn“ und „Tagesende“, optional, Standard leer.
- Mechanik in einem Durchgang: `raw = min(available, Minuten von Fensterbeginn bis Tagesende) − blockers` in `capacity.ts`; was nicht passt, geht wie jede Überlast weiter (Grund „passt nicht vor dem Tagesende“, DE + EN). Pausen können trotzdem eine Einheit ohne Uhrzeit lassen (wie heute). Ohne Einstellung: alles wie heute (Test). Fixtures: „Einheit nach dem Tagesende wandert“, Fixpunkt.
- Im Blatt „Tage einteilen“ Schritt 2 eine Zeile „Tagesende: 23:00 · 0:00 · keins“ – setzt es nur für die drei gezeigten Tage (Tageszeilen), Rückgängig nimmt es mit zurück.
- Keine Benachrichtigung: ab 30 Min vor dem Tagesende sagt der Planer-Kopf „Bald ist Tagesende.“ (nur in der App).
- Keine Schlafdaten, keine Zählung, kein Verlauf, keine Wörter wie „zu spät“; die Gewohnheit „Ins Bett bis …“ wird nur in der Nutzerdoku erwähnt (kein Code).
- Mess-Skript Pfad H über das Blatt; Assertion: eine Einheit nach dem Tagesende geht auf den nächsten Tag; der Umweg in H wird am Zustand gezählt. `MAX` nicht senken.

## Nicht in diesem Paket
Gewohnheiten-Code, Schlaf-Tracking, Benachrichtigungen, Änderungen an der Ruhezeit 22–07.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Engine-Fixtures; wochenende-, kopf-leer-Skript, `e2e/planner.spec.ts` grün.
- Zahlen: H 3 → 1 Tap, 1 → 0 Umwege; Fokus-Checkliste 1–9 (streng, im PR begründet); Entfernt: Fenster-Eingabe auf der Einstellungsseite als einziger Weg.
- Docs: CONCEPT §3 eine Zeile, Nutzerdoku DE + EN, `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Schlaf- oder Gesundheitsdaten; Advocate: kein Tadel, nur ein Kopfsatz, ruhig; Architect: Deckel in `capacity.ts`, ein Durchgang, deterministisch, Fixpunkt, Einstellung additiv), dann `full stop`.
```

### Prompt – package 7: reply things (`feat/mail-answered`)

```
# Aufgabe: Wochenende retten – „Antworten: …“ als ein Ding mit Liste, „Beantwortet?“ an der Mail-Zeile (Paket 7 von 8)

Routing: Claude Code · Wochenende Paket 7 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/mail-answered` von frischem `develop` – nach dem Merge von Paket 5, parallel zu Paket 6 (keine gemeinsame Datei; mit `chats:status` prüfen). Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild TARGET.md F5 (a und b, zwei Commits), Reibung W17; docs/legal/DATA-FLOWS.md Zeile `google`, docs/legal/data-flows-hinweise.md („Mail → ToDo“: kein neues Feld auf der synchronisierten Seite). Lies `connectors/google/gmail.ts` (`summarize` Z. 182–192: `labelIds` ist die Vereinigung aller Nachrichten – für „zuletzt von mir“ ungeeignet), `modules/mail/{planMail,useMailbox,cache,notifyService,manifest}.ts` (Sammlungen gerätelokal, `dataApi: false`), `core/mail/heuristics.ts`, todos-Checkliste, `quickCapture/parser`.

## Pflichtliste
- (a) Zeile „Antworten: Anna, Vermieter, Team“ (nur mit Wort und Doppelpunkt) → ein ToDo „Antworten“ mit drei Checklistenpunkten. Korpus-Test.
- (b) `summarize` liefert zusätzlich `lastLabelIds` (Labels der letzten Nachricht). Beim Öffnen oder Aktualisieren der Mail-Liste durch die Person – **nie** aus dem Hintergrund-Check `notifyService` – bekommt ein Thread, der „In den Plan“ ging und dessen letzte Nachricht `SENT` trägt, ein Kennzeichen nur im gerätelokalen Mail-Cache (`local: true`, `dataApi: false`; nie synchronisiert, nie Feld am ToDo oder an der Plan-Zeile, nie an eine KI). Die Mail-Zeile zeigt „Beantwortet? · Erledigt“; „Erledigt“ schickt `plan.doneRequested` (nur die Eintrags-Id) über den Bus, die ToDos schließen es, Hinweis „Erledigt · Rückgängig“. Nichts schließt von selbst. Einstellung „Beantwortet anzeigen“ in den Mail-Einstellungen (nur Anzeige, Standard an). Test: Form der synchronisierten ToDo-Zeile unverändert; Kennzeichen nicht aus `notifyService`.
- DATA-FLOWS `google`, data-flows-hinweise „Mail → ToDo“ und `strings.legal.ts` (DE/EN): „ob die letzte Nachricht von dir ist (nur auf dem Gerät)“; `core/legal/legal.test.ts` grün.
- Mess-Skript Pfad E: Seed-Thread mit eigener letzter Nachricht (Seed-Version erhöhen) → 1 Tap mit Rückgängig. `MAX` nicht senken.

## Nicht in diesem Paket
WhatsApp (kein Connector, kein Link), Antwort-Entwürfe, gemeinsamer OAuth-Client (W15), ein Hinweis an der Plan-Zeile.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `USECASE_SEED_URL=… npx playwright test e2e/usecases/wochenende.spec.ts e2e/usecases/kopf-leer.spec.ts --project=desktop-chrome`; Seed-Registry-Test; `core/mail/isolation.test.ts` grün.
- Zahlen: E „Erledigt“ 1 Tap mit Rückgängig; eine Zeile → ein ToDo mit drei Punkten; Fokus-Checkliste 1–9.
- Docs: DATA-FLOWS, data-flows-hinweise, `.changes/`, STATUS im eigenen PR.

## Skills
`council` (Guardian: nur ein gerätelokales Kennzeichen, kein Inhalt, nie aus dem Hintergrund, Datenschutz-Aussagen stimmen, nie automatisch erledigt; Advocate: eine Frage, Rückgängig; Architect: letzte Nachricht statt Vereinigung, Bus statt Import, kein neuer Scope, Seed deterministisch), dann `full stop`.
```

### Prompt – package 8: Nachmessen (`qa/usecase-wochenende-remeasure`)

```
# Aufgabe: Wochenende retten – Nachmessen nach den Paketen 1–7 (Paket 8 von 8)

Routing: Claude Code · Wochenende Paket 8 · Fable
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `qa/usecase-wochenende-remeasure` von frischem `develop` – nach dem Merge aller Pakete. Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielzahlen: docs/design/usecases/wochenende/TARGET.md §4; Messmodell und Pfade: ANALYSIS.md §2, `web/e2e/usecases/wochenende.spec.ts`.

## Pflichtliste
- Alle Pfade A–H auf leerer Installation neu messen (1920 und Pixel 7, hell/dunkel; Pfad E mit `USECASE_SEED_URL`); `MAX` auf die gemessenen Werte senken, wo das Ziel erreicht ist; wo nicht, beim gemessenen Wert lassen und den Grund im Kommentar über `MAX` nennen.
- Zielzustände direkt prüfen: Sonntag hat Zeilen, heute ist nach „Rest verteilen“ leer, Frist So 18:00 am ToDo, nur das bloße „Zocken“ landet als etwas anderes, Erinnerungen aus der Erfassung wiederholen nie, eine Einheit nach dem Tagesende wandert.
- ANALYSIS.md und TARGET.md: je eine Tabelle „gemessen nach den Paketen“ (keine Historie, ein Absatz).

## Nicht in diesem Paket
Produktcode. Was beim Messen auffällt: neue Zeile in der Reibungstabelle (W23 …) und im PR-Text, kein Fix.

## Abnahme
- Skript dreimal hintereinander grün; `check:docs`; Label `no-changelog`; STATUS-Zeile „Use case Wochenende: nachgemessen“ im eigenen `docs(status)`-PR; „Wartet auf Sven“-Zeile raus.

## Skills
`review-loop` (eine Runde), dann `full stop`.
```
