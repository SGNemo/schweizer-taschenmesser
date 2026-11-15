# Planner hub – index of the round

Goal (maintainer, 2026-11-15): the planner becomes the hub – things from every module linked into it in both directions (mail ↔ invoice ↔ dunning ↔ planner, shopping, gym …) – and the page gets a redesign in several phases. Design round first (docs, mockups, measurement; no product code), then packages.

One chat owns one file; nobody edits another chat's file. Friction ids are split so parallel chats never collide.

| Phase | File (owner chat)                                                 | Content                                                                      | Friction ids |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------ |
| 1     | `ANALYSIS-MEASURE.md` (C), `web/e2e/usecases/planner-hub.spec.ts` | measurement 1920/412, click paths, design critique, design-system audit      | P01–P39      |
| 1     | `ANALYSIS-SOURCES.md` (A)                                         | source matrix per module, links today, where the mail → invoice chain breaks | P40–P69      |
| 1     | `ANALYSIS-RESEARCH.md` (B)                                        | synthesis of the existing QA, persona and use-case material                  | P70–P89      |
| 2     | `CONCEPT-LINKS.md` (D)                                            | link contract (small / medium / large), dunning chain, source plan           | –            |
| 2     | `CONCEPT-DESIGN.md`, `mockups/` (E)                               | three directions (1920 and 412), copy de/en, target measured                 | –            |
| 3     | `HANDOFF.md` (F)                                                  | hand-off for package 1 (redesign foundation)                                 | –            |
| 3     | `PACKAGES.md` (G)                                                 | packages with final prompts, hotspots, acceptance figures                    | –            |

Rules of the round:

- Sample data everywhere (measurement, mockups): Sunday 2026-11-15, Monday with nine things and 37 min free, six invoices whose deadline has passed.
- Images only in PR texts (branch `shots/planner-hub` holds them); `docs/STATUS.md` and „Wartet auf Sven“ are edited by the orchestrating chat only.
- The four questions of phase 2 (link model, direction, first sources, head) are answered with the recommended options unless the maintainer says otherwise; each answer is recorded as revisable in `docs/decisions/plan.md` when phase 2 closes.
- Not a source, ever: `accounts` (vault) – root `CLAUDE.md` „AI privacy“.
