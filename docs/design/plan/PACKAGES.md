# Day and week planning – packages (phase 2, final prompts)

Decisions: [CONCEPT.md](CONCEPT.md) §10 „Entschieden“ and [`docs/decisions/plan.md`](../../decisions/plan.md). Template: [identity-v3-audit/02-packages.md](../identity-v3-audit/02-packages.md) Part B. One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. **Package 1 starts only after `feat/identity-v3-frame` is merged.**

| #   | Package                                               | Branch                            | Scope                                                                                                                                                                                                                     | Hotspots to announce                                                                                 | Skills                  |
| --- | ----------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Engine, contract, module, ToDos source                | `feat/plan-core`                  | `core/plan/*`, `contributions.plannable` + `collectPlannable`, `modules/planner/*`, `modules/todos/plannable.ts`, strings + 4 locales, e2e                                                                                | `core/modules/types.ts`, `core/modules/registry.ts` (row in CHATS.md), `strings.ts` block, `db:bump` | council · full stop     |
| 2   | Calendar chips, capture prefix, instructions, preview | `feat/plan-calendar-instructions` | `modules/planner/{calendar,instructions UI}`, `core/plan/instructions.ts`, `modules/todos/today.ts` (skip `kind: 'plan'`), `modules/calendar/routes/CalendarPage.tsx` (link), `quickCapture/{parser,targets}` (`p`)       | `quickCapture/parser` (isolation test), calendar page (small, local)                                 | review loop · full stop |
| 3   | More sources, overload line, automation event         | `feat/plan-sources`               | `core/events/events.ts` (`plan.requested`), `modules/notes` (⋯ „In den Plan“), `modules/invoices/plannable.ts`, `modules/subscriptions/plannable.ts`, `modules/planner/attention.ts`, `modules/todos` (hide „Neu planen“) | `core/events/events.ts` (additive)                                                                   | review loop · full stop |
| 4   | AI: actions, local stage, privacy pins                | `feat/plan-ai`                    | `modules/planner/ai.ts`, `modules/todos/ai.ts` (`estimateMin`), `core/ai/local/prompts/plan.ts` + grammar, `core/ai/privacy.test.ts`, `web/tests/ai/eval-set.json`, e2e „KI aus“                                          | `core/ai/write/*` (additive)                                                                         | council · full stop     |
| 5   | Learning and windows                                  | `feat/plan-learn`                 | `modules/timetrack` (`session.ref`, migration), `modules/habits` (`goal.minutes`, blocks), `planner` windows + timed chips, energy, week review line, templates                                                           | `db:bump`                                                                                            | review loop · full stop |

Each package: own branch from fresh `develop`, PR against `develop`, row in CHATS.md, `.changes/` note (DE/EN), STATUS one line, decisions in `docs/decisions/plan.md`. Package 1 starts after `feat/identity-v3-frame` is merged; 2 after 1; 3 and 4 may run in parallel after 2; 5 last.

### Prompt – package 1: engine, contract, module, ToDos (`feat/plan-core`)

```
# Aufgabe: Planer – Engine, Vertrag `contributions.plannable`, Modul, ToDos als Quelle (Paket 1 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-core` von frischem `develop` – **erst nachdem `feat/identity-v3-frame` gemergt ist** (Hotspot `core/modules/types.ts`; vorher Zeile in docs/CHATS.md „Hotspots“: Manifest-Vertrag, ein Chat). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept freigegeben: docs/design/plan/CONCEPT.md (Entscheidungen in „Entschieden“, Datenmodell §2, Engine §3 mit Prototyp docs/design/plan/engine-proto.mjs, Vertrag §4, Identität §7). Lies dazu web/src/modules/CLAUDE.md, docs/howto/new-module.md, docs/design/FOCUS-GUIDELINES.md, `modules/todos/{schema,next,postpone,today}.ts`, `core/modules/{types,contributions}.ts`, `core/undo`, `core/settings/focus.ts` (`planLimit`).

