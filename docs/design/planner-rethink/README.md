# Planner rethink – „a plan that stays put“

Branch `design/planner-rethink`, 2026-11-21. The maintainer's brief: the planner spreads new things instead of putting them on the day, moves missed things silently, reshuffles when he puts them back, and ends after a week. **Nothing here is product code**; package 1 starts after the four answers below.

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | the use case as a script (figures), every trigger of a run, every rule that changes a day, friction R01–R15 |
| [ANALYSIS-DEPENDENCIES](ANALYSIS-DEPENDENCIES.md) | what hangs on the automaton (stays / changes / goes), research synthesis |
| [CONCEPT](CONCEPT.md) | states, the engine as a proposer, missed, entering, more than a week, moving, migration, counter-scenarios, targets |
| [CONCEPT-COPY](CONCEPT-COPY.md) | every new word, German and English, with the rejected ones |
| [CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md) | directions A/B/C, critique, FOCUS checklist, accessibility review |
| [`mockups/`](mockups/) | `a.html`, `b.html`, `c.html`, `render.mjs` |
| [`planner-rethink.spec.ts`](../../../web/e2e/usecases/planner-rethink.spec.ts) | the measuring script: `IST` (green on `develop`), `TARGET` (for package 7) |

## The figures in one table

| | Now | Target |
| --- | --- | --- |
| Things that change their day without an action (week laid, two days missed) | 5 of 10 | 0 |
| Things that move while he moves another one | 5 | 0 |
| Handles to put five missed things back | 17 | 1 (all on today) to 10 (each on its own day) |
| New thing lands on the day on the sheet (empty / full / kept free) | no / no / no | yes |
| A thing onto a day in three weeks | not possible | 4 taps |

## Questions (waits on the maintainer; recommendation first, „ok“ takes all four)

1. **Missed things:** collect in one quiet group on top of today („Noch offen von Mo, Di“, each row says „war Mo“) – _recommended_: it is where he looks, and one tap puts all of them on today. Or: stay on their old day, marked, and he pages back to find them.
2. **New things from sources** (invoice, subscription, list): arrive under „Noch ohne Tag“ with a chip „Vorschlag: Do · Frist Fr“, one tap takes it – _recommended_: nothing sits on a day he did not choose, and the deadline stays visible in „Nächste Fristen“. Or: laid on the proposed day at once, marked as a proposal.
3. **Standard view:** one week with paging, „4 Wochen“ as a switch – _recommended_ (stimulus budget, same surface on the phone). Or: two to four weeks always.
4. **Direction:** A „Blatt und Band“ – _recommended_. Or B „Wochenbrett“, C „Monatsblatt“ ([CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md) §1).

Decided without asking (say so if wrong): the lock keeps the word „fest“ (not „gesperrt“); the missed group is not called „Verpasst“; lock words in the field are „… fest“ and a trailing „!“; long things are not cut into parts unless asked; „Neues automatisch vorschlagen“ is off by default.
