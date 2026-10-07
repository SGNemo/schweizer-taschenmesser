# Implementation prompt: Nemo design overhaul "Klar 2"

This prompt is meant for a Claude Code chat that implements the design overhaul decided in `docs/design/DESIGN-SPEC.md`. It points to the specification and mockups instead of repeating them; everything that is mandatory for the implementation is stated here as a hard rule. Part B proposes the split into separate PRs for parallel chats.

---

# Task: implement the design overhaul – phase <N> "<name>"

## Goal
Implement Nemo's interface according to `docs/design/DESIGN-SPEC.md`: calm, clear, dark first, one main action per view, rows instead of cards, areas instead of a flat module list, motion only as feedback. The specification is decided; you implement it, you do not reopen it. For real gaps you ask (see way of working); when specification and mockup contradict each other, the specification wins.

Read first: `CLAUDE.md`, `docs/README.md`, `docs/design/DESIGN-SPEC.md` (all of it), then only the round report and the mockups of your phase (`docs/design/ROUND-<n>-*.md`, `docs/design/mockups/round-<n>/`). Mockups are standalone HTML files with made-up data; they show the target state and sizes, not code to copy.

## Branch and git
- Git rules: `docs/PROMPT-TEMPLATES.md#git`. Own branch `feat/design-<phase>` from a fresh `develop`; ignore a branch preset by the session. Row in `docs/CHATS.md` in the first commit (topic, branch, area), respect the hotspots listed there (`tokens.css`, `AppShell.tsx`, `router.tsx`, `strings.ts`, `core/modules/types.ts`).
- Small thematic commits (Conventional Commits, e.g. `feat(ui): …`, `refactor(todos): …`), push regularly. Before finishing, bring `develop` in with a merge (no rebase) and run the checks again.
- PR against `develop` (`gh pr create --base develop`), **do not merge**. If push or PR fails: STOP and print the PR text. No `main`, no tags, releases or force pushes.

## Hard rules
- Rules: `docs/PROMPT-TEMPLATES.md#hard-rules` and the hard rules in `CLAUDE.md` apply unchanged. In particular:
  - **Internal IDs stay**: bundle identifier `io.github.sgnemo.taschenmesser`, `tm-*` storage keys, database name, backup format IDs, package names, updater endpoints. `web/src/brand-ids.test.ts` must stay green.
  - **Security areas untouched**: signing, secrets, release audit, vault crypto (`core/crypto`, `modules/accounts` logic), local API transport, AI privacy (`privacy.test.ts`, `exclusion.test.ts`), disk block list and typed confirmation. There you only change presentation, never logic.
  - **Data**: write only via `createRepo`; no schema or data changes for design purposes (exception: `_settings` scopes for favourites/areas and `_meta` for device-local presentation, as in the specification).
  - **Module isolation stays**: areas are pure navigation (`manifest.area`), no module imports another.
  - **Tokens are mandatory**: no hex, radius, shadow, z-index or weight values in module CSS; everything comes from `web/src/ui/tokens.css`. Only documented exception: the treemap palette in `modules/disk/components/Palette.module.css`.
  - **One filled accent per view**; FAB only below 900 px; teal only for charts and the light focus ring.
  - **Motion** only `transform`/`opacity`, 120/200/250 ms, `prefers-reduced-motion` = instant; no page slides, no list stagger, no endless spinning.
  - **UI text only in `web/src/strings.ts`**; append new texts in the block of the respective module, do not reorder anything.
  - No new dependencies without asking (Lucide, dnd-kit, Inter are present).

## Way of working
- Start in **plan mode**: inventory of affected files, plan per step with order, risks, test plan. STOP until "Plan freigegeben" (plan approved).
- Then implement step by step; after each step `cd web && npm run check && npm test` (for UI steps also the affected E2E specs). Red is fixed immediately, never skipped or disabled.
- **Before/after screenshots** per step: `SCREENS_DESKTOP=1 SCREENS_SCHEME=dark|light SCREENS_VIEWPORTS=1280x720,1920x1080,412x915 SCREENS_PAGES='^(…)$' SCREENS_DIR=test-results/screens/<phase>/<before|after> npm run screenshots`. Take the before set before the first change. Both themes, desktop and phone.
- After each step: send screenshots via SendUserFile, report briefly, ask when deviating from the specification. Intermediate stops: after the plan, after the first visible step (tokens or shell), before the PR.
- Ask only when the specification is really silent (§ 13 "Open items") or something is technically impossible; then with a proposal and recommendation, bundled via AskUserQuestion.
- Parallel chats work on other phases (see part B). Only touch files of your phase; hotspots only with an announcement in `docs/CHATS.md`; on conflicts in `tokens.css` or `strings.ts` keep both contents.

