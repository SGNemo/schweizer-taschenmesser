# Use case „Wochenende retten“ – packages (phase 3, final prompts)

Decisions: [TARGET.md](TARGET.md) §5 answered 2026-11-14 with the recommended options (Q1 a, Q2 a, Q3 a, Q4 a), recorded in [`docs/decisions/features-wochenende.md`](../../../decisions/features-wochenende.md) – a package adds a decision bullet **only where it builds differently**. Friction ids: [ANALYSIS.md](ANALYSIS.md) (W01–W22). One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Template: kopf-leer's package plan (git history, `9113e74d1^:docs/design/usecases/kopf-leer/PACKAGES.md`).

**Order:** 1 → 2 → 3 → 4 → 5 → 6 → 8, package 7 in parallel to 2–6 once 1 is merged (other files). Serial because 1–6 all touch `modules/planner/**` (and 4–6 the contract in `core/modules/types.ts`, a hotspot: one chat at a time). Not now (own decision later): a shared Google OAuth client (W15), auto-enabling time tracking (W14).

| #   | Package                                                           | Branch                            | Scope (short)                                                                                                                                                                                                                | Hotspots to announce (row in CHATS.md „Hotspots“)            | Skill         | Acceptance figures (script `web/e2e/usecases/wochenende.spec.ts`; `MAX` is lowered only in package 8)      |
| --- | ----------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ------------- | ---------------------------------------------------------------------------------------------------------- |
| 1   | Quick fixes: deadline day, parser, day sheet chips, head sentence | `fix/plan-weekend-quick`          | `modules/planner/actions.ts` (W20), `quickCapture/parser/index.ts` (W04, W06), `modules/planner/components/DaySheet.tsx` + `routes/PlannerPage.tsx` (W08, W09, W13), `CaptureForm.tsx` order (W07)                           | none                                                         | `review-loop` | B: detours 3 → 1 (only „Zocken“ left); C: 23 → ≤ 9 taps; G: detours 2 → 0                                  |
| 2   | „Tage einteilen“ – the three-step sheet                           | `feat/plan-days-setup`            | new `modules/planner/components/DaySetup.tsx`, `routes/PlannerPage.tsx` (empty state, `?start=1`), `layout/setup/WelcomeCard.tsx` (second action), strings                                                                   | `layout/setup/WelcomeCard.tsx` (core setup, small)           | `review-loop` | A: 10 → 1 tap, 3 → 1 screen, 1 → 0 detours; C: ≤ 4 taps, 0 keys, 1 dialog; Sunday gets things              |
| 3   | „Rest verteilen“ in the evening                                   | `feat/plan-rest-evening`          | `modules/planner/{actions,run}.ts` (op), `core/plan/instructions.ts` (sentence), `routes/PlannerPage.tsx` (head link from 17:00), `widgets/WeekWidget.tsx`, `todos/widgets/NextWidget.tsx` (bus), optional soft notification | `core/events` types (one event, additive)                    | `council`     | F: 9 → 2 taps, 1 → 0 detours, today empty after it                                                         |
| 4   | Day parts, break block, „kurz“                                    | `feat/plan-day-parts`             | `core/modules/types.ts` (`PlannableItem.part?`), `core/plan/{types,engine,windows,explain}.ts`, planner schema + migration, row ⋯, `quickCapture/parser` („Pause“, „Freizeit“), todos estimate chip                          | `core/modules/types.ts` (contract, additive), `core/plan/**` | `council`     | B: detours 1 → 0; C: Saturday takes ≥ 6 small things in 6 h; order Vormittag → Nachmittag → Abend asserted |
| 5   | Deadline time, calm reminders                                     | `feat/plan-due-time`              | `core/modules/types.ts` (`due.time?`), todos schema `dueTime` + migration, parser, planner row „Frist So 18:00“, opt-in reminder „1 Std vorher“ (once, no repeat)                                                            | `core/modules/types.ts` (contract, additive)                 | `council`     | G: the ToDo carries Sunday 18:00, no note line; reminders from this path never repeat                      |
| 6   | „Tagesende“                                                       | `feat/plan-day-end`               | `modules/planner/settings.ts`, `core/plan/{windows,engine,explain}.ts`, `DaySetup.tsx` (question), soft hint (off by default)                                                                                                | `core/plan/**`                                               | `council`     | H: 3 → 1 tap (in the sheet), 1 → 0 detours; a unit past the end moves to the next day                      |
| 7   | Reply things: „Antworten: …“ checklist, „Beantwortet?“            | `feat/mail-answered`              | `quickCapture/parser` + todos adapter (checklist line), `modules/mail/**` (sent-last flag on fetched threads), planner row hint over the bus, `docs/legal/DATA-FLOWS.md` + `strings.legal.ts`                                | none                                                         | `council`     | E: „Beantwortet? · Erledigt“ 1 tap; one line „Antworten: A, B, C“ → one ToDo with three items              |
| 8   | Nachmessen                                                        | `qa/usecase-wochenende-remeasure` | `web/e2e/usecases/wochenende.spec.ts` (`MAX` to the measured target, new assertions), `ANALYSIS.md`/`TARGET.md` (one „measured after“ table)                                                                                 | none                                                         | `review-loop` | every figure of TARGET §4 met, or the difference named with its reason                                     |

