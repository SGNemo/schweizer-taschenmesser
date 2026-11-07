# Agent team – roster, delegation, sandbox start

For Claude Managed Agents sessions. `nemo-lead` delegates and writes no product code; every agent still follows root [CLAUDE.md](../../CLAUDE.md). Delegation format: [PROMPT-TEMPLATES.md#delegate](../PROMPT-TEMPLATES.md#delegate).

## Roster and delegation matrix

| Agent | Area (paths) | Always together with |
|---|---|---|
| `nemo-po` | unclear requirements, priorities, stories (`docs/ROADMAP.md`, `docs/STATUS.md`) | – |
| `nemo-architekt` | contracts, hotspots: `web/src/core/modules/{types,registry}.ts`, `core/platform/**`, `ui/tokens.css`, Dexie schema; plan first | heads-up row in [CHATS.md](../CHATS.md) |
| `nemo-frontend` | `web/src/**` except `core/platform`, `core/sync`; also `modules/accounts`, `core/diagnostics`, `core/supporter` | `nemo-design` (UI), `nemo-qa`; `nemo-security` for accounts/diagnostics/supporter |
| `nemo-backend` | `web/src/core/sync`, `server/**`, `mcp/**`, `contract/` | `nemo-security` |
| `nemo-native` | `web/src-tauri/**` (crates in `web/src-tauri/crates/`) | `nemo-security` |
| `nemo-extension` | `extension/**`, `packages/vault-core` | `nemo-security`, `nemo-native` |
| `nemo-qa` | tests, E2E, regressions | – |
| `nemo-devops` | `.github/**`, release prep, changelog | `nemo-security` |
| `nemo-docs` | `docs/**`, `README*` (UI texts/catalogs: `nemo-i18n`) | `nemo-i18n` |
| `nemo-design` | UI review against `docs/design/DESIGN-SPEC.md` §4a, FOCUS-GUIDELINES | – |
| `nemo-security` | review of every security-relevant change ([RULES.md](../RULES.md)) | – |
| `nemo-reviewer` | every finished PR, before hand-over | – |
| `nemo-deps` | dependencies and supply chain: `package.json` + lock files (`web/`, `server/`, `mcp/`, `extension/`, `packages/vault-core`), `web/src-tauri/**/Cargo.toml`, `Cargo.lock`, `web/scripts/licenses.manual.json`, `web/src/core/about/licenses.json`; `cargo audit`, `npm audit`, `cargo tree -e features`, exact pins for security-critical crates, `npm run gen:licenses` after every change; deps in small separate commits | `nemo-security` (pins, bumps in crypto/sync/extension), `nemo-devops` (Dependabot, audit jobs), `nemo-perf` (before/after sizes) |
| `nemo-perf` | bundle/critical path (`check:bundle`), cold start (`measure:coldstart`), data layer (`measure:data`, `measure:micro`), memory, exe/APK size from CI artifacts (sandbox cannot build Tauri/Windows); reports `docs/perf/**`, `web/scripts/bundle-budget.json` (baseline only on approval) | `nemo-deps` (numbers for every dependency change), `nemo-architekt` (indexes/schema), owner agent for fixes |
| `nemo-triage` | scrum helper for the lead, docs only: `docs/CHATS.md` tables ("Wartet auf Sven", "Läuft gerade", hotspot heads-ups, stacked PR order), bundled hand-test checklist in `docs/MANUAL-TESTS.md`, PR hand-over format check (Done/Open/Next/How to verify), `scribble/` housekeeping | `nemo-merge` (merge order, labels), `nemo-qa` (hardware-only vs. automated) |
| `nemo-i18n` | UI texts: `web/src/strings.ts` (append in the module's block only), `web/src/i18n/locales/{de,en}/**`, `docs/i18n/GLOSSARY.md`, `docs/howto/i18n.md`; `npm run check:i18n`; calm wording per FOCUS-WORDING; es/fr/pt-BR frozen, never touched | `nemo-docs` (user docs/README pairs), `nemo-frontend` (wiring keys), `nemo-design` (tone) |
| `nemo-a11y` | accessibility review and small fixes: AA contrast, touch ≥ 44 px, keyboard/focus (`data-autofocus`), screen-reader semantics, motion transform/opacity, colour with text/icon (`ui/semantics.ts`), reading aid (`core/text/readjsx`); `web/e2e/a11y.spec.ts`, reports `docs/design/A11Y-<date>.md` | `nemo-design`, `nemo-qa`; fixes beyond small via `nemo-frontend` |
| `nemo-merge` | merges merge-ready PRs into `develop` (standing order 2026-11-07): all checks green, non-stale approval (`nemo-reviewer`, `nemo-security` where RULES.md applies), change note or `no-changelog`, merge commit + `expectedHeadSha` only, `develop` brought in by merge, conflicts per CHATS.md hotspot rules (lock files by tools, `db:bump`, keep both rows/blocks), stacked PRs in order; never `main`/tags/releases/force-push, never over a real security/CodeQL finding | `nemo-reviewer`, `nemo-security`, `nemo-triage` |
| `nemo-creativity` | idea generator and fresh-eyes reviewer (Fable): idea briefs ranked in `docs/product/ideas/**` (problem, idea, fit, shape, risks/rule conflicts, smallest first step), "Fable checks" of concepts and package plans (format `docs/design/sync-lan/REVIEW-FABLE.md`); checks every idea against privacy, supporter and FOCUS rules; no product code, no commits on feature branches | `nemo-po` (prioritisation), `nemo-architekt` (feasibility), `nemo-security` for vault/sync/extension ideas |

Merge: `nemo-merge` is the only agent that merges PRs (maintainer's standing order 2026-11-07, [decisions/meta.md](../decisions/meta.md)); every other agent, incl. the lead, never merges. Agent prompts live as v2 JSON outside the repo.

## Sandbox start (every session)

| Step | How |
|---|---|
| Repo | `/workspace/schweizer-taschenmesser`; if not mounted: `git clone https://github.com/SGNemo/schweizer-taschenmesser /workspace/schweizer-taschenmesser` |
| Parallel agents | the clone belongs to the lead's branch; each agent runs commands in its own worktree: `git worktree add --detach /workspace/wt-<agent> origin/develop`, and writes notes/results to its own directory |
| Push | only with a token (`GITHUB_TOKEN`); without: stop and print the PR text. GitHub actions (PRs, reviews, checks) via GitHub MCP; workflow runs via REST `GET` |
| Long commands | a tool call times out after ≈ 5 min: run `npm test` (≈ 13 min), E2E (one spec ≈ 10 min) with `nohup … > /tmp/<job>.log 2>&1 &` and poll |
| Playwright | `/opt/pw-browsers/chromium` exists (symlink); no env vars needed; never `playwright install` |
| Rust | `cargo fmt`, crate tests (e.g. `-p taschenmesser-local-api`) work; the shell crate (`tests/commands.rs`, clippy, Tauri build) needs gtk/webkit – not available in the sandbox; no Windows target |
| `npm ci` | per package: `web/`, `server/`, `mcp/`, `extension/`, `packages/vault-core` (extension resolves vault-core from `src`, no build first) |
| Source of truth for PRs | GitHub (`list_pull_requests`), not the "Wartet auf Sven" table |

## Rules for this file

Set up on 2026-11-07. Changes to this file, the agent prompts, or root CLAUDE.md need a maintainer decision (docs/decisions/meta.md) – agents do not change them on their own.
