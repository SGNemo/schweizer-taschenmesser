# Use case „Tag kippt“ – target picture (phase 2)

Branch `design/usecase-tag-kippt`, 2026-11-23. Analysis and friction `K01…K13`: [ANALYSIS](ANALYSIS.md). Built: §2–§3 and the packages P1–P4 (2026-11-23; decisions in [plan-tag-kippt](../../../decisions/plan-tag-kippt.md)). The seven guiding sentences of the brief hold; the planner's rules stay ([CONCEPT-MIGRATION §7](../../planner-rethink/CONCEPT-MIGRATION.md): nothing moves without an action that names it, nothing written by midnight or sync, every action one undo, a closed preview changed nothing).

## 1. Target figures (`TARGET` in the measuring script)

| Path                                    | Now          | Target                                              | Gained by                              |
| --------------------------------------- | ------------ | --------------------------------------------------- | -------------------------------------- |
| T1 shrink Saturday: handles / per thing | 9 / 4        | **8 / 0**                                           | „Nur das hier …“ (§2)                  |
| T1 one thing smaller in one move        | no           | **yes**                                             | „Kleiner machen …“ (package P1)        |
| T1, T2 starting point after shrinking   | no           | **yes**                                             | the start line (§2)                    |
| T2 5 / 6 / 9: handles / per thing gone  | 31 / 23      | **≤ 22 / 0**                                        | „Nur das hier …“ with „Nächste Wochen“ |
| T2 later reachable from the planner     | no           | **yes**                                             | contract step `onLater`                |
| T3 Monday                               | 2, no figure | unchanged                                           | – (it already carries)                 |
| T4 plan from outside: handles           | 12 (+ ToDos) | **≤ 3** (paste, preview shows itself, „Übernehmen“) | „Plan einfügen“ (§3)                   |
| T4 text with day headings               | no           | **yes**                                             | §3                                     |
| T4 duplicates first / second paste      | 11 / 12      | **0 / 0**, the swap arrives                         | recognition by title                   |
| Things lost, unasked moves (every path) | 0            | **0**                                               | –                                      |

## 2. Shrinking: „Nur das hier …“ and the start line (K01–K04, K06)

- **Door:** the page's ⋯ on the day sheet, „Nur das hier …“ (next to „Auswählen“). The rows get a box; he ticks what **stays** (K02). The bar says „Nur das hier“; one tap opens „Der Rest“ with three targets: **„Morgen“** (the next day), **„Diese Woche, ohne Tag“** („Noch ohne Tag“), **„Nächste Wochen“** (later – not crossed out). One action, one undo, one toast: „Der Rest liegt auf So.“ / „… ist ohne Tag.“ / „… ist für die nächsten Wochen.“ Things that are „fest“ are not handed over; the toast names them as „Rückgängig“ does today („1 bleibt: fest“).
- **„Nächste Wochen“** = a new optional contract step `onLater(id, later)` (ToDos: `someday`) plus `listLater()`; the planner removes the rows (the source hears „no day“) and lists the things in a folded group „Nächste Wochen“ under „Noch ohne Tag“ – findable, never back by itself; „Diese Woche“ takes one back. Other sources without the step: the target is not offered.
- **Start line:** after „Nur das hier“ the sheet shows one line on top, „Anfangen mit: Wäsche waschen · Fokus starten“ (the first thing that stayed, the focus page of planner §7); one ✕ hides it. No list is hidden (the four rows stay; folding them is package P3 if the line alone does not carry).
- Rejected: a sentence („heute nur A, B, C, Rest nächste Woche“) as the door – the rules read names fuzzily and the rest would need a new op per target; kept for later as an alias of the same action (P4). A „Tag neu ab jetzt“ that also re-spreads the rest over days – that is „Rest verteilen“ and moves things he did not name.

## 3. „Plan einfügen“ (K07–K10) – the mandatory build

- **Doors:** pasting a block of lines or JSON into the planner's field opens the preview at once; the page's ⋯ has „Plan einfügen …“ (empty field, preview while typing). Read locally (`modules/planner/pastePlan.ts`), no model.
- **Reads:** (a) the ToDos' JSON (`{"items":[…]}`, `plannedFor`, `someday`, `estimateMin`), (b) text: headings „Heute“, „Morgen“, „Samstag“, „So 29.11.“, „29.11.“, ISO dates; sections „später“, „nächste Wochen“, „verschoben“, „irgendwann“ → „Nächste Wochen“; „diese Woche“, „im Laufe der Woche“ → „Diese Woche, ohne Tag“; bullets `-`, `*`, `•`, `1.`, `[ ]`; „15 Minuten“, „20–30 Min“ (upper bound), „1 Std“ → effort; a „Ziel …:“ line and chat prose are skipped.
- **Preview:** one list grouped by target, each line ticked with its title and „neu“, „Sa → So“ or „bleibt“; a passed day asks once „Tage, die vorbei sind: heute · ohne Tag“ (default ohne Tag); things laid between today and the plan's last day that the paste does not name are listed („Nicht im eingefügten Plan – bleibt, wie es ist“) with one box „auch für die nächsten Wochen“ (off). „Übernehmen“ = one action, one undo.
- **Recognition:** the same title (case, spaces, quotes, trailing marks ignored) is the same thing, also when it is kept for later: it moves, nothing is doubled. Two devices pasting the same text write the same day per thing (field LWW on the existing row; new things are new ToDos – a second device that pastes before the first one synced can create one twin, named in „Noch offen“ of the risks).
- **Writes** only through the planner's own path (`saveCapture('todo')`, `layOn`, the source's `onLater`); `dataApi` stays off, no read path, privacy and vault tests untouched.

## 4. Other candidates

| Candidate                                                                                                          | Verdict                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| „Kleiner machen …“ on a row: title of today's step, the rest as its own thing for „Diese Woche“ / „Nächste Wochen“ | yes, package P1 (needs a source step `onSplitOff` – the planner must not edit ToDo titles itself)                                                                  |
| Goal line for the weekend („Wohnung frei bekommen“) as a quiet head, no progress figure                            | yes, package P2: the day's `note` (exists in `planner_day`) shown as the sheet's first line for the days it covers; „Plan einfügen“ fills it from a „Ziel: …“ line |
| „Plan als Text kopieren“ (an explicit tap, clipboard)                                                              | built (P3, answered „ja“ 2026-11-23): only on his tap, only the days in view, titles, days, minutes and a shared goal                                              |
| Folding the list behind the start line                                                                             | package P3, only if the measured start line is not enough                                                                                                          |

## 5. Open for Sven (answered 2026-11-23: both „ja“, built as P3 and in #1072)

1. „Plan als Text kopieren“: allow as an explicit tap (clipboard only, no share target, no model)? Recommendation: yes, in the page's ⋯, plain text in the same format „Plan einfügen“ reads – the round trip he does by hand today.
2. „Nächste Wochen“ inside the planner as a folded group (built) or only a link to ToDos „Irgendwann“? Recommendation: the group (findable where he shrank).

## 6. FOCUS checklist (new surfaces)

Stimulus: „Nur das hier …“ and „Plan einfügen …“ live in ⋯ (no new button on the page); the start line replaces nothing yet (P3 would fold the list). Off switch: the start line has its ✕ and follows „Fokus & Aufmerksamkeit“ → planner line setting. Next step: one primary action per view („Nur das hier“, „Übernehmen“, „Fokus starten“). Wording: no counter, no „nicht geschafft“, later = „nicht gestrichen“ in its help. Interruption: a closed preview or selection changed nothing. What can go: the per-thing „Verschieben nach Irgendwann“ round in ToDos for this case.