Each package: own branch from fresh `develop` (after the previous PR is merged), PR against `develop`, a CHATS.md row only for its hotspot and the „Wartet auf Sven“ line moved on, `.changes/` note (DE/EN; package 8: `no-changelog`), STATUS one line in its own `docs(status)` PR, the focus checklist 1–9 answered in the PR text with before/after figures, the use-case script green (`USECASE_SEED_URL` for path E, `E2E_SEED=0` unless the seed project is needed), and the kopf-leer script green when the planner or the capture changes (`e2e/usecases/kopf-leer.spec.ts`: its planner bounds sit exactly at their target). Model: Claude Opus (package 8: Fable). UI texts German and English only.

### Prompt – package 1: quick fixes (`fix/plan-weekend-quick`)

```
# Aufgabe: Wochenende retten – Frist am richtigen Tag, Parser, Tagesblatt mit Chips, ruhiger Kopfsatz (Paket 1 von 8)

Routing: Claude Code · Wochenende Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `fix/plan-weekend-quick` von frischem `develop`. Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild freigegeben: docs/design/usecases/wochenende/TARGET.md (§1 „Auffindbarkeit/Default“, F1 kleinster Schritt, F4 kleinster Schritt), Reibung in ANALYSIS.md W04, W06, W07, W08, W09, W13, W20; Entscheidungen docs/decisions/features-wochenende.md. Lies `modules/planner/actions.ts` (`addFromField`, Z. 177–195: die Frist kommt aus `extractDuePhrase`, das Datum des ToDos aber aus dem Rest-Text „… 18:00“ → heute), `modules/planner/dueWords.ts`, `quickCapture/parser/index.ts` (Z. 59, 76, 105–106, 280–312: Datum + Uhrzeit wird Termin), `modules/planner/components/DaySheet.tsx` (Stepper Z. 75–90, `AVAILABLE_STEP` in `actions.ts:263`), `routes/PlannerPage.tsx` (Z. 340–347 Kopfsatz, Z. 569 und 776: erst Tag wählen, dann Kopf erneut tippen), `quickCapture/ui/CaptureForm.tsx` (Reihenfolge der Vorschauzeilen).

## Pflichtliste
- W20 (Fehler): im Planer-Feld gewinnt die Frist der „bis/Frist <Tag>“-Phrase auch für das Datum des ToDos; eine Uhrzeit im Rest bleibt wie heute nur als Notizzeile (die Uhrzeit als Feld kommt in Paket 5). Unit-Test: „Team-Sachen lesen bis So 18:00“ am Samstag → ToDo-Datum = Planer-Frist = Sonntag.
- W04: Schnellerfassung – „bis/spätestens <Tag> [<Uhrzeit>]“ macht ein ToDo mit Fälligkeit (nicht Termin); Korpus um die Zeilen aus ANALYSIS §2 (Pfad B) erweitern; „Termin bis 18 Uhr“ und „Mo 9:30 Teamrunde“ bleiben Termine.
- W06: „<Tag> <Uhrzeit> <Verb …>“ ohne Termin-Wort (Termin, Treffen, Arzt, Meeting, Call, Teamrunde, Besprechung …; Liste im Parser, Test) wird Erinnerung (`kind: 'reminder'`, blockt keine Planzeit). Titel genau wie getippt – keine Wörter dazu.
- W07: in der Mehrzeilen-Vorschau stehen Zeilen, die kein ToDo werden, oben (oder eine Zusammenfassung „9 ToDos · 2 Erinnerungen“ über den Zeilen – du entscheidest, im PR begründen).
- W08/W09: der gewählte Tag zeigt „Verfügbar“ mit Chips „frei · 2 Std · 4 Std · 6 Std · ganzer Tag“ (ganzer Tag = 12 Std) direkt im Tagesbereich bzw. ein Tipp öffnet das Tagesblatt; −/+ bleibt für Feinschritte. Neue Strings DE + EN.
- W13: leerer Planer-Kopf ohne Widerspruch: „Noch nichts geplant – heute <frei> frei.“ (FOCUS-WORDING-Zeile „Day plan head“ ergänzen).
- Mess-Skript `web/e2e/usecases/wochenende.spec.ts`: Pfad C nutzt die Chips (Zählung ehrlich anpassen, die Wege bleiben die einer Person ohne Vorwissen), Pfade B, C, G grün; `MAX` **nicht** senken (Paket 8). kopf-leer-Skript grün.

## Nicht in diesem Paket
Das Blatt „Tage einteilen“ (Paket 2), Pause als Blocker (4), Uhrzeit als Fristfeld (5), Vertrags- oder Engine-Änderungen, Modul-Standards.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `E2E_SEED=0 npx playwright test e2e/usecases/wochenende.spec.ts e2e/usecases/kopf-leer.spec.ts e2e/planner.spec.ts e2e/quick-capture.spec.ts`; `npx vitest run src/quickCapture src/modules/planner`.
- Zahlen vorher/nachher im PR-Text: B Umwege 3 → 1, C Taps 23 → ≤ 9, G Umwege 2 → 0; Fokus-Checkliste 1–9; Entfernt: der widersprüchliche Kopfsatz.
- Docs: `.changes/` (DE/EN), STATUS-Zeile im eigenen `docs(status)`-PR, „Wartet auf Sven“-Zeile auf Paket 2 weiterstellen.

## Skills
`review-loop` (ein Opus-Reviewer: Parser-Korpus und Gegen-Szenario Werktag mit Terminen, Wording nach FOCUS-WORDING, keine Gesundheitswörter in Daten oder Texten), dann `full stop`.
```

