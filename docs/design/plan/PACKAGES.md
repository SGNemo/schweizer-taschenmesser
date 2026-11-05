# Day and week planning – packages (phase 2, final prompts)

Decisions: [CONCEPT.md](CONCEPT.md) §10 „Entschieden“ and [`docs/decisions/plan.md`](../../decisions/plan.md). Template: [identity-v3-audit/02-packages.md](../identity-v3-audit/02-packages.md) Part B. One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Order 1 → 2 → 3 → 4 → 5. **Package 1 starts only after `feat/identity-v3-frame` is merged.**

| #   | Package                                                                        | Branch                            | Scope                                                                                                                                                                                                                                                                                                                                                                | Hotspots to announce                                                                                  | Skills                  |
| --- | ------------------------------------------------------------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------- |
| 1   | Engine, contract, module, ToDos source                                         | `feat/plan-core`                  | `core/plan/*`, `contributions.plannable` + `collectPlannable`, `modules/planner/*`, `modules/todos/{plannable,schema,next,automation}.ts` (`planOrder`, hide „Neu planen“), `core/i18n/format` (`formatMinutes`), strings + 4 locales, e2e                                                                                                                           | `core/modules/types.ts`, `core/modules/registry.ts` (row in CHATS.md), `strings.ts` block, `db:bump`  | council · full stop     |
| 2   | Calendar chip per day, capture prefix, one field with instructions and preview | `feat/plan-calendar-instructions` | `modules/planner/{calendar,instructions UI}`, `core/plan/instructions.ts`, `modules/todos/today.ts` + `home/AgendaBlock.tsx` (skip `kind: 'plan'`), `modules/calendar/routes/CalendarPage.tsx` (link), `quickCapture/{parser,targets}` (`p`, two-step save + combined undo)                                                                                          | `quickCapture/parser` (isolation test), `quickCapture/targets/types.ts`, calendar page (small, local) | review loop · full stop |
| 3   | More sources, overload figure, automation event                                | `feat/plan-sources`               | `core/events/events.ts` (`plan.requested`), `modules/notes` (⋯ „In den Plan“), `modules/invoices/plannable.ts`, `modules/subscriptions/plannable.ts`, `modules/planner/{manifest,automation}.ts`                                                                                                                                                                     | `core/events/events.ts` (additive)                                                                    | review loop · full stop |
| 4   | AI: actions, cloud-only filter, local stage, privacy pins                      | `feat/plan-ai`                    | `modules/planner/{ai,manifest}.ts`, `modules/todos/ai.ts` (`estimateMin`), `core/modules/types.ts` (`aiSchema.cloud`), `core/ai/scope.ts` (`cloudModules`), `core/ai/assistant.ts` (cloud paths, tiers 2/3, `writable`), `modules/chat/context.ts`, `core/ai/local/prompts/plan.ts` + grammar, `core/ai/privacy.test.ts`, `web/tests/ai/eval-set.json`, e2e „KI aus“ | `core/modules/types.ts` (one field), `core/ai/{scope,assistant}.ts` (cloud filter: one chat)          | council · full stop     |
| 5   | Time windows, timed chips, availability templates                              | `feat/plan-windows`               | `modules/planner` (`day.from/to`, templates), `core/plan/windows.ts`, planner `calendar.ts` (timed chips)                                                                                                                                                                                                                                                            | –                                                                                                     | review loop · full stop |

Each package: own branch from fresh `develop`, PR against `develop`, row in CHATS.md, `.changes/` note (DE/EN), STATUS one line, decisions in `docs/decisions/plan.md`, the focus checklist (1–9) answered in the PR text. Later, as a concept of their own (not in these packages): learning from time tracking, energy profile, habit blocks, week review.

### Prompt – package 1: engine, contract, module, ToDos (`feat/plan-core`)

