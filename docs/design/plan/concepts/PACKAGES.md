# Planner concepts – packages (final prompts)

Concepts: [README.md](README.md) (questions decided with the recommended options, 2026-11-14). One package = one chat, one branch, one PR against `develop`; paste one prompt per chat. Format as in [Wochenende PACKAGES](../../usecases/wochenende/PACKAGES.md).

**Order:** WR1 → H1 → TT1 → TT2 → E1, strictly serial, and **only after „Wochenende retten“ package 6 is merged** (packages 1–6 there touch `modules/planner/**`, `core/plan/**` and – package 5 – `core/modules/types.ts`; these packages touch the same files). WR1, H1 and TT2 change `core/modules/types.ts` (hotspot: a row in CHATS.md „Hotspots“ first). `strings.ts` and the en catalog only in the own block. Not in any package: auto-enabling time tracking (W14), habits tickable in the plan, an energy diary.

| #   | Package                       | Branch                   | Scope (short)                                                                                                                                                                        | Hotspots                | Skill                | Acceptance figures                          |
| --- | ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | -------------------- | ------------------------------------------- |
| WR1 | Week review line              | `feat/plan-week-review`  | `core/modules/{types,contributions}.ts` (`weekLine`), `modules/{todos,timetrack,habits}/weekLine.ts` + manifests, `planner/components/WeekCheck.tsx`, `todos/widgets/NextWidget.tsx` | `core/modules/types.ts` | `review-loop`        | 0 extra taps; widget lines net 0            |
| H1  | Habits block time             | `feat/plan-habit-blocks` | habits `schema/migrations/manifest/GoalEditor/plannable.ts`, `core/modules/types.ts` (`blocks?`), `planner/{days,services}.ts`, `DaySheet.tsx`                                       | `core/modules/types.ts` | `council` (contract) | blocker entry 5 → 1 per week (weekday walk) |
| TT1 | „Zeit erfassen“ from the plan | `feat/plan-track-time`   | timetrack `schema/migrations/manifest/services.ts` (`ref`), planner row ⋯ + `routes/FocusPage.tsx`                                                                                   | none                    | `review-loop`        | plan row → running session 5 → 2 taps       |
| TT2 | „bisher erfasst“              | `feat/plan-actuals`      | `core/modules/{types,contributions}.ts` (`actuals`), `timetrack/actuals.ts`, planner „Warum hier?“ + estimate editor, planner setting `actualsHint`                                  | `core/modules/types.ts` | `council` (contract) | 0 values changed without a tap (test)       |
| E1  | „Braucht Kopf“                | `feat/plan-heavy`        | `core/plan/{types,engine,explain}.ts` + fixtures, `planner/{schema,migrations,settings}.ts`, row ⋯                                                                                   | `core/plan/**`          | `council` (engine)   | setting off = plan unchanged (fixture)      |

Each package: own branch from fresh `develop` (after the previous PR is merged), `.changes/` note DE/EN, STATUS line only in a `docs(status)` PR, a decision bullet in `docs/decisions/plan.md` only where it builds differently from the concept, user doc (`docs/user/modules.md` + `.de.md`) where the user sees something, stimulus budget (`web/e2e/stimulus-budget.json`, `scripts/ratchet.mjs`) – a hit is named in the PR, never raised by the chat.

### Prompt – WR1: week review line (`feat/plan-week-review`)