## Pflichtliste
- `core/plan/{types,capacity,units,engine,diff,explain}.ts`: reine Funktionen, kein `Date.now`, Vertrag wie CONCEPT §3; Regeln 1–8 in dieser Reihenfolge; Fixtures `core/plan/__fixtures__/{s1,s2,s3}.json` aus dem Prototyp (gleiche Eingaben, erwartete Zuweisungen als Snapshot); Tests: Determinismus, Stabilität, Frist, Puffer, Teilung, Limit, Diff-Ursache, Erklärungssatz in 5 Sprachen.
- `core/modules/types.ts`: `PlannableItem`, `PlannableSource`, `contributions.plannable` (lazy); `core/modules/contributions.ts`: `collectPlannable` (fehlerisoliert wie `collectCalendarItems`); `SIGNATURES` + `weekBars`; `registry.test.ts`: `retired` ohne `plannable`; `modules/accounts/__tests__/exclusion.test.ts`: `plannable` ausdrücklich nie.
- `modules/todos/plannable.ts`: `list` (offen, kein `someday`, kein `parentId`, nur aktuelle Wiederholung; `estimateMin`, `priority`, `dueDate` weich, `startDate`/`plannedFor` → `earliest`/Pin nach CONCEPT §2), `onAssign` (schreibt `plannedFor` nur bei Änderung), `onDone`, `onEstimate`; Eintrag im Manifest; Test.
- `modules/planner/`: `npm run gen:module -- planner "Planer"`; Sammlungen `day`, `item`, `assignment` (CONCEPT §2, Indizes `date`, `sourceKey`, `date`), `db:bump`; `repo.ts`; `settings.ts` (Scope `planner`, Werte aus §2, `planLimit` aus `focus` wiederverwenden); `seed.ts` (deterministisch, kleine/mittlere/große Woche, Blocker, ein festgenageltes Ding); `run.ts` (sammelt Quellen + Kalender-Blocker über `collectCalendarItems`, ruft `plan()`, schreibt Zuweisungen in einer Undo-Gruppe, ruft `onAssign`; läuft bei Änderung der Eingaben und auf „Neu verteilen“, Hash der Eingabe in `_meta`); `services.ts` (Start des Laufs, Reaktion auf eigene und ToDo-Schreibungen über `core/db/writeHook` bzw. Live-Query); Seite `/planner` (Wochenbrett nach §1: Spalten Mo–So, Kapazitätszeile, Balken, Zeilen mit Minuten und Grund, Blocker grau, Tageszettel: Verfügbar −/+, Blocker hinzufügen, Tag frei; Eingabefeld → Quick-Capture-Ziel `todo` + Planer-Item; Zeilenaktionen Erledigt / Später / Festnageln / Nicht planen / Öffnen über `ItemRow` + ⋯, alles `undoableWithToast`; „Wartet auf einen freien Tag · n“ als `GroupedList`-Gruppe; Telefon: ein Tag je Bildschirm mit Tagesleiste); Widget `week` (`ProgressList`, Wochenlast Mo–So, heute hervorgehoben, Kontextzeile, Überhang als Text, nie rot, leer mit Aktion); `identity` nach §7 (`indigo`/`sky`, `kennzahl`, `fortschritt`, `weekBars`, `order: 15`), `area: 'plan'`, `layout: 'wide'`, `maturity: 'preview'`, `contributions.onboarding: noOnboarding`, `quickAdd`; Kopf: `PageHeader` mit Figur „3 h 20 frei heute“ + Kontext.
- `@/ui/identity/WeekBars` (Dekoration, ohne Farbe lesbar) + Leerzustands-Motiv.
- Strings `t.planner.*` (Deutsch in `strings.ts`, Block anhängen) + 4 Locales, Glossar-Einträge „Planer, Verfügbar, Blocker, Puffer, festnageln“; `check:i18n`.
- E2E `e2e/planner.spec.ts`: Woche mit Seed, Verfügbar ändern, Eintrag über das Feld, Erledigt + Rückgängig, Festnageln; Seite in `e2e/a11y.spec.ts`.

