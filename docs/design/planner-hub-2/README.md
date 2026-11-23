# Planner hub 2 – „everything linked, fewer rows“ (index of the round)

Brief (maintainer, 2026-11-23): everything goes from the head into one field, unsorted; after that short ways to tick, move and plan – without changing the module. Eleven ordered ideas; principle 1 decides what is built: **fewer rows and fewer module switches, measured.** Design round only – **nothing here is product code.** What was built before: [planner-hub](../planner-hub/README.md), [planner-rethink](../planner-rethink/README.md), [usecases/tag-kippt](../usecases/tag-kippt/TARGET.md).

| File | What |
| --- | --- |
| [ANALYSIS](ANALYSIS.md) | idea × „exists / partly / missing“, the three flows measured, friction H01 …, critique of today's planner, the gate (what principle 1 strikes) |
| [CONCEPT](CONCEPT.md) | seven sentences every package keeps, new data, **the link contract** (idea 10) with the table per module |
| [CONCEPT-ROWS](CONCEPT-ROWS.md) | expand (4), collective rows (2), bundles and „Los“ (5), measured duration (8, struck) |
| [CONCEPT-INTAKE](CONCEPT-INTAKE.md) | share (1), kinds in the field (3), errands (6), appointment (9), topic (11), „Warte auf Antwort“ (7) |
| [DESIGN](DESIGN.md) | building blocks, the two decisions (expanded row, bundle) with for and against, critique per surface, FOCUS checklist |
| [COPY](COPY.md) | every new word, German and English, with ids and the rejected ones |
| [A11Y](A11Y.md) | keyboard paths, names, focus order, target sizes, review findings |
| `handoff/` | one hand-off per visible package (`00-common` first) |
| [PACKAGES](PACKAGES.md) | order, branches, hotspots, target figures, the shared block, „as built“; prompts in `PACKAGES-PROMPTS-A/B/C.md` |
| `mockups/` | HTML mockups + `render.mjs` (look only; pictures in the PR text) |
| [`planner-hub-2.spec.ts`](../../../web/e2e/usecases/planner-hub-2.spec.ts) | the measuring script: `IST` (green on `develop`), `TARGET` (asserted as packages land) |

Decisions of the round: [decisions/plan-hub-2](../../decisions/plan-hub-2.md). Sample data everywhere: Monday 2026-11-30, invented things. Never a source, target, label, pile, step or topic member: `accounts`.