```
# Aufgabe: Planer – Engine, Vertrag `contributions.plannable`, Modul, ToDos als Quelle (Paket 1 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-core` von frischem `develop` – **erst nachdem `feat/identity-v3-frame` gemergt ist** (Hotspot `core/modules/types.ts`; vorher Zeile in docs/CHATS.md „Hotspots“: Manifest-Vertrag, ein Chat). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept freigegeben: docs/design/plan/CONCEPT.md (Entscheidungen §10, Datenmodell und Lauf-Regeln §2, Engine §3 mit Prototyp docs/design/plan/engine-proto.mjs, Vertrag §4, Identität §7). Lies dazu web/src/modules/CLAUDE.md, docs/howto/new-module.md, docs/design/FOCUS-GUIDELINES.md, `modules/todos/{schema,next,postpone,today,automation}.ts`, `core/modules/{types,contributions,activation}.ts`, `core/db/repo.ts` (`upsert`), `core/undo`, `core/settings/focus.ts` (`planLimit`), `ui/widgets/ProgressList.tsx` (`ProgressEntry`: `label`, `value`, `max`, `detail`, `overText`).

## Pflichtliste
- `core/plan/{types,capacity,units,engine,diff,explain}.ts`: reine Funktionen, kein `Date.now`, Vertrag wie CONCEPT §3 (Definitionen `raw`, `usable`, `free = usable − planned`, `overflowMin`; `plan()` schneidet `days` auf `horizonDays`; `DEFAULT_MIN = 30`); Regeln 1–8 in dieser Reihenfolge (Blocker nur Kalender-Einträge der Art `event`/`external` mit Uhrzeit, nie `reminder`; harte Frist nur innerhalb des Horizonts und einzige Regel, die vorzieht; „kept“ vor „carried“ vor neu; `bumpedBy` als Liste aller Einheiten, die an dem Tag Platz nahmen, auch für Einheiten, die aus dem Horizont fallen; Einheiten-Id `<itemKey>#<k>`, `of` als Feld); Fixtures `core/plan/__fixtures__/{s1..s5}.json` aus dem Prototyp mit `horizonDays: 7` (gleiche Eingaben, erwartete Zuweisungen als Snapshot); Tests: Determinismus, Stabilität (ein „kept“ verliert nie gegen „carried“ gleicher Prio; Erledigt macht Platz, nichts rückt nach vorn), Frist (innerhalb/außerhalb Horizont), Puffer, Teilung, Limit, Diff-Ursache bei Verschiebung und Wegfall, Erinnerungen blocken nie, Erklärungssatz in 5 Sprachen.
- `core/i18n/format.ts`: `formatMinutes(min)` („1 h 30“, „45 Min“, je Sprache; der Name ist frei, `modules/disk/format.ts` hat schon ein `formatDuration(ms)`), Test; jede Stunden-/Minutenzahl im Modul geht hindurch.
- `core/modules/types.ts`: `PlannableItem`, `PlannableSource` (`onAssign(id, date | undefined, order?)`), `contributions.plannable` (lazy); `core/modules/contributions.ts`: `collectPlannable` (fehlerisoliert wie `collectCalendarItems`); `SIGNATURES` + `weekBars`; `registry.test.ts`: `retired` ohne `plannable`. `exclusion.test.ts` bleibt unverändert (die Schlüsselliste des Tresors pinnt `plannable` schon mit).
- ToDos: optionales Feld `planOrder` in `schema.ts` (`manifest.version` + No-op-Migration, Seed unverändert); `next.ts` `dayPlan` sortiert nach `planOrder ?? order`; `automation.ts`: ein Patch, der nur `plannedFor`/`planOrder` ändert, erzeugt kein `todos.task.updated`; `modules/todos/plannable.ts`: `list` (offen, kein `someday`, kein `parentId`, nur aktuelle Wiederholung; `estimateMin`, `priority`, `dueDate` weich, `startDate`/`plannedFor` → `earliest` – nie Pin), `onAssign` (schreibt `plannedFor` und `planOrder` nur bei Änderung; `undefined` löscht), `onDone`, `onEstimate`; Eintrag im Manifest; Tests. ToDo-Seite: „Neu planen“ nur zeigen, wenn das Modul `planner` nicht aktiv ist (`useModuleStates()` aus `core/modules/activation.ts`, kein Import); Zeile in `docs/features/focus-aids.md`.
- `modules/planner/`: `npm run gen:module -- planner "Planer"`; Sammlungen `day` (Id = Datum), `item` (Id = `module:id`), `assignment` (Id = `<itemKey>#<k>`) nach CONCEPT §2 über `repo.upsert`, einfache Indizes `date`/`sourceKey`/`date`, keine Unique-Indizes; Manifest `dataApi: false`, `requires: ['todos']`; `db:bump`; `repo.ts`; `settings.ts` (Scope `planner`, Werte aus §2, `planLimit` aus `focus` wiederverwenden, `weekCheck` und `calendarChips` für Paket 2 vorbereitet); `seed.ts` (deterministisch, kleine/mittlere/große Woche, Blocker, ein festgenageltes Ding, ein Ding ohne Schätzung); `run.ts` nach den Lauf-Regeln in §2 (Quellen über `collectPlannable`, Kalender-Blocker über `collectCalendarItems`, `plan()`, Zuweisungen in place aktualisieren, `wrote` mit Stempel **vor** `onAssign` schreiben, `onAssign` für alle Dinge eines Tages in Planreihenfolge, `undefined` für wartende/ausgeschlossene; Nutzerdatum vor dem Überschreiben nach `item.earliest` kopieren; Eingabe-Hash in `_meta` aus `today`, Einstellungen, Items, Tagen, Blockern – ohne `prev`, eigene Zeilen und planer-eigene `plannedFor`-Werte); `services.ts` (Lauf über Live-Queries auf `collectPlannable` und die eigenen Tabellen – nicht über `core/db/writeHook`, der gehört der Automation; Nutzeraktionen warten ihren Lauf samt Rückschreiben in einem `undoable` ab, alle anderen Läufe serialisiert dahinter, nicht undoable, gleiches idempotentes Rückschreiben; nach einer per Sync eingetroffenen Zuweisungsänderung ein Hintergrundlauf, der nur abweichende Zeilen schreibt; `module.disabled` für `planner` vor dem Abbau: planer-eigene `plannedFor` auf `item.earliest` zurücksetzen oder löschen, `planOrder` löschen). Tests: „ein Lauf → null Folgeschreibungen“, „Undo bleibt rückgängig“, „zwei Geräte konvergieren“, „ein Lauf → null Automations-Ereignisse“, „Später Do → Sa zugewiesen → Do nie unterschritten → Deaktivieren → plannedFor = Do“.
- Seite `/planner` (Wochenbrett nach CONCEPT §1: Spalten Mo–So, eine Kapazitätszeile „47 Min frei von 3 h 12“ plus Balken, Zeilen nur Titel und Minuten, Sitzungen als „Teil 1/2“ (aria „Teil 1 von 2“), Blocker grau mit Minuten, Grund hinter „Warum hier?“ (Tipp/Tooltip); Tageszettel: Verfügbar −/+, Blocker hinzufügen, Tag frei; ein Eingabefeld „Eintragen oder sagen“ → in diesem Paket Quick-Capture-Ziel `todo` + Planer-Item, ein Fristwort („bis Do“, „Frist“) setzt `item.due.hard` (im Toast genannt, undoable); Zeilenaktionen Erledigt / Später / Festnageln / Nicht planen / Als Frist markieren / Öffnen über `ItemRow` + ⋯, alles `undoableWithToast`; „Wartet auf einen freien Tag · n“ als `GroupedList`-Gruppe, leer ausgeblendet; Telefon: ein Tag je Bildschirm mit Tagesleiste und freien Minuten, kein horizontaler Überlauf bei 412 px); Widget `week` (`ProgressList`: s = heute und morgen, m = 4 Tage, l = 6 Tage ab heute; Zeile `{ label: 'Heute · 47 Min frei', value: geplant, max: planbar, detail }`, Überhang in `detail` („20 Min mehr als planbar“), `overText` nie setzen – nie rot; Kontextzeile „Diese Woche: 8 h 55 geplant · 6 h 41 frei“ = Rest der Kalenderwoche; leer mit Aktion); Kopf `PageHeader` mit Figur „47 Min frei heute“ / „Heute ist voll.“ + Kontext; `identity` nach §7 (`indigo`/`cobalt`, `kennzahl`, `fortschritt`, `weekBars`, `order: 15`, `type: 'thin'`), `area: 'plan'`, `layout: 'wide'`, `maturity: 'preview'`, `contributions.onboarding: noOnboarding`, `quickAdd`.
- `@/ui/identity/WeekBars` (Dekoration, ohne Farbe lesbar) + Leerzustands-Motiv.
- Strings `t.planner.*` (Deutsch in `strings.ts`, Block anhängen) + 4 Locales, Glossar-Einträge „Planer, Verfügbar, Blocker, Puffer, festnageln, Frist“; `check:i18n`.
- E2E `e2e/planner.spec.ts`: Woche mit Seed, Verfügbar ändern, Eintrag über das Feld (mit „bis Do“), Erledigt + Rückgängig, Festnageln, 412 px ohne horizontalen Überlauf; Seite in `e2e/a11y.spec.ts`.

