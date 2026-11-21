# Planner rethink – „a plan that stays put“

Branch `design/planner-rethink`, 2026-11-21. The maintainer's brief: the planner spreads new things instead of putting them on the day, moves missed things silently, reshuffles when he puts them back, and ends after a week. **Nothing here is product code.**

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | the use case as a script (figures), every trigger of a run, every rule that changes a day, friction R01–R15 |
| [ANALYSIS-DEPENDENCIES](ANALYSIS-DEPENDENCIES.md) | what hangs on the automaton (stays / changes / goes), research synthesis |
| [CONCEPT](CONCEPT.md) | states, the engine as a proposer, missed, entering, more than a week, moving, counter-scenarios, targets |
| [CONCEPT-MIGRATION](CONCEPT-MIGRATION.md) | stored shape, the one-time migration, finished things, mirror to ToDos, two devices, sources, the four invariants |
| [CONCEPT-COPY](CONCEPT-COPY.md) | every new word, German and English, with the rejected ones |
| [CONCEPT-DIRECTIONS](CONCEPT-DIRECTIONS.md) | directions A/B/C, critique, FOCUS checklist, accessibility review |
| [HANDOFF](HANDOFF.md) | what is on screen after package 1, states, edge cases, tests |
| [PACKAGES](PACKAGES.md), [PACKAGES-4-7](PACKAGES-4-7.md) | seven packages with their prompts |
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

## Answers (2026-11-21) – decisions in [decisions/plan-rethink.md](../../decisions/plan-rethink.md)

1. **Missed things:** the maintainer's own idea – a tab **„Noch offen“** in the planner; from there he spreads them again. Things that were fest land there too, marked, so he places them first ([CONCEPT](CONCEPT.md) §3). The mockups still show the group on today's sheet that was proposed.
2. **Sources with a deadline:** „Noch ohne Tag“ with the chip „Vorschlag: Do · Frist Fr“.
3. **Standard view:** one week with paging; „4 Wochen“ as a switch.
4. **Direction:** A „Blatt und Band“.

Read from his words and left uncontradicted: „aufteilbar“ = may be spread over days on request (never cut into parts by itself); „locken“ = „fest“; lock words „… fest“, „… lock“, „…!“; „Neues automatisch vorschlagen“ off; a date set in ToDos shows as a muted row „In ToDos: Do“; a pin on a later day is honoured at the update; phone and PC get the version together.

Next: [PACKAGES](PACKAGES.md) (seven packages, prompts), [HANDOFF](HANDOFF.md) (package 1).
