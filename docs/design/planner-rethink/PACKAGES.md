# Planner rethink – packages

After the answers of 2026-11-21 ([README](README.md)). Order: **strictly 1 → 2 → 3 → 4 → 5 → 6 → 7**, each after the merge of the one before – they share `routes/PlannerPage.tsx`, `components/ThingRow.tsx` and `components/WeekBand.tsx`, so nothing runs in parallel (package-plan review, 2026-11-21). Every package holds the four rules of [CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §7 and re-measures `IST` in the measuring script for the paths it changes. Prompts 2–3: [PACKAGES-2-3](PACKAGES-2-3.md), 4–7: [PACKAGES-4-7](PACKAGES-4-7.md). Package 1 is built by the chat that wrote this plan.

| # | Package | Branch | Scope | Target from CONCEPT §8 | Review |
| --- | --- | --- | --- | --- | --- |
| 1 | State model, migration, „nothing moves by itself“ | `feat/plan-stays-put` | `propose()`, `locked`, one-time migration, no background run, plain tab „Noch offen“, entering on the day on the sheet ([HANDOFF](HANDOFF.md)) | unasked moves 0, collateral 0, new thing on its day | council |
| 2 | Lock, lock words, overbooking, date in the text | `feat/plan-lock-overbook` | one-tap lock, „… fest“ / „…!“, the calm overbooking line, „Rest verteilen“ per day, chips „Vorschlag“ / „In ToDos“ | lock in one tap | council |
| 3 | Tab „Noch offen“ in one move | `feat/plan-open-tab` | group actions, multi-select, the line on today | repair ≤ 10 taps in 1 pass, 1 for all | review loop |
| 4 | More than a week | `feat/plan-weeks` | paging band, „4 Wochen“, four-week picker in „Verschieben …“ | a day in three weeks in 3 taps | review loop |
| 5 | Moving | `feat/plan-move` | drag, keyboard, multi-select | one row changes per drop | review loop |
| 6 | Sources, proposals, „Woche vorschlagen“ | `feat/plan-suggest` | „Woche vorschlagen“, `suggestNew`, „In Teile aufteilen …“ | counter-scenarios not worse | council |
| 7 | Re-measure | `chore/plan-rethink-measure` | `TARGET` asserted, phone paths, clean-up of the round | all targets | review loop |

Hotspots across the packages: `web/src/core/plan/**`, `web/src/modules/planner/{run,services,actions,board}.ts`, `routes/PlannerPage.tsx`, `web/src/modules/todos/{plannable,planMark}.ts`, `web/src/core/modules/types.ts` (1, maybe 6), `web/src/strings.ts` (all).

## Package 1 as built (PR #1035) – where it differs from its prompt

Built by the chat that wrote this plan; the prompt below stays as the specification it started from.

- **The engine keeps `plan()` and gains `loose`** instead of a new `propose()`: with `loose` every stored day inside the planned days is set first whatever the room, a passed or far day is left alone (`kept`), a thing without a day gets none (`no-day`), and only the named items go through the old rules. Every caller passes `loose`; the rules without it are reachable from the tests only (fixtures S1–S6 unchanged) and go with package 7. Why: the smallest change that makes „nothing moves“ true by construction.
- **The background pass stays as a read-refresh** (live query, midnight, tab focus): it hands nothing to the engine, so it writes no row and tells no source anything (tested); it keeps `planner.lastRun` current, which the board still reads for „Noch ohne Tag“ and titles. Removing the pass and `lastRun` moves to package 7.
- **Rows of fixed blocks are still written** by that pass (a training gets its row as before); hiding them instead belongs with the removal of the pass.
- **„Fest an diesem Tag“ / „Nicht mehr fest“ are in the row's ⋯ already** (package 2 adds the one-tap lock on the row).
- **Not in package 1:** `PlannableItem.day?` (a dated training or routine has no row until it is laid – it sits under „Noch ohne Tag“ like deadline things; package 2 with the chips), the restore hook (the step is keyed on the data instead: a pin that is still stored is taken over at the next start, also after a restore), the schema clean-up of `of`/`reason`/`bumpedBy`/`late`.
- **Measured:** 0 unasked moves, 0 collateral, every missed thing says „war Mo“, a new thing lands on the day on the sheet; laying ten things by hand costs 31 taps instead of 8 because nothing is pre-spread („Neu verteilen“ proposes; packages 5 and 6 bring it down).

### Prompt – package 1: Zustandsmodell, Migration, „nichts wandert von selbst“ (`feat/plan-stays-put`)

```
# Aufgabe: Planer neu gedacht – Zustandsmodell, Migration, „nichts wandert von selbst“ (Paket 1 von 7)

Routing: Claude Code · Planer neu gedacht Paket 1 · Opus
Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text
Branch `feat/plan-stays-put` von frischem `develop` – nach dem Merge von #1034 (Design). Vorher eine Zeile im Scribble-Repo (`board/`) und in docs/CHATS.md „Hotspots“: `web/src/core/plan/**` (Engine → Vorschlagswerk), `web/src/modules/planner/{run,services,actions,board}.ts`, `web/src/modules/todos/{plannable,planMark}.ts` (Rückschreiben), `web/src/core/modules/types.ts` (`PlannableItem.day?`), `web/src/strings.ts`, `core/backup` (Restore löscht `planner.model`).
Lies CLAUDE.md, docs/design/planner-rethink/README.md, CONCEPT.md, CONCEPT-MIGRATION.md (§7: die vier Regeln, die jedes Paket hält), CONCEPT-COPY.md (Wörter wörtlich), docs/decisions/plan-rethink.md. Starte mit `npm run chats:status`. Unbeaufsichtigt: keine Rückfragen; Entscheidungen im PR unter „Für dich entschieden“, Ungeklärtes unter „Noch offen“ (gemeint ist der PR-Abschnitt, nicht der Reiter). Reihenfolge der Pakete: streng 1 → 2 → 3 → 4 → 5 → 6 → 7, jedes nach dem Merge des vorigen (sie teilen sich `routes/PlannerPage.tsx`, `components/ThingRow.tsx`, `components/WeekBand.tsx`).

## Ausgangslage
- Gemessen auf `develop`: 5 von 10 gelegten Dingen wechseln nach zwei verpassten Tagen den Tag, 17 Handgriffe zur Reparatur, Neues landet nie am gewählten Tag (ANALYSIS.md §1). Ursache: jeder Lauf plant alles neu (ANALYSIS §2–§3).
- HANDOFF.md beschreibt, was nach diesem Paket auf dem Bildschirm ist.

## Pflichtliste
- `core/plan`: `propose()` und `load()` nach CONCEPT §2 (`stay` unangetastet, `loose` je Einheit, nie teilen, stabil bei teilweisem Übernehmen); `plan()` und die Regeln kept/carried/bumped/pulled entfallen; Fixtures S1–S6 als (stay, loose) → Vorschläge neu, je eine Zeile Begründung.
- Daten: `locked` auf `planner_assignment`, `manifest.version` + Migration; `PlannableItem.day?` (nur Fitness, Routinen); einmalige Migration nach CONCEPT-MIGRATION §2, jede Zeile der Tabelle: Pin = Zeilentag → `locked`; Pin heute oder später ohne Zeile dort → Zeile dorthin (oder neu), `locked`; vergangener Pin → Zeile bleibt, nicht fest; `pinned` geleert; Zeilen fester Blöcke bleiben gespeichert und werden versteckt; `autoReplan` einmal auf aus und ausgeblendet; Flag `planner.model` in `_meta`, der Restore löscht es.
- `services.ts`: kein Lauf mehr aus Live-Query, Mitternacht, Sichtbarkeit, Start, Sync; Mitternacht rendert nur neu. `runUser` wird zu Handlungen, die nur ihr Ding schreiben (ein Undo-Eintrag).
- Handlungen: Eintragen legt auf den Tag auf dem Blatt, sonst heute; „Verschieben …“ = Tag setzen (sperrt nicht); „Später“ = nächster Tag; Haken ruft nur `onDone`; „Vom Tag nehmen“/„Nicht planen“ entfernen die Zeile.
- Lesen: ein Selektor `placements(range)` (CONCEPT-MIGRATION §3) für Blatt, Band, Widget, Kalender-Chips, `plannedOn`; `dayOf` nach CONCEPT §1.
- Oberfläche nach HANDOFF.md: Reiter „Noch offen“ (schlicht), „Noch ohne Tag“ statt „Wartet auf freie Zeit“, „fest“ nur für das Schloss, keine Grundzeilen, Ein-Fakt-Toasts.
- Vorschauen („Rest verteilen“, „Tage einteilen“, Sätze) laufen über `propose()`.
- ToDo-Helfer: Marke ohne `prior`; Abschalten behält `plannedFor`; Entfernen löscht nur ein planer-eigenes Datum (CONCEPT-MIGRATION §4).
- Was an Lauf und `planner.lastRun` hängt, je ein Satz im PR, nichts stillschweigend: `automation.ts` (`planner.overloaded` aus `load()` oder als Entscheidung gestrichen), `calendar.ts` und `useBoard.ts` (Titel aus der Quellliste), `core/modules/vaultPlanPrivacy.test.ts` (umschreiben, nie löschen), die Satz-Ops (`pin` → verschieben, `earliest` → verschieben auf den Tag, `replan` → Vorschau), „Neu planen“ im Seitenmenü (Vorschau).
- Ein Datum im Text des Felds setzt den Tag der Zeile (verschieben, kein Schloss).
- Der Reiter hat schon die erste Gruppe „Fest – braucht einen neuen Tag“ (wörtlich), danach je vergangenem Tag; jede Zeile sagt „war Mo“.
- Der Selektor versteckt und löscht nie; kein Aufräum-Schritt; kein Kopieren von ToDo-Daten im Hintergrund (`syncEarliest` entfällt).
- `docs/design/FOCUS-WORDING.md`: „Wartet auf freie Zeit“ → „Noch ohne Tag“.
- Texte DE + EN (`check:i18n`), Change-Note (DE/EN) mit den Sätzen „erst alle Geräte aktualisieren, dann planen“ und „Dinge mit Frist und in ToDos datierte Dinge liegen bis zum nächsten Update unter ‚Noch ohne Tag‘“.

## Nicht in diesem Paket
- Schloss mit einem Tipp, Sperr-Wörter, ruhige Überbuchungszeile (2) · Gruppen-Aktionen im Reiter (3) · Blättern, 4 Wochen (4) · Ziehen, Mehrfachauswahl (5) · Chips „Vorschlag“/„In ToDos“, „Woche vorschlagen“ (6).

## Abnahme
- Tests aus HANDOFF §8, darunter die vier Regeln (Zeilen-Schnappschuss je Handlung, Schreib-Spion) und die Migrationstabelle; „zwei Geräte“: Verschieben auf A + Sperren auf B → Tag von A, fest; Entfernen auf A + Verschieben auf B → entfernt. Je ein Test: Quelle wirft, Modul aus, Ding außerhalb des Listen-Fensters → Zeilen bleiben. Migrations-Fixture: der U1-Plan nach der Reparatur plus ein Pin drei Wochen voraus; Restore eines alten Backups migriert erneut. Ein Undo-Eintrag je schreibender Handlung (auch „Übernehmen“); eine geschlossene Vorschau schreibt nichts.
- `web/e2e/usecases/planner-rethink.spec.ts`: `IST` für die geänderten Pfade neu messen und im PR nennen (nie lockern, nur Richtung `TARGET`). Ziel hier: U1 `unaskedAfterTwoDays` 0, `collateral` 0, `layCollateral` 0, `untraceable` 0; U2–U4 „ja“.
- `check`, `test`, `e2e` grün; `check:modules`, `check:docs`; `docs/howto/planning-modules.md` an das neue Modell angepasst.

## Skills
`council` (Architect: Zustandsmodell eindeutig, Vorschlagswerk deterministisch, kein Schreiben ohne Handlung, zwei Geräte konvergieren; Guardian: keine Platzierung geht verloren, jede schreibende Handlung ist ein Undo-Eintrag, kein stilles Schreiben; Advocate: Leitsätze 1–6, ruhige Wörter, Tippzahlen). `file-pr`, `babysit-pr`, `leaving-pr-comments`. Full stop.
```