```
# Aufgabe: Planer-Konzepte – Wochenrückblick als eine Zeile in „Woche prüfen“ (Paket WR1 von 5)

Routing: Claude Code · Planer-Konzepte WR1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-week-review` von frischem `develop` – nach dem Merge von Wochenende-Paket 6. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/modules/types.ts`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept docs/design/plan/concepts/week-review.md (verbindlich), Index README.md daneben. Lies `modules/todos/progress.ts` (`weekReview`), `todos/widgets/NextWidget.tsx` (Z. 80–90), `planner/components/WeekCheck.tsx`, `core/modules/contributions.ts` (`collectHeadlines` als Vorbild), `core/settings/focus.ts` (`weekReview`).

## Pflichtliste
- Beitrag `weekLine` in `core/modules/types.ts` + Sammler `collectWeekLines` (fehlerhafte Quelle wird übersprungen; höchstens drei Teile nach `order`; ≤ 68 Zeichen, Rest still weggelassen).
- ToDos, Zeiterfassung, Gewohnheiten liefern je ihren Teil aus eigenen Daten (letzte ISO-Woche Mo–So); nichts zu sagen = `undefined`, nie „0 …“; Gewohnheiten: das Ziel mit den meisten erledigten Tagen, Ruhetage zählen nicht.
- „Woche prüfen“ zeigt die Zeile oben, nur mit `focus.weekReview` an; „Jetzt dran“ zeigt dieselbe Zeile statt des eigenen ToDo-Satzes, die ruhigen Töne bleiben für eine Woche ohne Teile.
- Wortlaut DE + EN, Zahlen über `core/i18n/format`; kein Vergleich, kein „n von m“, kein „nur“.
- `accounts` bekommt nichts (`exclusion.test.ts` grün).

## Nicht in diesem Paket
Verlauf, Diagramme, Wochenziele, Benachrichtigung am Montag, KI-Zusammenfassung.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `check:modules`, `e2e` grün; Tests: Sammler, je Modul leere Woche → `undefined`, Schalter aus.
- Zahlen: 0 zusätzliche Taps; Widget-Zeilen netto 0; Fokus-Checkliste 1–9 im PR; Entfernt: der ToDo-eigene Rückblicksatz.
- Docs: FOCUS-WORDING eine Zeile, Nutzerdoku DE + EN, `.changes/`, Hotspot-Zeile raus.

## Skills
`review-loop`, dann `full stop`.
```

### Prompt – H1: habits block time (`feat/plan-habit-blocks`)

```
# Aufgabe: Planer-Konzepte – Gewohnheiten halten Zeit im Plan frei (Paket H1 von 5)

Routing: Claude Code · Planer-Konzepte H1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-habit-blocks` von frischem `develop` – nach dem Merge von WR1. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/modules/types.ts`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept docs/design/plan/concepts/habits.md (verbindlich). Lies `modules/habits/{schema,logic,manifest}.ts` (`isScheduled`), `components/GoalEditor.tsx`, `core/modules/types.ts` (`PlannableSource`), `modules/planner/days.ts` (`calendarBlockers`), `services.ts` (`inputSnapshot`), `components/DaySheet.tsx`, `modules/fitness/plannable.ts` als Beispiel einer Quelle.

## Pflichtliste
- `goalSchema.minutes?` (5–240) + `manifest.version` + Migration (additiv); Feld „Zeit im Plan freihalten“ (keine · 15 · 30 · 60 Min, freie Eingabe) im Ziel-Editor, Standard „keine“; in „Erweitert“, wenn der Editor die Ebene hat.
- `PlannableSource.blocks?(ctx)` im Vertrag; Gewohnheiten liefern `plannable` mit `list() → []` und `blocks()` für Tagesziele an ihren geplanten Tagen; Ruhetag entfernt den Block; Wochenziele nie.
- Planer: Blöcke in `days.ts` neben den Kalender-Blockern, im Eingabe-Schnappschuss (geändertes Ziel plant neu); Tagesblatt zeigt „Spazieren gehen · 30 Min“ mit Symbol, ohne Häkchen, ohne Zustand „offen“ oder „verpasst“.
- Erinnerungen, `habits.goal.open`, Serien unverändert.

## Nicht in diesem Paket
Gewohnheiten als abhakbare Planpunkte, Zeitfenster für Gewohnheiten, Wochenziele im Plan, Schlafdaten.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `check:modules`, `e2e` (inkl. `e2e/planner.spec.ts`) grün; Tests: `blocks()` je Periode/Wochentag/Ruhetag, freie Minuten mit Block, Neuplanung bei geänderten Minuten, Migration.
- Zahlen: Blocker-Eingaben für einen werktäglichen Spaziergang 5 → 1 pro Woche; Fokus-Checkliste 1–9 im PR; Entfernt: täglich denselben Blocker tippen.
- Docs: CONCEPT.md §4 Tabelle Zeile „Habits“, Nutzerdoku DE + EN, `.changes/`, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Gesundheitsdaten im Plan, kein Tadel; Advocate: kein „verpasst“, Feld standardmäßig leer; Architect: Vertrag additiv, Lesen über den Beitrag, deterministischer Lauf), dann `full stop`.
```