## Nicht in diesem Paket
Kalender-Chips, Freitext-Anweisungen, KI, weitere Quellen (Notizen, Rechnungen, Abos), Zeitfenster/Energie, Zeiterfassung. Keine Änderung an ToDo-Feldern oder -Seite. Nichts an Tresor, Sync-Regel, Signing.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; `npx vitest run src/core/plan src/core/seed`; die drei Fixtures liefern exakt die Zuweisungen des Prototyps.
- Fokus-Checkliste (FOCUS-GUIDELINES) im PR-Text beantwortet (Reizlast, Aus-Schalter = Modul aus, nächster Schritt, Wortlaut, Unterbrechung, Tests, Lesbarkeit, Klicks, was entfällt).
- Docs: STATUS eine Zeile; `docs/decisions/plan.md` zwei Bullets (Vertrag mit Rückschreib-Callbacks; Zuweisungen gespeichert, nicht je Gerät berechnet); ARCHITECTURE-MAP eine Zeile (`core/plan`, `modules/planner`); MODULE-IDENTITY Tabellenzeile; Abschnitt „Planer“ in `docs/howto/planning-modules.md`; `.changes/`-Notiz (DE/EN, Nutzersicht: „Neues Modul Planer (in Arbeit): verteilt ToDos auf die nächsten Tage nach verfügbarer Zeit“); Zeile in CHATS.md.

## Skills
Nach dem Bau `council` über den Diff (Architect: Vertrag und Modulgrenzen, Engine-Determinismus, keine Modul-Importe; Guardian: was in Sync/Backup landet, `exclusion.test.ts`, keine Uhr in der Engine; Advocate: Fokus-Regeln, Reizlast des Bretts, Verständlichkeit ohne Lesen, Telefon). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge. Ein STOPP vor dem Council, wenn das Datenmodell (§2) oder die Regelreihenfolge (§3) anders ausfallen muss (Frage mit Empfehlung, ≤ 4).
```

### Prompt – package 2: calendar chips, capture prefix, instructions, preview (`feat/plan-calendar-instructions`)

```
# Aufgabe: Planer – Kalender-Chips, Schnellerfassung „p“, Freitext-Anweisungen mit Vorschau (Paket 2 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-calendar-instructions` von frischem `develop` (nach Merge von `feat/plan-core`). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Paket 1 hat Engine, Vertrag, Modul und ToDos-Quelle geliefert (docs/design/plan/CONCEPT.md §1–4, Entscheidungen „Entschieden“). Dieses Paket macht den Plan im Kalender sichtbar, nimmt Einträge mit Präfix an und versteht Sätze wie „Donnerstag frei, schieb alles nach Freitag“ ohne Modell (§6c). Lies `core/ai/write/{rules/parse,targets}.ts`, `quickCapture/parser/{index,dates,endtime}.ts`, `modules/calendar/{calendar,views}.ts`, `modules/todos/today.ts`, `layout/assistant/WritePreview.tsx`.

## Pflichtliste
- `modules/planner/calendar.ts` (`contributions.calendarItems`): je Zuweisung ein ganztägiger Chip `kind: 'plan'`, Titel „Plan · <Titel> <Min>“, `to: /planner?day=`; `modules/todos/today.ts`: `kind === 'plan'` zählt nicht als Termin; `home/AgendaBlock`, `NextEventLine`, Cockpit, Tray prüfen (Chips erscheinen, verdrängen nichts); Kalender-Ansichtsschalter bekommt den Eintrag „Plan“ als Link auf `/planner?week=<Montag>` (kein sechster View, `VIEWS` unverändert).
- `quickCapture/parser`: Präfix `p` und Wort „plan:“ → Typ `plan` (Felder wie `todo` + `estimateMin`, Datum = Pin oder frühester Tag nach Wort „ab“); `quickCapture/targets/adapters.ts`: Ziel `plan` = ToDo über `todo`-Ziel + Planer-Item (`modules/planner` darf nicht importiert werden: Item über `core/db` Manifest-Repo wie die anderen Adapter); Korpus-Fälle, Isolationstest bleibt grün.
- `core/plan/instructions.ts`: Satzmuster aus CONCEPT §6c → Ops; Datumswörter aus `quickCapture/parser/dates.ts`, Zeitfenster aus `endtime.ts`, Ziel-Treffer mit `findTarget`/`withinOneEdit`; unbekannt → Rückfrage-Text, zweideutig → „Meinst du A oder B?“; 30 Tests (Korpus mit allen Mustern, Umlaute gefaltet, Wochentag „nächsten“, „alles von Do nach Fr“).
- `modules/planner/components/PlanPreview.tsx`: Diff (verschoben mit Grund und Verursacher, neu, wartet), „Übernehmen“/„Verwerfen“, danach Undo-Toast; Eingabefeld „Sag dem Plan etwas“ auf der Seite (kein Modell, keine Netzanfrage – Test); „Neu verteilen“ im ⋯-Menü mit Vorschau; „Woche prüfen“-Zettel (Mo–So Verfügbar bestätigen, drei größte Dinge) als Dialog, Montag beim ersten Öffnen angeboten, abschaltbar.
- Fokusrunde aus einer Sitzung: Zeilenaktion „Fokus starten“ → `core/focus/session.ts` + `state.ts` mit den Sitzungsminuten, Pfad `/planner/focus/:item` (Shell-Regel `isFocusPath`), keine ToDo-Importe.

