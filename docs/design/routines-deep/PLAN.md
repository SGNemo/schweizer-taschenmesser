# Routinen – „leichter anlegen“ (round „Tiefe & Politur“, 2026-11)

Maintainer: „Routinen erstellen usw. ist etwas verwirrend, soll leichter sein.“

## What a user means by „Routine“
A named sequence of small steps that comes back at a time of day or on certain days: „Morgenroutine“
(Wasser, Medikamente, Zähne …), „Abendroutine“, „Wochenputz“ (Bad, Küche, Staubsaugen), „Wocheneinkauf“.
They want to set it up once, see it when it is due, and tick it off step by step. No score, no streak.

## Where „Routine“ lives today (Ist)
| Place | What the user gets | Fits „Routine“? |
| --- | --- | --- |
| Module **Routinen** (`modules/routines`, H-b, #771/#779) | household chores with room, rhythm, rotation of names, „dran“, planner source, 10 chore templates in the start-data wizard | rhythm yes; **no steps, no time of day**; editor shows recurrence jargon („Wiederholung“, „Intervall“) |
| **Listen → „⋯ → Aus Vorlage“** (`modules/lists/templates.ts`) | „Morgenroutine“, „Abendroutine“, „Wochenplanung“ as a checklist list, reset by hand | steps yes; **no rhythm, not shown when due**, hidden behind a menu named „Aus Vorlage“ |
| **Gewohnheiten** (`modules/habits`) | single goals per day/week with reminder | one thing, not a sequence – stays as it is |
| Automationen (`core/automation/templates.ts`) | time/weekday triggers (profile, notice) | no steps – unrelated |
| Planer | „Woche prüfen“; shows due routines as plannable items | already fed by Routinen |

So the user meets three half-answers in two modules. Goal: **Routinen is the one place**; Listen points there.

## Ziel
- One way: **„Routine eintragen“** (the app-wide verb since 0b-8) → pick a start (Morgen, Abend, Wochenputz, Wocheneinkauf, „Leer“) → one form:
  Name · Wie oft (Jeden Tag / An Wochentagen / Jede Woche / Alle zwei Wochen / Jeden Monat; the full rule only
  under „Mehr Felder“) · Tageszeit (egal / morgens / mittags / abends) · Schritte · optional Erinnerung · optional im Planer.
- **Durchführen**: „Los“ on a routine with steps opens a step view; ticking the last step = „Erledigt“ (toast with
  „Rückgängig“). Progress survives closing; „Später weiter“ and „Ganz erledigt“ are always there. No streak, no count.
- Chores keep working: room and rotation move behind „Mehr Felder“.
- Listen's morning/evening templates lead to Routinen while it is on; a checklist can be taken over as a routine
  (the list stays – no data loss, nothing is deleted by code).

## Pakete (each its own branch + PR into `develop`, in this order)
1. **p1 `fix/routines-easy-p1` – steps, simple „Wie oft“, Tageszeit, start choice, Durchführen.** Shape change:
   `steps`, `daypart`, `progress` (`manifest.version` 2 + migration filling `steps: []`). No index change (no `db:bump`).
2. **p2 `fix/routines-easy-p2` – Erinnerung and „Im Planer“.** `remindAt` (`contributions.notifications`, quiet
   hours apply centrally, no reminder once the turn is done) and `planner` (off = not offered to the planner).
   Version 3 + migration.
3. **p3 `fix/routines-easy-p3` – Listen leads here.** Event `routine.requested` (`core/events/events.ts`, hotspot
   row) handled by Routinen; Listen: morning/evening templates link to „Routine anlegen“ while Routinen is on, and
   „⋯ → Als Routine übernehmen“ on a checklist. Coordinated with the Listen chat via the scribble.

Not planned: merging Gewohnheiten (different thing: one counted goal), converting lists automatically (they are
the user's entries; FOCUS 9 = offer, never move by code).

## p1 details (decided without the maintainer)
- Starts are a chip row at the top of the one form, not a step before it: the old way (name + Enter) still works
  in one click, and a start never saves by itself.
- Steps are a text field, one per line: Enter stays a new line, no row editor to learn; a line that stays keeps its
  id (and so its tick), also with other capitals.
- „Los“/„Weiter“ replaces „Erledigt“ on rows with steps (one verb per row); „Erledigt“ in the step view for
  a turn done without every step.
- A link to a routine (`?open=`, plan, search) opens the step view when it has steps.
- Due ones sort morning → midday → evening → any time.
