# Planner hub 2 – packages (order, figures, shared block, „as built“)

Prompts: [1 (10a, 10b, 4a)](PACKAGES-PROMPTS-1.md) · [2 (4b, 4c, 2)](PACKAGES-PROMPTS-2.md) · [3 (5a, 5b, 1)](PACKAGES-PROMPTS-3.md) · [4 (3, 9)](PACKAGES-PROMPTS-4.md) · [5 (11, M, struck 7, 8, 6)](PACKAGES-PROMPTS-5.md). One package = one Opus chat, one branch, one PR against `develop`; paste one prompt per chat. Figures: [ANALYSIS §3](ANALYSIS.md), script `web/e2e/usecases/planner-hub-2.spec.ts`.

## Order

**10a → 10b → 4a → (4b ∥ 4c) → 2 → 5a → 5b → 1 → 3 → 9 → 11 → M.** The first package to start is **10a**. Strictly one after another, each from fresh `develop` after the previous merge: every package touches `modules/planner/**`, most of them `PlannerPage.tsx`, `strings.ts` and `core/modules/types.ts`.

- The maintainer's proposed order (10 → 4 → 2 → 5 → 8 → 1 → 3 → 6 → 9 → 11 → 7) is kept; 8 and 7 are struck by principle 1 ([ANALYSIS §4](ANALYSIS.md)) and wait for an explicit „ja“; of 6 the part the script rewards (one row, the list ticked in the bundle) is built inside 5b, its places and map are struck.
- Split for size: 10 (contract / visible), 4 (frame / money / mail), 5 (steps / bundles).
- **Truly parallel:** 4b and 4c (different modules; shared only their `strings.ts` blocks and the script – the later one re-measures). Package 1 may run beside 5b (it touches `pages/ShareTarget.tsx`, not the planner page). Nothing else.
- 2 comes after 4b and 4c because a pile's member lines are their panels.

| # | Package | Branch | Scope (short) | Hotspots to announce | Review | Target figure (script) |
| --- | --- | --- | --- | --- | --- | --- |
| 10a | Link contract grows | `feat/plan-link-contract` | three relations; `links`, `day`, `origin` on the request events; four link targets | `core/modules/types.ts`, `core/events/events.ts` | `council` | unchanged – built as the base of 10b, 4, 9, 11, 1, 3 |
| 10b | „Im Plan · Mi“ everywhere | `feat/plan-mark-everywhere` | shared `PlanMark` in ten modules, read from the plan (prefix match for occurrence keys); no migration | `strings.ts` | `review-loop` | D1 `tripsToPlanner` → 0, mark visible 1 → 5, agrees 2 → 5 |
| 4a | The row opens | `feat/plan-row-expand` | compartment, `planPanel` contract, default / ToDos / lists / bookmarks panels | `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts` | `council` | C2 switches 2 → 1 |
| 4b | Pay and cancel in the row | `feat/plan-panel-money` | invoices panel (`PayStep`), subscriptions' first cancel step + panel | `strings.ts` | `review-loop` | B finished in the planner 1 → 5, switches 5 → ≤ 2 |
| 4c | Answer mail in the row (desktop) | `feat/plan-panel-mail` | mail panel, reply in place | `strings.ts` | `council` | B (desktop) finished + 4 |
| 2 | Collective rows | `feat/plan-piles` | `pile` contract, the planner as a plan source of itself, five sources, `PilePanel`, offer, switch, `?view=` routes | `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts` | `council` | B rows 5 → 2 / 1, switches 0, handles 27 → 13 / 14 → 8 |
| 5a | Steps and „Los“ | `feat/plan-steps` | `steps` contract, three sources, step mode of the focus page | `core/modules/types.ts`, `PlannerPage.tsx`, `strings.ts` | `council` | C1 switches 4 / 5 → 0, only the next step: yes |
| 5b | Bundles (incl. the errand round) | `feat/plan-bundles` | `planner_bundle`, „Bündeln …“, unbundle, save as routine, a list member ticked in the bundle | Dexie version, `PlannerPage.tsx`, `strings.ts` | `council` | C2 rows 2 → 1, switches 2 → 0, work handles 9 / 8 → 6 (bundling: 6 once) |
| 1 | Share → planner | `feat/share-planner` | planner as share target, URL kept, no manifest change | `strings.ts` | `council` | D2 handles 5 → 2, switches 2 / 3 → 1, way back: yes |
| 3 | Kinds in the field | `feat/plan-field-kinds` | preview line, sure-kind rules, one undo | `PlannerPage.tsx`, `strings.ts` | `council` | A1 right kind 4 → 12, rows 11 → 7; C1 create 12 → 1 |
| 9 | Before / after an appointment | `feat/plan-appointment` | calendar panel, lead chip, relations `before` / `after` | `PlannerPage.tsx`, `strings.ts` | `review-loop` | D3 handles 14 → 3, switches 4 → 0 |
| 11 | Topic | `feat/plan-topic` | `planner_topic`, `topic` links, chooser, filter | Dexie version, `PlannerPage.tsx`, `strings.ts` | `council` | D4 rows 20 → 7, handles 27 / 22 → 11, switches 2 → 0 |
| M | Measure after, close the round | `qa/planner-hub-2-remeasure` | script against `TARGET`, working documents removed | – | `review-loop` | every target met or the difference named |
| 8 | struck: measured duration | `feat/plan-measure` | only on „ja“; not before 5a | Dexie version | `council` | C1 learned: yes |
| 7 | struck: „Warte auf Antwort“ | `feat/plan-wait` | only on „ja“; not before 11 | `core/modules/types.ts` | `review-loop` | D5 handles 7 → 5 |
| 6 | struck: places and map of an errand | `feat/plan-errand` | only on „ja“; not before 5b | `core/modules/types.ts` | `review-loop` | C2 `mapShown` |