## Nicht in diesem Paket
Modell-Stufen, Cloud, weitere Quellen, Zeitfenster im Stundenraster (Chips bleiben ganztägig), Drag im Kalenderraster.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; `e2e/planner.spec.ts` erweitert: Chip im Kalender, Präfix „p“, Satz „Donnerstag frei“ → Vorschau → Übernehmen → Rückgängig; Netzmitschnitt im E2E: 0 Anfragen.
- Fokus-Checkliste im PR-Text; Klickzahlen vorher/nachher für „Tag frei“ (Zettel vs. Satz).
- Docs: STATUS eine Zeile; `decisions/plan.md` eine Bullet (Plan im Kalender = Chips + Link, kein Reiter); `docs/howto/planning-modules.md` (Abschnitt Planer: Präfix `p`, Anweisungen); `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
`review loop` (ein Reviewer, Fokus: keine Modul-Importe, Parser rät nicht, Vorschau vor jedem Schreiben, Fokus-Wortlaut), dann `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 3: more sources, overload line, automation event (`feat/plan-sources`)

```
# Aufgabe: Planer – Notizen „In den Plan“, Rechnungen und Kündigungsfristen als Quellen, Überlast-Zeile (Paket 3 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-sources` von frischem `develop` (nach Merge von Paket 2; parallel zu Paket 4 möglich, keine gemeinsamen Dateien außer `strings.ts`-Blöcken). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Der Planer plant ToDos (Paket 1) und zeigt sie im Kalender (Paket 2). Dieses Paket bringt Dinge aus anderen Modulen in den Plan und macht Überlast als Zahl sichtbar (CONCEPT §4 Tabelle, §7). Lies `core/events/{events,bus}.ts`, `modules/todos/services.ts` (`todo.requested`), `modules/notes/routes/NotesPage.tsx` (⋯-Menü), `modules/invoices/{schema,attention,calendar}.ts`, `modules/subscriptions/calendar.ts`, `core/deadline/notice.ts`, `core/automation/module.ts`.

## Pflichtliste
- `core/events/events.ts`: `'plan.requested': { title; durationMin?; priority?; due?: { date; hard }; link? }` (additiv); `modules/planner/services.ts` hört zu: ToDo über das Quick-Capture-Ziel anlegen (Link mitgeben), Planer-Item mit Pin/Frist, Toast „Im Plan: <Titel> · Mi · Rückgängig“.
- Notizen: ⋯-Menü der Seite „In den Plan“ → kleiner Zettel (Dauer 15/30/60/120, Priorität, optional Frist) → `plan.requested` mit `link: { kind: 'note' }`; keine Planer-Importe.
- `modules/invoices/plannable.ts`: offene Rechnungen als Items „<Empfänger> bezahlen“, 10 Min, Prio 2, `due.hard = true`, `to: /invoices?open=`; kein `onDone` (Bezahlen bleibt im Modul; bezahlt = Item verschwindet). `modules/subscriptions/plannable.ts`: Kündigungsfristen aus `core/deadline/notice.ts` als „<Abo> kündigen“, 15 Min, Prio 3, hart. Beide mit Tests; `exclusion.test.ts` unverändert grün.
- Überlast: nach jedem Lauf eine Zeile im Planer-Kopf und im Toast beim Eintragen („Diese Woche: 2 h 40 mehr geplant als frei“, nur wenn > 0, neutral); `modules/planner/attention.ts`: ein Item Ton `warning`, Icon, Text, Link (nie `danger`); Automations-Ereignis `planner.overloaded` (`overMin`, `week`) über `manifest.automation` (`events`, Detector alle 10 Min), keine Aktionen.
- ToDos: „Neu planen“ auf der ToDo-Seite nur zeigen, wenn das Modul `planner` nicht aktiv ist (`core/modules/activation`, keine Importe); Zeile in `docs/features/focus-aids.md`.