### Prompt – package 2: „Tage einteilen“ (`feat/plan-days-setup`)

```
# Aufgabe: Wochenende retten – „Tage einteilen“: ein Blatt in drei Schritten, von der Willkommenskarte und dem leeren Planer (Paket 2 von 8)

Routing: Claude Code · Wochenende Paket 2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-days-setup` von frischem `develop` – nach dem Merge von Paket 1. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `layout/setup/WelcomeCard.tsx` (eine zweite Aktion). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q1 a (docs/decisions/features-wochenende.md), Zielbild TARGET.md F1 (mittel), Reibung W01, W02, W03, W10. Lies `layout/setup/WelcomeCard.tsx`, docs/rules/core-privacy.md (Einrichtung: nie Daten im Fortschritt, nie eine Nörgelei), `core/setup/profiles.ts` (bleibt unverändert), `quickCapture/targets/index.ts` (`saveCaptures`), `modules/planner/actions.ts` (`setAvailable`, Vorschau `showPreview`), `components/PlanPreview.tsx`, die Chips aus Paket 1.

## Pflichtliste
- `modules/planner/components/DaySetup.tsx`: Schritt 1 „Was steht an?“ (Mehrzeilenfeld der Schnellerfassung, eine Zeile = ein Ding, Entwurf bleibt beim Schließen), Schritt 2 „Wie viel Zeit hast du?“ (heute und die zwei nächsten Tage als Zeilen mit den Chips aus Paket 1; schreibt Tageszeilen, nie die Wochentags-Standards), Schritt 3 Vorschau des Planers („Neu im Plan“ je Tag) → „Übernehmen“ / „Zurück“; ein Rückgängig für alles („Eingeplant: Sa, So, Mo · Rückgängig“). Ein Hauptknopf je Schritt.
- Erreichbar: Willkommenskarte zweite Aktion „Tage einteilen“ (öffnet `/planner?start=1`, schaltet `planner` (+ `todos` über `requires`) ein, schaltet nichts aus), leerer Planer (ersetzt die Leere-Zustand-Aktion), Planer-⋯. Nie von selbst geöffnet. Nach dem Schließen ist die Planer-Gruppe in der Seitenleiste offen (W03).
- Gegen-Szenarien im PR prüfen: Werktag mit Bürozeiten als Terminen (die Termine blocken weiter), jemand ohne Mail-Modul (unverändert), Planer aus (die Karte schaltet ihn nur auf Tipp ein).
- Mess-Skript: Pfade A und C gehen über das Blatt (ehrliche Zählung); Sonntag nimmt Dinge auf (Assertion); `MAX` nicht senken.