## Nicht in diesem Paket
Kalender-Chips, Freitext-Anweisungen, KI, weitere Quellen (Notizen, Rechnungen, Abos), Zeitfenster. Keine weiteren ToDo-Felder als `planOrder`. Nichts an Tresor, Sync-Regel, Signing.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; `npx vitest run src/core/plan src/core/seed`; die fünf Fixtures liefern exakt die Zuweisungen des Prototyps.
- Fokus-Checkliste (FOCUS-GUIDELINES 1–9) im PR-Text beantwortet; Klickzahlen für Erledigt, Später, Tag frei.
- Docs: STATUS eine Zeile; `docs/decisions/plan.md` ergänzen, falls etwas anders ausfiel; ARCHITECTURE-MAP eine Zeile (`core/plan`, `modules/planner`); MODULE-IDENTITY Tabellenzeile (Farbabstand indigo/cobalt/violet mit `check:modules` bestätigen – 1° Spielraum); Abschnitt „Planer“ in `docs/howto/planning-modules.md`; `.changes/`-Notiz (DE/EN, Nutzersicht: „Neues Modul Planer (in Arbeit): verteilt ToDos auf die nächsten Tage nach verfügbarer Zeit“); Zeile in CHATS.md.

## Skills
Nach dem Bau `council` über den Diff (Architect: Vertrag und Modulgrenzen, Engine-Determinismus, Ids über `upsert`, keine Modul-Importe; Guardian: `dataApi: false`, was in Sync/Backup landet, keine Uhr in der Engine, Rückschreib-Regeln und ihre fünf Tests; Advocate: Fokus-Regeln, Reizlast des Bretts, Verständlichkeit ohne Lesen, Telefon). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge. Ein STOPP vor dem Council, wenn das Datenmodell (§2) oder die Regelreihenfolge (§3) anders ausfallen muss (Frage mit Empfehlung, ≤ 4).
```

### Prompt – package 2: calendar chip per day, capture prefix, one field with instructions and preview (`feat/plan-calendar-instructions`)

```
# Aufgabe: Planer – Kalender-Chip je Tag, Schnellerfassung „p“, Freitext-Anweisungen mit Vorschau (Paket 2 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-calendar-instructions` von frischem `develop` (nach Merge von `feat/plan-core`). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Paket 1 hat Engine, Vertrag, Modul und ToDos-Quelle geliefert (docs/design/plan/CONCEPT.md §1–4, §10). Dieses Paket macht den Plan im Kalender sichtbar, nimmt Einträge mit Präfix an und versteht Sätze wie „Donnerstag frei“ ohne Modell (§6c) – im selben Feld, das sonst ToDos anlegt. Lies `core/ai/write/{rules/parse,targets}.ts`, `quickCapture/parser/{index,dates,endtime}.ts`, `quickCapture/targets/{types,adapters,index}.ts`, `modules/calendar/{calendar,views}.ts`, `modules/todos/today.ts`, `home/AgendaBlock.tsx`, `layout/assistant/WritePreview.tsx`, `core/focus/{session,state}.ts`.