## Nicht in diesem Paket
KI, Zeiterfassung, Gewohnheiten, Zeitfenster. Keine neuen Felder an Rechnungen oder Abos.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; E2E: Notiz → In den Plan → Zeile im Brett mit Link zurück; Rechnung fällig Do → Item mit „muss bis Do fertig sein“.
- Fokus-Checkliste im PR-Text (die Überlast-Zeile ist eine Zahl mit Kontext, kein Alarm; Aus-Schalter = Quelle im Modul deaktivierbar über die Modul-Einstellungen „Im Plan zeigen“).
- Docs: STATUS eine Zeile; `decisions/plan.md` eine Bullet (Rechnungen/Abos ohne Rückschreiben); `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
`review loop` (Fokus: Modulgrenzen, Bus-Vertrag additiv, keine Geldaktion aus dem Plan), dann `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 4: AI actions, local stage, privacy pins (`feat/plan-ai`)

```
# Aufgabe: Planer – KI-Schicht: Aktionen, lokales Modell für Anweisungen, Datenschutz-Pins (Paket 4 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-ai` von frischem `develop` (nach Merge von Paket 2; parallel zu Paket 3 möglich). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entschieden (CONCEPT §10): Umplanung über Stufe 0 (Regeln) und Stufe 1 (lokales Modell); die Cloud sieht den Plan nie – keine Stufe 2. Lies docs/decisions/{local-model,ai-off}.md, `core/ai/write/{types,stages,prepare,commit}.ts`, `core/ai/local/{stage,grammar,prompts/v1}.ts`, `core/ai/privacy.test.ts`, `core/ai/switch.ts`, `docs/howto/ai-actions.md`, `core/modules/aiActions.ts`.

## Pflichtliste
- `modules/planner/ai.ts`: kompaktes `aiSchema` (Sammlung `day`: date, availableMin, note; Sammlung `item`: title, durationMin, priority, pinned, excluded – `searchable: false` für `assignment`), Aktionen `available` (update day), `block` (create Blocker), `pin` (transition item), `exclude` (transition item) mit `parse`-Hinweisen (Stichwörter „frei“, „verfügbar“, „festnageln“, „nicht planen“), je 5 Eval-Eingaben in `web/tests/ai/eval-set.json`; `contributions.aiActionHandlers` für `pin`/`exclude` (Lauf danach, Undo-Gruppe).
- ToDos: `estimateMin` in `aiSchema` und in `actions.create.fields` (Rolle aus den Capture-Fakten), 2 Eval-Eingaben („Steuer zwei Stunden bis Donnerstag“).
- Stufe 1 für Anweisungen: `core/ai/local/prompts/plan.ts` (System-Prompt mit dem kompakten Plan ≤ 30 Zeilen: Schlüssel, Titel, Min, Prio, Frist, Tag; Nutzertext = der Satz), Grammatik für ≤ 8 Ops `{ op, key|date, value }`, Schlüssel gegen den Plan geprüft, Ergebnis → Ops → Lauf → `PlanPreview` (immer); Fallback auf Stufe 0; nur wenn `localStageReady()`; `local/stage.test.ts`-Muster.
- Datenschutz-Pins (`core/ai/privacy.test.ts` + `modules/planner/__tests__/privacy.test.ts`): (1) mit „KI aus“ laufen `plan()`, Anweisungen und Aktionen über die Regeln, 0 Netzanfragen; (2) die lokale Stufe ruft nie `fetch`; (3) kein Cloud-Prompt enthält Planer-Zeilen: das `aiSchema` des Planers ist im Cloud-Pfad ausgeschlossen (Filter in `core/ai/scope.ts` oder `prompt.ts`, Test mit Fixtures: kein Titel, keine Dauer, kein Datum des Plans im Body) – die Planer-Aktionen laufen nur über Stufe 0 und 1.
- `core/ai/switch.ts`-Gating an den Verbrauchern: Eingabefeld und Vorschau funktionieren ohne KI (E2E mit Schalter aus).