## Nicht in diesem Paket
Tagesabschnitte (4), Tagesende (6), Änderungen an den Profilen oder den Einrichtungsfragen, neue Verträge (der Einstieg ist ein Link, keine neue Contribution).

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `e2e/a11y.spec.ts` um das Blatt; wochenende- und kopf-leer-Skript grün; `e2e/setup.spec.ts` grün.
- Zahlen: A 10 → 1 Tap, 3 → 1 Bildschirm, 1 → 0 Umwege; C ≤ 4 Taps, 0 Tasten; Fokus-Checkliste 1–9; Entfernt: Stepper als erster Weg.
- Docs: `docs/features/` Planer zwei Sätze, Nutzerdoku `docs/user/` DE + EN (`check:readme`), `.changes/`, STATUS im eigenen PR, CHATS-Hotspot-Zeile raus im letzten Commit.

## Skills
`review-loop` (Opus-Reviewer: Einrichtung ohne Daten im Fortschritt, nichts öffnet sich von selbst, ein Hauptknopf je Schritt, AA-Kontrast, 44 px), dann `full stop`.
```

### Prompt – package 3: „Rest verteilen“ (`feat/plan-rest-evening`)

```
# Aufgabe: Wochenende retten – „Rest verteilen“ am Abend in einem Tipp, mit Vorschau (Paket 3 von 8)

Routing: Claude Code · Wochenende Paket 3 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-rest-evening` von frischem `develop` – nach dem Merge von Paket 2. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/events` (ein Ereignis `plan.restRequested`, additiv). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild TARGET.md F3 (mittel), Reibung W18, W19; FOCUS-GUIDELINES „Notification limits“. Lies `modules/planner/actions.ts` (`later`, `showPreview`, ops), `core/plan/instructions.ts` (Z. 224–228), `routes/PlannerPage.tsx` (Kopf-⋯ Z. 349–356, Textlink „Woche prüfen“ als Muster), `widgets/WeekWidget.tsx`, `modules/todos/widgets/NextWidget.tsx` (Z. 86, 104 „Tag abschließen“), `modules/todos/progress.ts:125`, `core/notifications/policy.ts`.