## Pflichtliste
- `modules/planner/calendar.ts` (`contributions.calendarItems`): **ein** ganztägiger Chip je Tag (`kind: 'plan'`, Titel „Plan · 2 h 25 · 5 Dinge“, `to: /planner?day=`), Schalter `planner.calendarChips` (Standard an); `modules/todos/today.ts` und `home/AgendaBlock.tsx`: `kind === 'plan'` wird übersprungen (die Karte listet die ToDos schon); `NextEventLine`, Cockpit prüfen (der Chip verdrängt nichts; der Tray behält seine festen Quellen); Kalender-Ansichtsschalter bekommt den Eintrag „Plan“ als Link auf `/planner?week=<Montag>` (kein sechster View, `VIEWS` unverändert).
- `quickCapture/parser`: Präfix `p` und Wort „plan:“ → Typ `plan` (Felder wie `todo` + `estimateMin`, Datum = Pin oder frühester Tag nach Wort „ab“, Fristwort → harte Frist); `quickCapture/targets/types.ts`: Vertrag um einen zweistufigen Speichervorgang erweitern (ToDo über das `todo`-Ziel, dann Planer-Item über das Manifest-Repo, `SavedCapture.undo` entfernt beides); `adapters.ts`: Ziel `plan`; Korpus-Fälle, Isolationstest bleibt grün.
- `core/plan/instructions.ts`: Satzmuster aus CONCEPT §6c → Ops; Datumswörter aus `quickCapture/parser/dates.ts`, Zeitfenster aus `endtime.ts`, Ziel-Treffer mit `findTarget`/`withinOneEdit`; Muster nur Deutsch (wie die Schnellerfassung): in en/es/fr/pt-BR legt das Feld ToDos an und die Erklärzeile nennt die ⋯-Aktionen; unbekanntes Muster mit bekanntem Verb → Erklärzeile, zweideutig → „Meinst du A oder B?“; 30 Tests (Korpus mit allen Mustern, Umlaute gefaltet, „nächsten Donnerstag“, „alles von Do nach Fr“ mit harter Frist dazwischen).
- Ein Feld „Eintragen oder sagen“: Anweisungsmuster zuerst, sonst ToDo wie in Paket 1; `modules/planner/components/PlanPreview.tsx`: Diff (verschoben mit Ursache-Liste, neu, wartet), „Übernehmen“/„Verwerfen“, danach Undo-Toast; kein Modell, keine Netzanfrage (Test mit `fetch`-Spion); „Neu verteilen“ im ⋯-Menü mit Vorschau; „Woche prüfen“ als **stille Zeile im Planer-Kopf am Montag** („Woche prüfen · 2 Schritte“, verschwindet nach Nutzung oder Wegklicken, nie ein Dialog von selbst), Zettel: Mo–So Verfügbar bestätigen, drei größte Dinge; Schalter `planner.weekCheck` in den Modul-Einstellungen blendet die Zeile aus.
- Fokusrunde aus einer Sitzung: Zeilenaktion „Fokus starten“ → `core/focus/session.ts` + `state.ts` mit den Sitzungsminuten, Pfad `/planner/focus/:item` (Shell-Regel `isFocusPath`), keine ToDo-Importe.