## Nicht in diesem Paket
Zeiterfassung, Zeitfenster, Streaming, neue Provider. Keine Änderung an der Reihenfolge Regeln → lokal → Cloud.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e`, `npm run ai:eval` grün; Eval-Tabelle im PR-Text (Stufe 0/1 je Eingabe).
- Docs: STATUS eine Zeile; `decisions/plan.md` eine Bullet (Stufen und was die Cloud sieht); `docs/user/ai-assistant.md` + `.de.md` ein Absatz; `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
Nach dem Bau `council` über den Diff (Guardian: Datenschutz der Stufen, Pins, KI-aus-Pfad, was in Sync/Backup landet; Advocate: Vorschau verständlich, kein Raten, Wortlaut; Architect: Grammatik, Ops-Vertrag, keine Modul-Importe). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge.
```

### Prompt – package 5: learning, windows, habits, week review (`feat/plan-learn`)

```
# Aufgabe: Planer – Lernen aus der Zeiterfassung, Zeitfenster, Gewohnheiten als Blöcke, ruhiger Wochenrückblick (Paket 5 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-learn` von frischem `develop` (nach Merge von Paket 3 und 4). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Der Planer plant, zeigt und versteht (Pakete 1–4). Dieses Paket macht Schätzungen ehrlicher und Tage feiner (CONCEPT §7). Lies `modules/timetrack/{schema,logic}.ts`, `core/events/events.ts` (`timetrack.start.requested`), `modules/habits/{schema,logic}.ts`, `modules/calendar/views.ts` (`splitDay`, `TimedItem`), `modules/todos/progress.ts` (`weekReview`), `core/automation/templates.ts` (`weeklyReview`).

## Pflichtliste
- Zeiterfassung: optionales Feld `session.ref` (Planer-Item-Schlüssel; `manifest.version` + Migration no-op), gesetzt wenn der Start über `timetrack.start.requested` mit `sourceRef` kommt (Planer-Zeilenaktion „Zeit erfassen“); `modules/timetrack/plannable.ts` liefert keine Items, sondern `actuals(keys)` als zweite Vertragsfläche (`PlannableSource.actuals?`) – Ist-Minuten je Schlüssel; der Planer zeigt im Zettel „Letztes Mal 50 Min · Schätzung 30“ und bietet „Übernehmen“; nie automatisch ändern.
- Zeitfenster: `day.from`/`day.to` (Standard je Wochentag in den Einstellungen, z. B. 09:00–17:00) und Blocker mit `from`/`to`; Engine legt Sitzungen in freie Fenster (`core/plan/windows.ts`, deterministisch, Tests); Kalender-Chips werden Zeitblöcke (`time`/`endTime`), Stundenraster zeigt sie; Drag bleibt aus (nur Kalender-Termine).
- Energie: `item.energy` (morgens/abends), `settings.energyProfile` (aus, Standard) – Engine bevorzugt passende Fenster, nie Pflicht; eine Zeile in den Einstellungen, Aus-Schalter.
- Gewohnheiten: optionales `goal.minutes`; mit `reminder.time` + Minuten liefert `modules/habits/plannable.ts` feste Blöcke (`PlannableSource.blocks?`), sonst nichts; Migration no-op.
- Wochenrückblick: eine Zeile im Planer-Widget am Montag („Letzte Woche: 9 von 12 Dingen · 11 h“), Schalter `focus.weekReview` wiederverwendet; Vorlage `weeklyReview` darf darauf hinweisen (`notice`, soft).
- Verfügbarkeits-Vorlagen „Arbeitswoche / Urlaub / Krank“ im „Woche prüfen“-Zettel (eine Auswahl, überschreibt nur die Woche).

## Nicht in diesem Paket
Cloud, Partner-Freigabe, Android-Widget, Drag von Plan-Blöcken im Kalenderraster.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; `db:bump` nach Merge von `develop` erneut; Engine-Fixtures um ein Fenster-Szenario ergänzt.
- Fokus-Checkliste im PR-Text (Energieprofil aus, Rückblick ohne Verlustzahl, nichts wächst täglich).
- Docs: STATUS eine Zeile; `decisions/plan.md` zwei Bullets (Ist-Dauer nur als Hinweis; Fenster statt Minuten); ARCHITECTURE-MAP-Zeile ergänzen; `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
`review loop` (Fokus: Migrationen, Determinismus der Fenster, keine stillen Änderungen an Schätzungen), dann `full stop`: PR gegen develop, kein Merge.
```