## Pflichtliste
- Op `restToTomorrow` = für jede offene Einheit von heute `earliest = morgen` (wie „Später“) + ein Lauf; als Vorschau („Verschoben · Sa → So …“) → „Übernehmen“; Rückgängig-Hinweis „Auf die nächsten Tage verteilt. · Rückgängig“. Pure Funktion der heutigen Einheiten (Unit-Test: deterministisch, Fixpunkt danach).
- Planer-Feld versteht „Rest verteilen“, „Rest auf morgen“.
- Erreichbar: stiller Textlink im Planer-Kopf ab 17:00 (Schalter `focus.eveningWrapUp`), Textaktion im Widget „Wochenlast“ ab 17:00, „Tag abschließen“ im ToDo-Widget ruft bei aktivem Planer über `plan.restRequested` (Event-Bus, kein Modul-Import) statt „Auf morgen schieben“.
- Optionale Abend-Benachrichtigung „Heute bleibt etwas offen. Verteilen?“: `soft: true`, über `collectDue`, Schalter in „Ruhige Erinnerungen“, Standard **aus**, höchstens einmal am Tag, keine Wiederholung.
- Mess-Skript Pfad F über den Kopf-Link; Assertion: heute leer danach. `MAX` nicht senken.

## Nicht in diesem Paket
Automatisches Verteilen ohne Tipp, Änderungen an der Engine-Regel 6 (nichts rückt von selbst), Tagesende (6).

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; wochenende-, kopf-leer-Skript und `e2e/planner.spec.ts` grün; Benachrichtigung: Unit-Test für Standard aus und einmal am Tag.
- Zahlen: F 9 → 2 Taps, 1 → 0 Umwege; Fokus-Checkliste 1–9; Entfernt: „Auf morgen schieben“ bei aktivem Planer.
- Docs: Entscheidungs-Bullet in docs/decisions/plan.md (Op und Ereignis), `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` über den Diff (Guardian: nichts verschiebt sich ohne Tipp, Rückgängig stellt alles her, Benachrichtigung aus und gedrosselt; Advocate: ein ruhiger Satz, keine Zahl des Liegengebliebenen auf dem Bildschirm; Architect: Op deterministisch, Ereignis additiv, kein Modul-Import), dann `full stop`.
```

### Prompt – package 4: day parts, break block, „kurz“ (`feat/plan-day-parts`)

```
# Aufgabe: Wochenende retten – Tagesabschnitte, Pause als Block, kurze Dinge füllen den Tag (Paket 4 von 8)

Routing: Claude Code · Wochenende Paket 4 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-day-parts` von frischem `develop` – nach dem Merge von Paket 3. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/modules/types.ts` (Vertrag `plannable`, additiv) und `core/plan/**`, ein Chat. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q2 a, Zielbild TARGET.md F2 (mittel), Reibung W05, W11, W12; planner CONCEPT §3 (Regeln 1–8), §4 (`plannable`). Lies `core/modules/types.ts` (Z. 582–666), `core/plan/{types,engine,windows,explain}.ts`, `modules/planner/{schema,migrations,manifest}.ts`, `quickCapture/parser/index.ts`, `modules/todos` Schätz-Chips, `core/settings/focus.ts:97` (`planLimit`).

