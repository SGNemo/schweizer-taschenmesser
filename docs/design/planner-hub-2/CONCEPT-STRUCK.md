# Planner hub 2 – concept of the two struck ideas (8, 7)

Struck by principle 1 ([ANALYSIS §4](ANALYSIS.md)); kept so that one „ja“ of the maintainer needs no new design. Frame: [CONCEPT](CONCEPT.md).

## Idea 8 – learn the real duration (struck by principle 1, kept ready)

The script shows no fewer rows and no fewer module switches; it is not in the package order. What it would be, so a „ja“ needs no new design:

**Behaviour.** (1) A focus round or a „Los“ step that ends with „Erledigt“ / „Fertig · weiter“ records the minutes that ran (pauses removed; < 1 min or > 8 h not recorded). (2) A **new** thing without minutes whose key has ≥ 2 records takes the median of the last 5, rounded to 5, instead of 30; the row says „20 Min · wie zuletzt“ until he changes it; the toast of the entry offers „Ändern“. (3) Nothing that exists changes its minutes. (4) „Dauer …“ shows „zuletzt 20, 25, 15 Min“ as a line.

**„The same thing“.** In this order: the source's stable id for things that come back (routine id, list id, a ToDo's series) → else the title as „Plan einfügen“ compares it (case, spaces, quotes, trailing marks ignored; digits kept). No fuzzy match: a near miss gets 30 as today.

**Data.** `planner_measure` (one row per record, pruned to 5 per key inside the recording action); synced with the planner's other rows between his own devices, in no export, no copy text, no assistant path. Switch „Aus gemessener Zeit vorschlagen“ (off deletes nothing; „Gemessene Zeiten löschen“ beside it).

**Risk.** A timer left running teaches nonsense (cap + median). Titles as keys hold what titles hold today – same store, same protection.

**Would lower.** Per-thing „Dauer …“ handles (C1: 5 → 0) and booked minutes (150 → about 40).

## Idea 7 – „Warte auf Antwort“ (struck by principle 1, kept ready; never confirmed by the maintainer)

Today he selects the things and moves them to the day: 7 handles, no module switch, they are back by themselves ([ANALYSIS](ANALYSIS.md) H15, §4). What follows would add the reason on the row, not fewer rows.

**Behaviour.** (1) Row ⋯ „Warte auf Antwort …“ → „bis“: 3 Tage · 1 Woche · 2 Wochen · Datum; optional „von“: a person (people) – a mail thread is taken from the row's own link. (2) The row leaves the sheet and stands in a folded line „Wartet auf Antwort · 2“ at the end of „Noch ohne Tag“ (text, no count badge; expanded: thing, „bis Mo 7. Dez.“, „Zurückholen“). (3) On that day it is back in „Noch ohne Tag“ with the chip „Antwort da? · von Vermieter“ and its links; nothing is written on that day – the source simply lists it again. (4) No notification.

**Contract.** `PlannableSource.onWait?(id, until: string | undefined)` + `listWaiting?()` (ToDos: `startDate`, which already hides a task until that day); link `wait` to the person / thread. A source without the step does not offer the entry.

**Would change (D5).** Handles 7 → 5 for three things; rows and switches as today.

**Not part of it.** No reading of mail to detect an answer, no reminder, no escalation wording, no waiting state for invoices or lists.