## Nicht in diesem Paket
Modell-Stufen, Cloud-Filter, weitere Quellen, Zeitfenster im Stundenraster (der Chip bleibt ganztägig), Drag im Kalenderraster.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; `e2e/planner.spec.ts` erweitert: Chip im Kalender (einer je Tag) und Schalter aus, Präfix „p“, Satz „Donnerstag frei“ → Vorschau → Übernehmen → Rückgängig; Netzmitschnitt im E2E: 0 Anfragen.
- Fokus-Checkliste (1–9) im PR-Text; Klickzahlen vorher/nachher für „Tag frei“ (Zettel vs. Satz); ein Feld, eine Primäraktion je Ansicht; nichts öffnet sich von selbst.
- Docs: STATUS eine Zeile; `decisions/plan.md` eine Bullet (ein Feld für beides; ein Chip je Tag); `docs/howto/planning-modules.md` (Abschnitt Planer: Präfix `p`, Anweisungen, Sprachen); `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
`review loop` (ein Reviewer, Fokus: keine Modul-Importe, Parser rät nicht, Vorschau vor jedem Schreiben, Fokus-Wortlaut, Reizlast im Kalender), dann `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 3: more sources, overload figure, automation event (`feat/plan-sources`)

```
# Aufgabe: Planer – Notizen „In den Plan“, Rechnungen und Kündigungsfristen als Quellen, Überlast-Zahl (Paket 3 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-sources` von frischem `develop` (nach Merge von Paket 2; Paket 4 folgt danach, beide ändern `modules/planner/manifest.ts`). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Der Planer plant ToDos (Paket 1) und zeigt sie im Kalender (Paket 2). Dieses Paket bringt Dinge aus anderen Modulen in den Plan und macht Überlast als Zahl sichtbar (CONCEPT §4 Tabelle, §7). Lies `core/events/{events,bus}.ts`, `modules/todos/services.ts` (`todo.requested`), `modules/notes/routes/NotesPage.tsx` (⋯-Menü), `modules/invoices/{schema,attention,calendar}.ts`, `modules/subscriptions/calendar.ts`, `core/deadline/notice.ts`, `core/automation/module.ts`, docs/decisions/automation.md.