### Prompt – TT1: „Zeit erfassen“ from the plan (`feat/plan-track-time`)

```
# Aufgabe: Planer-Konzepte – „Zeit erfassen“ an der Planzeile und im Fokus (Paket TT1 von 5)

Routing: Claude Code · Planer-Konzepte TT1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-track-time` von frischem `develop` – nach dem Merge von H1. Keine Hotspots. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept docs/design/plan/concepts/time-tracking.md (verbindlich, Abschnitt TT1). Lies `core/events/events.ts` (`timetrack.start.requested`), `modules/timetrack/{services,repo,schema}.ts` (`startSession` stoppt eine laufende Sitzung), `modules/finance/schema.ts` (`sourceRef` mit `.meta({ internal: true })`), Planer-Zeilen-⋯ und `routes/FocusPage.tsx`, `core/modules/activation.ts` (`useModuleStates`). Wochenende W14 (Auto-Einschalten) bleibt „nicht jetzt“.

## Pflichtliste
- `sessionSchema.ref?` (intern, nie angezeigt, nie in der Daten-API) + `manifest.version` + Migration; der Dienst übernimmt `sourceRef` als `ref`.
- Planer: „Zeit erfassen“ im ⋯ der Zeile und als ruhige Zweitaktion auf dem Fokus-Bildschirm, nur wenn Zeiterfassung an ist (kein Hinweis zum Einschalten); sendet `timetrack.start.requested { title, sourceRef: '<module>:<id>' }` (Schlüssel des Dings, nicht der Sitzung); Toast nennt die neue Sitzung.
- „Anfangen“ bleibt die Hauptaktion des Fokus-Bildschirms.

## Nicht in diesem Paket
Summen, Hinweise, Schätzungen (TT2), Auto-Start/-Stopp, Rechnungen aus Plansitzungen, Auto-Einschalten.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Tests: Bus → Sitzung mit `ref`; Aktion fehlt bei ausgeschalteter Zeiterfassung; Migration.
- Zahlen: Planzeile → laufende Sitzung 5 → 2 Taps; Fokus-Checkliste 1–9 im PR; Entfernt: Titel in der Zeiterfassung neu tippen.
- Docs: `docs/decisions/plan.md` ein Punkt (`ref` neben `from`), Nutzerdoku DE + EN, `.changes/`.

## Skills
`review-loop`, dann `full stop`.
```

### Prompt – TT2: „bisher erfasst“ (`feat/plan-actuals`)

```
# Aufgabe: Planer-Konzepte – „bisher 50 Min erfasst“ und „50 Min übernehmen“ (Paket TT2 von 5)

Routing: Claude Code · Planer-Konzepte TT2 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-actuals` von frischem `develop` – nach dem Merge von TT1. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/modules/types.ts`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept docs/design/plan/concepts/time-tracking.md (Abschnitt TT2). Lies `core/modules/{types,contributions}.ts`, `modules/timetrack/logic.ts` (Minuten ohne Pause), Planer „Warum hier?“ und den Schätzungs-Editor, `modules/planner/settings.ts`.

