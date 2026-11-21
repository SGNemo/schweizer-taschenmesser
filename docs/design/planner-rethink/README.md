# Planner rethink – „a plan that stays put“

Branch `design/planner-rethink`, 2026-11-21. The maintainer's brief: the planner spreads new things instead of putting them on the day, moves missed things silently, reshuffles when he puts them back, and ends after a week. **Nothing here is product code**; package 1 starts after the four answers below.

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | the use case as a script (figures), every trigger of a run, every rule that changes a day, friction R01–R15 |
| [ANALYSIS-DEPENDENCIES](ANALYSIS-DEPENDENCIES.md) | what hangs on the automaton (stays / changes / goes), research synthesis |
| [CONCEPT](CONCEPT.md) | states, the engine as a proposer, missed, entering, more than a week, moving, counter-scenarios, targets |
| [CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) | stored shape, the one-time migration, finished things, mirror to ToDos, two devices, sources, the four invariants |
| [CONCEPT-COPY](CONCEPT-COPY.md) | every new word, German and English, with the rejected ones |
| [CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md) | directions A/B/C, critique, FOCUS checklist, accessibility review |
| [`mockups/`](mockups/) | `a.html`, `b.html`, `c.html`, `render.mjs` |
| [`planner-rethink.spec.ts`](../../../web/e2e/usecases/planner-rethink.spec.ts) | the measuring script: `IST` (green on `develop`), `TARGET` (asserted by the last package) |

## The figures in one table

| | Now | Target |
| --- | --- | --- |
| Things that change their day without an action (week laid, two days missed) | 5 of 10 | 0 |
| Things that move while he moves another one (laying + repair) | 1 + 4 | 0 |
| Handles to put five missed things back, each on a chosen day | 17 in 3 passes | 10 in 1 pass (1 for „Alle auf heute“) |
| New thing lands on the day on the sheet (empty / full / kept free) | no / no / no | yes |
| A thing onto a day in three weeks | not possible | 3 taps |

## Fragen (waits on the maintainer; recommendation first, „ok“ takes all four)

1. **Missed things:** collect in one quiet group on top of today („Noch offen von Mo, Di“, each row says „war Mo“) – _recommended_: it is where he looks, and one tap puts all of them on today. Or: stay on their old day only, marked, and he pages back to find them.
2. **New things from sources that carry a deadline** (invoice, subscription, document): arrive under „Noch ohne Tag“ with a chip „Vorschlag: Do · Frist Fr“, one tap takes it – _recommended_: nothing sits on a day he did not choose; the deadline stays visible in „Nächste Fristen“. Or: laid on the proposed day at once, marked as a proposal. (A training or routine dated at its source shows on its day either way.)
3. **Standard view:** one week with paging, „4 Wochen“ as a switch – _recommended_ (stimulus budget, same surface on the phone). Or: two to four weeks always.
4. **Direction:** A „Blatt und Band“ – _recommended_. Or B „Wochenbrett“, C „Monatsblatt“ ([CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md) §1).

## Read from his words, to be corrected if wrong

- **„aufteilbar“** is read as „may be spread over days on request“: every thing that is not locked can be handed to „Rest verteilen“ / „Verteilen …“. Cutting one long thing into parts never happens by itself; the preview offers „In Teile aufteilen …“ when a thing fits no day in one piece.
- **„locken“** is called „fest“ in the app (a lock on the row; the word is already there). „gesperrt“ reads as disabled.
- **„verpasst“** is not printed above the list; the group says „Noch offen von Mo, Di“ and each row „war Mo“ – his days, without a verdict.
- Lock words in the field: „… fest“, „… lock“ or a trailing „!“. „Neues automatisch vorschlagen“ is off by default. Moving a locked thing by hand keeps its lock.
- **A date set in ToDos** is not laid into the plan by itself: the thing shows as a muted row with the chip „In ToDos: Do“ on that day's sheet, one tap („Hierher legen“) lays it.
- **Two devices:** phone and PC have to get the version together; a device on the old version would keep reshuffling ([CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) §5).