## Pflichtliste
- `core/events/events.ts`: `'plan.requested': { title; durationMin?; priority?; due?: { date; hard }; link? }` (additiv); `modules/planner/services.ts` hört zu: ToDo über das Quick-Capture-Ziel anlegen (Link mitgeben), Planer-Item mit Pin/Frist, Toast „Im Plan: <Titel> · Mi · Rückgängig“.
- Notizen: ⋯-Menü der Seite „In den Plan“ → kleiner Zettel (Dauer 15/30/60/120, Priorität, optional Frist) → `plan.requested` mit `link: { kind: 'note' }`; keine Planer-Importe.
- `modules/invoices/plannable.ts`: offene Rechnungen als Items „<Empfänger> bezahlen“, 10 Min, Prio 2, `due.hard = true`, `to: /invoices?open=`; kein `onDone` (Bezahlen bleibt im Modul; bezahlt = Item verschwindet). `modules/subscriptions/plannable.ts`: Kündigungsfristen aus `core/deadline/notice.ts` als „<Abo> kündigen“, 15 Min, Prio 3, hart. Je Quelle ein Schalter „Im Plan zeigen“ in den Modul-Einstellungen (Standard an). Beide mit Tests; `exclusion.test.ts` unverändert grün.
- Überlast: die Zahl steht im Kopf der Wartegruppe („Wartet auf einen freien Tag · 3 · 2 h 40 mehr zu tun als frei“, neutraler Text ohne Farbe) und als Toast-Zeile **nur, wenn der Überhang neu auftritt oder wächst** (nicht bei jedem Eintrag); **kein** Eintrag in „Jetzt wichtig“; Automations-Ereignis `planner.overloaded` (`overMin`, `week`) über `manifest.automation` (`events`, Detector alle 10 Min), **keine** `actions` (Entscheidung: Module geben der Automation nur `create`).

## Nicht in diesem Paket
KI, Cloud-Filter, Zeitfenster, Zeiterfassung, Gewohnheiten. Keine neuen Felder an Rechnungen oder Abos.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; E2E: Notiz → In den Plan → Zeile im Brett mit Link zurück; Rechnung fällig Do → Item mit „muss bis Do fertig sein“; zweiter Eintrag bei gleichbleibendem Überhang → kein zweiter Toast.
- Fokus-Checkliste (1–9) im PR-Text (die Überlast-Zahl ist eine Zahl mit Kontext, kein Alarm, keine Wiederholung; Aus-Schalter je Quelle).
- Docs: STATUS eine Zeile; `decisions/plan.md` eine Bullet (Rechnungen/Abos ohne Rückschreiben); `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
`review loop` (Fokus: Modulgrenzen, Bus-Vertrag additiv, keine Geldaktion aus dem Plan, kein Alarm, kein Nörgeln), dann `full stop`: PR gegen develop, kein Merge.
```

### Prompt – package 4: AI actions, cloud-only filter, local stage, privacy pins (`feat/plan-ai`)

```
# Aufgabe: Planer – KI-Schicht: Aktionen, Cloud-Ausschluss, lokales Modell für Anweisungen, Datenschutz-Pins (Paket 4 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-ai` von frischem `develop` (nach Merge von Paket 3). Hotspot-Zeilen in CHATS.md: `core/modules/types.ts` (ein Feld `aiSchema.cloud`), `core/ai/{scope,assistant}.ts` (Cloud-Filter, ein Chat). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Entschieden (CONCEPT §10): Umplanung über Stufe 0 (Regeln) und Stufe 1 (lokales Modell, nur Desktop mit geladenem Modell); die Cloud sieht den Planer nie – weder Schema, Aktionen noch Daten, auch nicht als Chat-Kontext. Der Planer braucht trotzdem ein `aiSchema`, weil Regel-Hinweise (`parse`) und die Grammatik der lokalen Stufe über `aiModules()` laufen; deshalb kommt ein **Cloud-only-Filter**, nicht ein Filter in `aiModules()`. Lies docs/decisions/{local-model,ai-off}.md, `core/ai/{scope,prompt,assistant,switch}.ts` (`isAiOn` ist async), `core/ai/write/{types,settings,prepare,commit}.ts`, `core/ai/local/{stage,state,grammar,prompts/v1}.ts`, `core/ai/query/executor.ts` (`runAgenda` sammelt aus `ctx.manifests`), `modules/chat/{context,logic}.ts` und `components/ThreadView.tsx` (Kontext wird an der Nachricht gespeichert und im Verlauf wiederholt), `core/ai/privacy.test.ts`, `docs/howto/ai-actions.md`, `core/modules/aiActions.ts`.

