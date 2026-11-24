# Planner hub 2 – concept of the struck idea (7)

Struck by principle 1 ([ANALYSIS §4](ANALYSIS.md)); kept so that one „ja“ of the maintainer needs no new design. Frame: [CONCEPT](CONCEPT.md). Idea 8 is built (CONCEPT-ROWS „Idea 8“); the parked 5b stays in CONCEPT-ROWS „Idea 5“.

## Idea 7 – „Warte auf Antwort“ (struck by principle 1, kept ready; never confirmed by the maintainer)

Today he selects the things and moves them to the day: 7 handles, no module switch, they are back by themselves ([ANALYSIS](ANALYSIS.md) H15, §4). What follows would add the reason on the row, not fewer rows.

**Behaviour.** (1) Row ⋯ „Warte auf Antwort …“ → „bis“: 3 Tage · 1 Woche · 2 Wochen · Datum; optional „von“: a person (people) – a mail thread is taken from the row's own link. (2) The row leaves the sheet and stands in a folded line „Wartet auf Antwort · 2“ at the end of „Noch ohne Tag“ (text, no count badge; expanded: thing, „bis Mo 7. Dez.“, „Zurückholen“). (3) On that day it is back in „Noch ohne Tag“ with the chip „Antwort da? · von Vermieter“ and its links; nothing is written on that day – the source simply lists it again. (4) No notification.

**Contract.** `PlannableSource.onWait?(id, until: string | undefined)` + `listWaiting?()` (ToDos: `startDate`, which already hides a task until that day); link `wait` to the person / thread. A source without the step does not offer the entry.

**Would change (D5).** Handles 7 → 5 for three things; rows and switches as today.

**Not part of it.** No reading of mail to detect an answer, no reminder, no escalation wording, no waiting state for invoices or lists.