## Phases (order; one chat per phase, see part B)
1. **Tokens** (`web/src/ui/tokens.css`, `tokens.test.ts`, `global.css`): values from SPEC § 5–6 (cool), `--text-3`, `--overlay`, `--shadow-1/2`, radii 8/12/16/20, focus outline, removal of `--accent-2*`, `--surface-glass`, `--*-soft` (status soft via `color-mix`), icon stroke 1.5 px, text size/density root variables (`data-text-size`, `data-density`). Dark block twice and identical. Test extended (SPEC § 11). Check dark first, then light.
2. **Shell and navigation** (`layout/AppShell*`, `useNavItems`, `MoreSheet`, `router.tsx`, `core/modules/types.ts` + `registry.ts` for `area`, settings scope for favourites/areas): hybrid sidebar with rail (SPEC § 2), areas and favourites (§ 3), top bar with one "+ New", tools label, bottom nav by areas, FAB only on mobile, area pages with sub-tabs, master-detail from 1200 px (`SPLIT_QUERY`), page change without slide. `strings.ts`: area names.
3. **Base components** (`web/src/ui/*`): button hierarchy, fields incl. `SelectField`, switch/checkbox/segmented/chips/tabs, `ItemRow` as the only list pattern, card without border, dialog with sheet variant as the default on the phone, toast with undo, badge tones, skeleton/EmptyState/error box, `Progress`, keyboard hooks (`N`, `G`+letter, `J/K`, `?`, `Ctrl+Z`) and shortcut sheet, multi-select bar, swipe helper. Component tests and a component-sheet screenshot.
4. **Home** (`web/src/home/*`, module widgets only via `WidgetList`): greeting, date, counter bar, column-based grid with "Today" as the only L widget, hero numbers, two-line rows, actions in the widget (tick off, paid, snooze), phone order.
5. **Modules** (one commit per module; only the modules that stay according to the module plan `docs/product/MODULE-PLAN.md`; order: invoices, subscriptions, budgets → finances → calendar (incl. the "Reminders" tab once package 5 is merged) → to-dos → pantry → notes, saved → accounts, documents (`vault`) → this PC (`disk`) → tools → settings, setup): switch to `ItemRow`, panel/sheet details, quick capture as "New", full forms with "More" chips, removal of the module copies of segmented/progress/inputs, module specifics according to `ROUND-7-MODULES.md`. **Do not touch:** retired modules (`news`, `habits`, `timetrack` from package 1; `reminders`, `shopping`, `packing`, `launcher`, `birthdays`, `gifts`, `contracts`, `system` after their copy in packages 1–5) and the new modules `lists` and `people`, which their packages 3 and 4 build directly in the new style.
6. **Motion** (`PageContainer.module.css`, `AppShell.module.css`, component CSS): patterns from SPEC § 9, removal of `pageIn`, `itemIn`, `pillIn`, sync spin, blur; reduced-motion check.
7. **Tests, screenshots, docs**: `lint`, `typecheck`, `test`, `e2e` (incl. `a11y.spec.ts` with themes, accents, densities), before/after screenshot sets in `docs/screenshots/<date>/` (only the README images and a small set, ≤ 1280 px), `docs/STATUS.md` (one line), `docs/DECISIONS.md` (one line + `docs/decisions/ui-brand.md`), `docs/howto/design-rules.md` and `docs/ARCHITECTURE-MAP.md` up to date, `CLAUDE.md` only if a root rule changes (accent, motion, areas).