## Pflichtliste
- `modules/planner/ai.ts`: kompaktes `aiSchema` (Sammlung `day`: date, availableMin, note; Sammlung `item`: title, durationMin, priority, pinned, excluded; `assignment` nicht im Schema), `cloud: false`; Aktionen `available` (update day), `block` (create Blocker), `pin` (transition item), `exclude` (transition item) mit `parse`-Hinweisen (Stichwörter „frei“, „verfügbar“, „festnageln“, „nicht planen“), je 5 Eval-Eingaben in `web/tests/ai/eval-set.json`; `contributions.aiActionHandlers` für `pin`/`exclude` (Lauf danach in derselben Undo-Gruppe).
- Cloud-only-Filter: `ModuleAiSchema.cloud?: false` in `core/modules/types.ts` (additiv, ein Feld); `cloudModules(manifests)` neben `aiModules()` in `core/ai/scope.ts`; in `core/ai/assistant.ts` auf **allen** Cloud-Pfaden angewandt: vor `buildSystemPrompt`/`buildTools`, und in den Stufen 2/3 (Cache und Modell) auf `ctx.manifests`/`known` und `writable` – ein erratenes Op oder ein Tool-Aufruf mit `planner` ergibt `unknown-module`, `show_agenda` sammelt damit keine Plan-Chips; `modules/chat/context.ts` `contextModules()` nutzt `cloudModules()` **für jede Engine** (der Planer wird nie als Chat-Kontext angeboten, weil gespeicherter Kontext beim Engine-Wechsel sonst zum Anbieter ginge). `aiModules()` bleibt unverändert (Stufe 0 und 1 laufen weiter).
- ToDos: `estimateMin` in `aiSchema` und in `actions.create.fields` (Rolle aus den Capture-Fakten), 2 Eval-Eingaben („Steuer zwei Stunden bis Donnerstag“).
- Stufe 1 für Anweisungen: `core/ai/local/prompts/plan.ts` (System-Prompt mit dem kompakten Plan ≤ 30 Zeilen: Schlüssel, Titel, Min, Prio, Frist, Tag; Nutzertext = der Satz), Grammatik für ≤ 8 Ops `{ op, key|date, value }`, Schlüssel gegen den Plan geprüft, Ergebnis → Ops → Lauf → `PlanPreview` (immer); Fallback auf Stufe 0; nur wenn `(await isAiOn()) && localStageReady()`; das Planer-Feld ruft nie `router`.
- Datenschutz-Pins (`core/ai/privacy.test.ts` + `modules/planner/__tests__/privacy.test.ts`) mit Planer-Fixtures (Blocker-Label „Zahnarzt“, Tagesnotiz, Item-Titel, Zuweisungsdaten außerhalb von „heute“ und außerhalb der Frage): (1) mit „KI aus“ laufen `plan()`, Anweisungen und Aktionen über die Regeln, 0 Netzanfragen, `getPlatform().localModel.generate` wird nie gerufen; (2) die lokale Stufe und das Planer-Feld rufen nie `fetch`; (3) für jeden Provider-Adapter: `ask()` mit erlaubter Cloud und nicht verfügbarer lokaler Stufe (Stufen 2 und 3; ein Tool-Aufruf mit `planner` → `unknown-module`) – der Body enthält kein `planner`, keinen `planner_*`-Sammlungs- oder Aktionsnamen und keinen Fixture-Text; (4) ein Chat-Thread mit Planer-Daten in der Datenbank, lokale Engine mit Kontext, dann Wechsel auf `router` → der Body enthält keinen Fixture-Text (der Planer stand nie zur Auswahl).
- `core/ai/switch.ts`-Gating an den Verbrauchern: Feld und Vorschau funktionieren ohne KI (E2E mit Schalter aus).