## Pflichtliste
- Beitrag `actuals` (`refs → Minuten je ref`, nur beendete Sitzungen, Pausen abgezogen) im Vertrag + Sammler; Zeiterfassung liefert ihn.
- Planer: „bisher 50 Min erfasst“ in „Warum hier?“; im Schätzungs-Editor ein Chip „50 Min übernehmen“ – nur ein Tipp ändert `estimateMin`.
- Planer-Einstellung `actualsHint` (Standard an, solange Zeiterfassung an ist) in der Registry.
- Nie „50 von 30 Min“, nie „über der Schätzung“, keine Farbe.

## Nicht in diesem Paket
Lernen, das Werte selbst ändert, Statistiken, Vergleich je Woche.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Tests: Summen je ref, kein Wert ohne Tipp geändert, Schalter aus.
- Zahlen: 0 Werte ohne Tipp geändert; Fokus-Checkliste 1–9 im PR; Entfernt: Raten im Schätzungs-Editor.
- Docs: CONCEPT.md §7 Zeile „Learning from time tracking“ auf gebaut, FOCUS-WORDING eine Zeile, Nutzerdoku DE + EN, `.changes/`, Hotspot-Zeile raus.

## Skills
`council` (Guardian: `ref`/Minuten nie an KI oder Daten-API; Advocate: kein Leistungsvergleich; Architect: Lesen über Beitrag, kein Modulimport), dann `full stop`.
```

### Prompt – E1: „Braucht Kopf“ (`feat/plan-heavy`)

```
# Aufgabe: Planer-Konzepte – „Braucht Kopf“: Schweres zuerst, höchstens zwei am Tag (Paket E1 von 5)

Routing: Claude Code · Planer-Konzepte E1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-heavy` von frischem `develop` – nach dem Merge von TT2 und von Wochenende-Paketen 4 und 6. Vorher eine Zeile in docs/CHATS.md „Hotspots“: `core/plan/**`. Vorgegebene Session-Branches ignorieren.

## Ausgangslage
Konzept docs/design/plan/concepts/energy.md (verbindlich). Lies `core/plan/{types,engine,explain,windows}.ts` + `__fixtures__`, `docs/design/plan/engine-proto.mjs`, `modules/planner/{schema,migrations,settings}.ts`, Tagesabschnitte aus Wochenende-Paket 4.

## Pflichtliste
- `planner_item.heavy?` + `manifest.version` + Migration; `PlanItem.heavy?`; ⋯ der Zeile „Braucht Kopf“ (umschalten), Symbol + Text im Zeilendetail.
- Einstellung „Schweres zuerst“ (Standard aus) und `heavyPerDay` (Standard 2, 1–3) in der Registry.
- Engine: markierte Sitzungen zuerst im Tag (mit Tagesabschnitten: erster Abschnitt), nach Pin-Reihenfolge und harten Fristen; mehr als `heavyPerDay` warten auf den nächsten Tag mit Platz, Grund „ein ruhigerer Tag passt besser“ (DE + EN); harte Frist schlägt das Limit; Einstellung aus = Plan wie heute.
- Kein Energietagebuch, keine Stimmungs- oder Schlafdaten, keine Bewertung.

## Nicht in diesem Paket
Energiestufen, Chronotyp, Lernen aus der Zeiterfassung, KI-Schätzung.

## Abnahme
- `npm run check`, `test`, `check:i18n`, `e2e` grün; Engine-Fixtures (Reihenfolge, Limit, Frist schlägt Limit, Fixpunkt, aus = unverändert), Migration.
- Zahlen: 2 Taps zum Markieren; Fokus-Checkliste 1–9 im PR; Entfernt: Schweres per Hand auf den Morgen pinnen.
- Docs: CONCEPT.md §3 eine Zeile, §7 Zeile „Energy“ auf gebaut, Nutzerdoku DE + EN, `.changes/`, Hotspot-Zeile raus.

## Skills
`council` (Guardian: keine Gesundheitsdaten; Advocate: kein Tadel, Standard aus; Architect: deterministisch, Fixpunkt, additiv), dann `full stop`.
```