## Quality
- Definition of done per phase: `npm run check`, `npm test`, `npm run e2e` green; app starts (web and, where available, `tauri dev`); contrast check via `tokens.test.ts`; axe without new violations; touch targets ≥ 44 px; keyboard path for every new action; reduced motion checked; before/after screenshots in both themes and three resolutions in the PR.
- No regression: click paths from `ROUND-1-DIAGNOSIS.md` § 3 must not get longer; the seven scenarios in the PR text with the click count afterwards.
- No dead code: replaced module CSS classes, components and strings are removed, not commented out.

## Closing
- PR text: `docs/PROMPT-TEMPLATES.md#pr-text` (What and why · Structure/changes · Numbers · How verified · Open questions · Hand-over), plus the screenshot pairs and the scenario table. Remove the row in `docs/CHATS.md` in the last commit.
- STOP after the PR; do not merge.

---

# Part B: split into separate PRs (parallel chats)

Aligned with the module plan (`docs/product/MODULE-PLAN.md`, target picture B: 9 nav entries + "This PC"). The design PRs only restyle modules that stay; retired modules (`news`, `habits`, `timetrack`, after their copy also `reminders`, `shopping`, `packing`, `launcher`, `birthdays`, `gifts`, `contracts`, `system`) are not restyled, and the new modules `lists` (package 3) and `people` (package 4) as well as the merges documents (`vault` ← `contracts`, package 4) and reminders → calendar (package 5) are built directly in the new style with the components from PR 3.

| PR | Phase(s) | Files (core) | Depends on | Can run in parallel with |
|---|---|---|---|---|
| **1 Tokens** | 1 | `ui/tokens.css`, `tokens.test.ts`, `global.css`, `index.html` (theme-color), `stores/ui.ts` (text size/density) | – | 3 (develop against the old names, rename variables at the end) |
| **2 Shell + areas** | 2 | `layout/*`, `router.tsx`, `core/modules/types.ts`, `registry.ts`, `available.ts`, `modules/*/manifest.ts` (only `area`), `strings.ts` (block `nav`), settings scope | 1 (tokens for rail/top bar) | 3, 4 |
| **3 Base components** | 3 | `ui/*`, `core/keyboard/*` (new), `ui/*.test.tsx` | 1 | 2, 4 |
| **4 Home** | 4 | `home/*`, `ui/WidgetList.tsx`, `modules/*/widgets/*` (only via the WidgetList API); contains the widget actions (tick off, paid, snooze), which makes package 2 of the module plan obsolete | 1, 3, package 1 | 2, 5a |
| **5a Modules money** | 5 | `modules/{finance,invoices,subscriptions,budgets}/**` | 2, 3 | 5b, 5c, 5d |
| **5b Modules plan** | 5 | `modules/{calendar,todos}/**` (calendar after package 5 incl. the "Reminders" tab) | 2, 3 | 5a, 5c, 5d |
| **5c Modules household + knowledge** | 5 | `modules/{pantry,notes,bookmarks}/**` (saved after package 3 incl. bookmarks) | 2, 3, package 3 | 5a, 5b, 5d |
| **5d Vault + this PC + tools + settings** | 5 | `modules/{accounts,vault,disk}/**` (UI only; `vault` after package 4 = documents, `disk` after package 1 = this PC with tab system), `tools/**`, `layout/ToolsSheet.tsx`, `pages/Settings.tsx`, `pages/settings/*`, `layout/setup/*` | 2, 3, package 1 | 5a, 5b, 5c |
| **6 Motion** | 6 | `PageContainer.module.css`, `AppShell.module.css`, component CSS, `Misc.module.css` | 2, 3 | 5x (motion touches no module files) |
| **7 Closing** | 7 | `e2e/a11y.spec.ts`, `e2e/screenshots/*`, `docs/**`, `README` images | all | – |

Order with the packages of the module plan: **Design 1, 2 → package 1 (0.4.0) → design 3, 4 → packages 3, 4, 5 → design 5a–5d, 6 → package 6 → design 7.** 5a can start right after design 3; 5b waits for package 5, 5c for package 3, 5d for package 4.

Rules for parallel work: every chat adds itself to `docs/CHATS.md`; `tokens.css`, `strings.ts`, `types.ts`/`registry.ts`, `AppShell.tsx`, `router.tsx` are hotspots (one chat per file, announce first); module chats only touch their module folders and their `strings.ts` block; PR 2 and 3 are merged before the module PRs; every module PR brings `develop` in with a merge before it is finished.