## Nicht in diesem Paket
Zeitfenster, Streaming, neue Provider, Cloud-Stufe für den Planer (nie). Keine Änderung an der Reihenfolge Regeln → lokal → Cloud für andere Module.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e`, `npm run ai:eval` grün; Eval-Tabelle im PR-Text (Stufe 0/1 je Eingabe); Privacy-Pins (1)–(4) als Testnamen im PR-Text.
- Fokus-Checkliste (1–9) im PR-Text: Vorschau vor jedem Schreiben, kein Raten, KI-aus-Pfad, Wortlaut der Rückfragen.
- Docs: STATUS eine Zeile; `decisions/plan.md` eine Bullet (Cloud-only-Filter, kein Chat-Kontext) und `decisions/local-model.md` eine Bullet (`aiSchema.cloud: false` als Mechanismus); `docs/user/ai-assistant.md` + `.de.md` ein Absatz; `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
Nach dem Bau `council` über den Diff (Guardian: Cloud-Filter an allen Pfaden inkl. Stufen 2/3 und Chat, Pins, KI-aus-Pfad, was in Sync/Backup landet; Advocate: Vorschau verständlich, kein Raten, Wortlaut; Architect: Grammatik, Ops-Vertrag, `aiModules()` unverändert, keine Modul-Importe). Danach `full stop`: PR gegen develop, Council-Tabelle in der PR-Beschreibung, kein Merge.
```

### Prompt – package 5: time windows, timed chips, availability templates (`feat/plan-windows`)

```
# Aufgabe: Planer – Zeitfenster je Tag, Zeitblöcke im Stundenraster, Verfügbarkeits-Vorlagen (Paket 5 von 5)

Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-windows` von frischem `develop` (nach Merge von Paket 4). Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Der Planer plant, zeigt und versteht (Pakete 1–4). Dieses Paket macht Tage feiner: Zeitfenster statt nur Minuten, Sitzungen als Zeitblöcke im Kalenderraster, Vorlagen für die Woche (CONCEPT §7). Nicht hier (eigenes Konzept später): Lernen aus der Zeiterfassung, Energieprofil, Gewohnheiten als Blöcke, Wochenrückblick. Lies `modules/calendar/views.ts` (`splitDay`, `TimedItem`), `modules/calendar/components/TimeGrid.tsx`, `modules/planner/{schema,run,calendar}.ts`, `core/plan/engine.ts`.

## Pflichtliste
- Zeitfenster: `day.from`/`day.to` (Standard je Wochentag in den Einstellungen, z. B. 09:00–17:00; Minuten bleiben die Wahrheit, Fenster sind optional) und Blocker mit `from`/`to`; `core/plan/windows.ts` legt Sitzungen deterministisch in freie Fenster (Tests, Fixture „Fenster“); ohne Fenster bleibt alles wie bisher.
- Der Tages-Chip im Kalender wird zu Zeitblöcken (`time`/`endTime`) je Sitzung, das Stundenraster zeigt sie; ohne Fenster bleibt der eine Chip; Drag bleibt aus (nur Kalender-Termine); der Tageszettel zeigt das Fenster.
- Verfügbarkeits-Vorlagen „Arbeitswoche / Urlaub / Krank“ im „Woche prüfen“-Zettel (eine Auswahl, überschreibt nur die Woche, Undo).
- Was entfällt (Checkliste 9): die Minuten-Eingabe −/+ bleibt, aber die Einstellung „Standard je Wochentag“ zeigt Fenster statt zweier Zahlenreihen.

## Nicht in diesem Paket
Zeiterfassung, Energie, Gewohnheiten, Wochenrückblick, Cloud, Partner-Freigabe, Android-Widget, Drag von Plan-Blöcken im Kalenderraster.

## Abnahme
- `npm run check`, `test`, `check:modules`, `check:i18n`, `e2e` grün; `db:bump` nach Merge von `develop` erneut; Engine-Fixtures um das Fenster-Szenario ergänzt; E2E: Fenster setzen → Block im Stundenraster.
- Fokus-Checkliste (1–9) im PR-Text (Fenster sind optional, nichts wächst täglich, Reizlast im Raster).
- Docs: STATUS eine Zeile; `decisions/plan.md` eine Bullet (Fenster optional, Minuten bleiben die Wahrheit); ARCHITECTURE-MAP-Zeile ergänzen; `.changes/`-Notiz (DE/EN); Zeile in CHATS.md.

## Skills
`review loop` (Fokus: Migrationen, Determinismus der Fenster, keine stillen Änderungen an Schätzungen), dann `full stop`: PR gegen develop, kein Merge.
```
