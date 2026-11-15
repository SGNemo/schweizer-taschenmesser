# Planner hub – index of the round

Goal (maintainer, 2026-11-15): the planner becomes the hub – things from every module linked into it in both directions (mail ↔ invoice ↔ dunning ↔ planner, shopping, gym …) – and the page gets a redesign in several phases. Design round first (docs, mockups, measurement; no product code), then packages.

**Built** (2026-11-15): K1a, R1, F1, R2, K1b, K2, S1–S5, then M (measured after: [ANALYSIS-MEASURE](ANALYSIS-MEASURE.md#measured-after-the-round-m)). Decisions: [plan-hub](../../decisions/plan-hub.md), [plan-links](../../decisions/plan-links.md), [plan-sources](../../decisions/plan-sources.md). Mockups, the hand-off (`HANDOFF.md`) and the package prompts (`PACKAGES.md`) were removed with M and stay in the git history; images in the PR texts (branch `shots/planner-hub`).

| Phase | File (owner chat)                                                 | Content                                                                      | Friction ids |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------ |
| 1     | `ANALYSIS-MEASURE.md` (C), `web/e2e/usecases/planner-hub.spec.ts` | measurement 1920/412, click paths, design critique; measured after (M)       | P01–P39      |
| 1     | `ANALYSIS-SOURCES.md` (A)                                         | source matrix per module, links today, where the mail → invoice chain breaks | P40–P69      |
| 1     | `ANALYSIS-RESEARCH.md` (B)                                        | synthesis of the existing QA, persona and use-case material                  | P70–P89      |
| 2     | `CONCEPT-LINKS.md` (D)                                            | link contract (small / medium / large), dunning chain, source plan           | –            |
| 2     | `CONCEPT-DESIGN.md` (E)                                           | three directions (1920 and 412), copy de/en, target measured                 | –            |

Split-off files (docs budget): `ANALYSIS-LINKS.md`, `ANALYSIS-DESIGN-SYSTEM.md`, `CONCEPT-SOURCES.md`, `CONCEPT-COPY.md`, `CONCEPT-A11Y.md`. Sample data everywhere: Sunday 2026-11-15, Monday with nine things and 37 min free, six invoices whose deadline has passed. Not a source, ever: `accounts` (vault) – root `CLAUDE.md` „AI privacy“.

## Waits on the maintainer (moved from `PACKAGES.md`)

- D2 and D3 (they revise the split layout of 2026-11-12 and „the field is the last row“); mockups in the PR text of #922. A „no“ reverts R1, nothing else.
- Stimulus budget: R1 raised the planner views' counts; the approval is the maintainer's signature (until 2026-11-22 the proxy comment, `docs/howto/ci.md`).
- Two phone bounds R2 raised (C2, F on pixel-7: the folded „Frist vorbei“ row), see `MAX` in the spec.
- Planner on by default or in a setup profile (L11): only if wanted.
- Hand tests on real devices after R1 and S1 go into `docs/MANUAL-TESTS.md`.