## Pflichtliste
- Vertrag additiv: `PlannableItem.part?: 'morning' | 'afternoon' | 'evening'`, Planer-Zeile `part?` (eigene Tabelle, `manifest.version` + Migration), `PlanBlocker.part?`. Kein `aiSchema`.
- Engine: innerhalb eines Tages zuerst nach Abschnitt (ohne Abschnitt: wie heute), Tage wählt die Engine wie bisher; mit Zeitfenster wird es in drei gleiche Teile geteilt und Einheiten bekommen Zeiten in ihrem Teil. Fixtures: Determinismus, Fixpunkt, „Abschnitt verschiebt nie den Tag“; `explain` Satz je Grund DE + EN.
- Zeile ⋯: „Vormittag · Nachmittag · Abend · Ohne“; Planer-Feld: „Duschen nachmittags“, „Bude abends“.
- Pause: Blocker mit optionalem Abschnitt oder Zeit; Schnellerfassung liest „Pause …“/„Freizeit …“ (nur diese Wörter) als Blocker-Zeile (bei aktivem Planer, sonst ToDo). Eine Pause wird nie gezählt, summiert, bewertet oder in einem Widget gezeigt.
- „kurz (≤ 15 Min)“-Schätzung: zählt nicht als Hauptding (`MAIN_THRESHOLD_MIN`), füllt freie Minuten (W11).
- Gegen-Szenarien im PR: Werktag mit Bürozeiten (Vormittag für Fokusarbeit), ohne Mail, Planer aus (ToDos zeigen nichts Neues).
- Mess-Skript Pfade B und C (Abschnitte, Pause); `MAX` nicht senken.

## Nicht in diesem Paket
Uhrzeit-Planung mit Ziehen, Tagesende (6), Fristen-Uhrzeit (5).

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e`, `db:bump` falls Index geändert; Engine-Fixtures und Migrations-Test; wochenende-, kopf-leer-Skript, `e2e/planner.spec.ts` grün.
- Zahlen: B Umwege 1 → 0; C Samstag nimmt in 6 Std ≥ 6 kurze Dinge; Reihenfolge Vormittag → Nachmittag → Abend per Assertion; Fokus-Checkliste 1–9.
- Docs: CONCEPT §3 eine Zeile (Regel 5 Abschnitt), Entscheidungs-Bullet nur bei Abweichung, `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Freizeit-Zählung, keine Daten über Spielen, Migration verlustfrei; Advocate: Abschnitt optional und hinter ⋯, keine neue Unruhe auf dem Brett; Architect: Vertrag additiv, Engine deterministisch, LWW feldweise unberührt, keine Modul-Importe), dann `full stop`.
```

### Prompt – package 5: deadline time, calm reminders (`feat/plan-due-time`)

```
# Aufgabe: Wochenende retten – Frist mit Uhrzeit, eine ruhige Erinnerung auf Wunsch (Paket 5 von 8)

Routing: Claude Code · Wochenende Paket 5 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-due-time` von frischem `develop` – nach dem Merge von Paket 4. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/modules/types.ts` (Vertrag, additiv). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q4 a (nur Selbstgesetztes, einmal zur Uhrzeit, nie wiederholt; „1 Std vorher“ nur auf Wunsch), Zielbild TARGET.md F4 (mittel), Reibung W20 (Rest), W21. Lies `core/modules/types.ts` (`PlannableItem.due`), `modules/todos/{schema,migrations,manifest,plannable}.ts`, `quickCapture/targets/adapters.ts:52` (heute „Uhrzeit: …“ als Notiz), Kalender-Erinnerungen (`kind: 'reminder'`), docs/features/repeat-reminders.md, FOCUS-GUIDELINES „Notification limits“.

## Pflichtliste
- Vertrag additiv `due.time?: 'HH:mm'`; ToDo `dueTime?` (`manifest.version` + Migration). Die Engine plant weiter nach Tag (unverändert, Test).
- Zeile „Frist So 18:00“, danach „Frist war So 18:00“ (Glossar), nie rot. ToDo-Seite zeigt die Uhrzeit.
- Parser und Planer-Feld schreiben die Uhrzeit in `dueTime` statt in die Notiz.
- Opt-in je Frist „Erinnern: 1 Std vorher“ (Standard aus) über die bestehende Erinnerungs-Art; Erinnerungen aus diesem Weg und aus Zeilen wie „So 19 Uhr erinnere mich …“ / „Mo 7:30 …“ tragen „nicht wiederholen“ (pro Erinnerung; die globale Wiederholungsregel für alles andere bleibt) – kein neuer Benachrichtigungstyp.
- Kein Gesundheitsbezug: kein Feld, keine Kategorie, keine Ableitung aus dem Titel (Test: der Titel wird gespeichert, wie er getippt wurde).
- Mess-Skript Pfad G; `MAX` nicht senken.

