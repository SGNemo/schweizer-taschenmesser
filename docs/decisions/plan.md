# Decisions – Day and week planning (`planner`)

Index: [DECISIONS](../DECISIONS.md). Concept and prototype: [design/plan/CONCEPT.md](../design/plan/CONCEPT.md), packages: design/plan/PACKAGES.md (removed 2026-11-10, in the git history).

New decisions go into the matching topic file as one bullet (not into this index).

- [plan-contract](plan-contract.md) – Own module `planner`; source contract `contributions.plannable`; every open ToDo plannable; idempotent write-back, one `undoable`; pure engine in `core/plan/`; AI replanning is local-only, no `aiSchema`
- [plan-wochenende](plan-wochenende.md) – „Wochenende retten“ in the planner: „Rest verteilen“, „Als Pause …“ (`onRemove`), day parts, a deadline's hour (`due.time`, opt-in reminder)
- [plan-package-1](plan-package-1.md) – Plan in the calendar = one chip per day; calm by construction; package 1 scope and as built
- [plan-packages-2-5](plan-packages-2-5.md) – One field for entering and saying (2); more sources without write-back (3); Heute follows the plan; stage 1 in the planner field (4); optional windows (5); folded waiting group („Kopf leer“)
- [plan-hub](plan-hub.md) – Planner hub („Der Tag als Blatt“): sheet, week band and context column (D2); field first, the plus on the phone (D3); no filled action in the head
- [plan-links](plan-links.md) – One link contract between modules: `EntityLink`, `contributions.linkTarget`, `resolveLink` (planner hub)