Review differs from the brief in three rows (4a, 2, 5a: `council` instead of `review-loop`): each changes the manifest contract, which [PROMPT-TEMPLATES#review](../../PROMPT-TEMPLATES.md#review) puts under `council`; 5b and 11 add synced data.

## common

Applies to every package prompt of this round (the prompts cite this anchor instead of repeating it).

- **Model and mode:** Claude Opus, unattended: no questions, no stop. What you decide stands in the PR under „Für dich entschieden“, what stays unclear under „Noch offen“.
- **Read first:** in this file „as built“ of every earlier package. Lies zuerst in PACKAGES.md „as built“ der Vorgänger; wo dein Prompt abweicht, gilt der gebaute Stand, und du trägst deinen eigenen „as built“-Absatz nach (same PR, ≤ 6 lines: what was built differently and why, new names of files and functions the next package needs).
- **Sources of truth, in this order:** the built state → your prompt → the concept section it names → the hand-off → [COPY](COPY.md). Words from COPY are taken literally (German into `web/src/strings.ts`, English into the catalogue); looks and measures from the hand-off are built as written, not redesigned. A real gap is closed the smallest way and named in the PR.
- **The seven sentences** of [CONCEPT §0](CONCEPT.md) and the four rules of [planner-rethink CONCEPT-MIGRATION §7](../planner-rethink/CONCEPT-MIGRATION.md) hold in every package; their tests are extended, never loosened.
- **Privacy:** planner stays `dataApi: false` without `aiSchema`; `accounts` is never a source, target, label, pile, step, topic member or share target (`core/entitylinks/exclusion.test.ts`, `privacy.test.ts` stay green and grow); nothing calls a model or the network.
- **Stimulus:** `npm run check:stimulus` unchanged for `d1920--planner` and `p412--planner`; a rise is not approved by this round – stop that part, say so in the PR.
- **Start and neighbours:** `npm run chats:status`; announce the hotspots of your row in the notes repo before the first commit; protected e2e specs only grow by appended `test(` calls – new checks go into new files.
- **Done:** `npm run check`, `test`, `e2e` green; `check:i18n`; the measuring script green with **your path's `IST` re-measured** (`E2E_SEED=0 npx playwright test e2e/usecases/planner-hub-2.spec.ts --trace off`; never loosened – the one sanctioned rise is C2 `createTaps` 0 → 6 in 5b, named in the script's header; before / after in the PR); `e2e/usecases/kopf-leer.spec.ts` and `tag-kippt.spec.ts` green when the planner page or the field changed; FOCUS checklist 1–9 answered in the PR.
- **Docs:** `.changes/` note (German and English, from his view); one bullet per decision in `docs/decisions/plan-hub-2.md`; STATUS one line in its own `docs(status)` PR; in [CHATS](../../CHATS.md) move the line „Planer-Zentrale 2“ on to the next package; screenshots 1920 and 412, light and dark, in the PR text.
- **Skills:** the ones your prompt names; `design:accessibility-review` on every visible package against [A11Y](A11Y.md); then `file-pr`, `babysit-pr`, `leaving-pr-comments`. Never merge.

## as built

(Each package adds its paragraph here, newest last.)

- **Design round (2026-11-23):** no product code. The script's `IST` is `develop` at 69b217cf. `feat/plan-import` and `feat/mail-find-overview` were not on the remote: package 2 checks whether the mail queue (a counting function and a route) is on `develop` and builds the money pile alone if not; package 4c reads what that branch changed at the thread head and the composer.