## Nicht in diesem Paket
Stundengenaue Planung, neue Benachrichtigungsarten, Änderungen an der globalen Wiederholung.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Migrations-Test; Korpus; wochenende-, kopf-leer-Skript, `e2e/reminders.spec.ts` grün.
- Zahlen: G – das ToDo trägt So 18:00, keine Notizzeile; Erinnerungen aus Pfad G wiederholen nicht; Fokus-Checkliste 1–9; Entfernt: Notizzeile „Uhrzeit: …“ bei Fristen.
- Docs: docs/features/repeat-reminders.md ein Satz, Entscheidungs-Bullet nur bei Abweichung, `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Gesundheitsdaten, Erinnerung nur auf Wunsch und einmal; Advocate: ruhige Texte, nie rot; Architect: Vertrag additiv, Zeiten `HH:mm` lokal über `core/time`, Migration), dann `full stop`.
```

### Prompt – package 6: „Tagesende“ (`feat/plan-day-end`)

```
# Aufgabe: Wochenende retten – „Tagesende“: der Plan plant nichts danach (Paket 6 von 8)

Routing: Claude Code · Wochenende Paket 6 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-day-end` von frischem `develop` – nach dem Merge von Paket 5. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/plan/**`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entscheidung Q3 a, Zielbild TARGET.md F6 (mittel, Fokus-Checkliste besonders streng), Reibung W22. Lies `modules/planner/settings.ts` (Z. 33–72, Zeitfenster), `core/plan/windows.ts` (Z. 91: was nicht passt, bleibt ohne Uhrzeit), `core/plan/{engine,explain}.ts`, `DaySetup.tsx` (Paket 2), `core/notifications/policy.ts`.

## Pflichtliste
- Einstellungen je Gruppe (Mo–Fr, Sa, So) „Tagesbeginn“ und „Tagesende“, optional, Standard leer. Mit Tagesende ist das Fensterende eine Grenze: eine Einheit, die danach enden würde, passt an dem Tag nicht und geht wie jede Überlast weiter (Grund „passt nicht vor dem Tagesende“). Ohne Einstellung: alles wie heute (Test).
- Im Blatt „Tage einteilen“ Schritt 2 eine Zeile „Tagesende: 23:00 · 0:00 · keins“.
- Optionaler Hinweis „In 30 Min ist Tagesende.“: `soft: true`, Schalter in „Ruhige Erinnerungen“, Standard aus, einmal am Tag, nie wiederholt.
- Keine Schlafdaten, keine Zählung, kein Verlauf, keine Wörter wie „zu spät“; die Gewohnheit „Ins Bett bis …“ wird nur in der Nutzerdoku erwähnt (kein Code).
- Mess-Skript Pfad H über das Blatt; Assertion: eine Einheit nach dem Tagesende geht auf den nächsten Tag. `MAX` nicht senken.

## Nicht in diesem Paket
Gewohnheiten-Code, Schlaf-Tracking, Änderungen an der Ruhezeit 22–07.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Engine-Fixture „nach Tagesende“; wochenende-, kopf-leer-Skript, `e2e/planner.spec.ts` grün.
- Zahlen: H 3 → 1 Tap, 1 → 0 Umwege; Fokus-Checkliste 1–9 (streng, im PR begründet); Entfernt: Fenster-Eingabe auf der Einstellungsseite als einziger Weg.
- Docs: CONCEPT §3 eine Zeile, Nutzerdoku DE + EN, `.changes/`, STATUS im eigenen PR, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Schlaf- oder Gesundheitsdaten; Advocate: kein Tadel, Hinweis aus, ruhig; Architect: Engine deterministisch, Einstellung additiv, Fixpunkt), dann `full stop`.
```

### Prompt – package 7: reply things (`feat/mail-answered`)

```
# Aufgabe: Wochenende retten – „Antworten: …“ als ein Ding mit Liste, „Beantwortet?“ an der Plan-Zeile (Paket 7 von 8)

Routing: Claude Code · Wochenende Paket 7 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/mail-answered` von frischem `develop` – nach dem Merge von Paket 1, parallel zu 2–6 (andere Dateien; `quickCapture/parser/index.ts` vorher mit `chats:status` prüfen). Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Zielbild TARGET.md F5 (a sofort, b als zweiter Schritt – beide in diesem Paket, zwei Commits), Reibung W17; docs/legal/DATA-FLOWS.md Zeile `google`, docs/legal/data-flows-hinweise.md. Lies `modules/mail/{planMail,useMailbox,cache}.ts`, `core/mail/heuristics.ts`, `connectors/google/gmail.ts` (Felder der Listenabfrage), `modules/todos` Checkliste, `quickCapture/parser`.

## Pflichtliste
- (a) Zeile „Antworten: Anna, Vermieter, Team“ (nur mit Wort und Doppelpunkt) → ein ToDo „Antworten“ mit drei Checklistenpunkten. Korpus-Test.
- (b) Beim Abruf der Mail-Liste (wie heute, nie im Hintergrund zusätzlich): ein Thread, der „In den Plan“ ging und dessen letzte Nachricht von dir ist, setzt ein Gerätekennzeichen; Ereignis `plan.answered` auf dem Bus; die Plan-Zeile zeigt „Beantwortet? · Erledigt“ – ein Tipp schließt, nichts schließt von selbst. Einstellung „Beantwortet anzeigen“ (Standard an). Kein Inhalt, kein neuer Scope, nie an die KI.
- DATA-FLOWS `google` + `strings.legal.ts` (DE/EN) um „ob die letzte Nachricht von dir ist (nur Gerät)“; `core/legal/legal.test.ts` grün.
- Mess-Skript Pfad E: Seed-Thread mit eigener letzter Nachricht (Seed-Version erhöhen) → 1 Tap. `MAX` nicht senken.

## Nicht in diesem Paket
WhatsApp (kein Connector, kein Link), Antwort-Entwürfe, gemeinsamer OAuth-Client (W15).

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; `USECASE_SEED_URL=… npx playwright test e2e/usecases/wochenende.spec.ts e2e/usecases/kopf-leer.spec.ts --project=desktop-chrome`; Seed-Registry-Test.
- Zahlen: E „Beantwortet?“ 1 Tap; eine Zeile → ein ToDo mit drei Punkten; Fokus-Checkliste 1–9.
- Docs: DATA-FLOWS, `.changes/`, STATUS im eigenen PR.

## Skills
`council` (Guardian: nur ein Kennzeichen auf dem Gerät, kein Inhalt, Datenschutz-Aussagen stimmen, nie automatisch erledigt; Advocate: eine Frage, kein Druck; Architect: Bus statt Import, kein neuer Scope, Seed deterministisch), dann `full stop`.
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
- Zielzustände direkt prüfen: Sonntag nimmt Dinge auf, heute ist nach „Rest verteilen“ leer, Frist So 18:00 am ToDo, keine Zeile landet als etwas anderes, Einheit nach dem Tagesende wandert.
- ANALYSIS.md und TARGET.md: je eine Tabelle „gemessen nach den Paketen“ (keine Historie, ein Absatz).

## Nicht in diesem Paket
Produktcode. Was beim Messen auffällt: neue Zeile in der Reibungstabelle (W23 …) und im PR-Text, kein Fix.

## Abnahme
- Skript dreimal hintereinander grün; `check:docs`; Label `no-changelog`; STATUS-Zeile „Use case Wochenende: nachgemessen“ im eigenen `docs(status)`-PR; „Wartet auf Sven“-Zeile raus.

## Skills
`review-loop` (eine Runde), dann `full stop`.
```
