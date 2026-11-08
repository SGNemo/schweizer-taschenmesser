# Agent team v3 – definitions, workflow, changes (proposal, not in force)

Branch `review/agents-v3`, PR into `develop`. Nothing here is binding until Sven re-creates the agents ([SETUP.md](SETUP.md)); the binding roster stays [../AGENTS.md](../AGENTS.md) + [../../decisions/meta.md](../../decisions/meta.md). Review with evidence: [REVIEW.md](REVIEW.md). `agents-v2/` stays untouched for comparison until the switch.

## Contents

| File                    | Purpose                                                                                                                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nemo-*.json` (20)      | **Source of truth.** Managed Agents definitions: model/effort per role, short prompt + five hard limits, tools and GitHub-MCP deny list per role, `multiagent` block only in `nemo-lead`. No secrets, no placeholder tokens (`scripts/agents/validate.mjs`).                          |
| `nemo-*.md` (20)        | Generated `ant apply` files (front matter + prompt body) – `node scripts/agents/to-ant.mjs`; never edit by hand (`--check` proves they match).                                                                                                                                        |
| `SHARED.md`             | The shared rule block every agent reads once per thread from the mounted repo (replaces 5 k chars × 20 prompts).                                                                                                                                                                      |
| `environment.yaml`      | Cloud environment, limited egress (package managers + MCP hosts).                                                                                                                                                                                                                     |
| `AGENTS.proposed.md`    | Proposed new `docs/meta/AGENTS.md` (Sven's decision).                                                                                                                                                                                                                                 |
| `SETUP.md`              | Step-by-step for Sven: Console, `ant`, vault/GitHub, start a session, restart.                                                                                                                                                                                                        |
| `../../scripts/agents/` | `validate.mjs` (offline schema check), `to-ant.mjs` (JSON → md), `session.mjs` (everyday runner: lead + env + repo mount + budget). `@anthropic-ai/sdk` is pinned (1.6.0) and not covered by Dependabot (`/scripts/agents` is not in `dependabot.yml`): `nemo-deps` bumps it by hand. |

## Team (roles; the model table derived from the JSON is [MODELS.md](MODELS.md))

| Agent                                        | Model · effort      | Role                                                                                                                                                                                                            | GitHub MCP      |
| -------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| nemo-lead                                    | Opus 5.5 · high     | delegates to the 19 via `send_to_agent`, verifies evidence, reports to Sven; no product code, no merge; workflows off, advisor off. Prompt in German (it talks to Sven); the other 19 and SHARED.md are English | read + comments |
| nemo-architekt                               | Opus 5.5 · high     | contracts, hotspots, plans first                                                                                                                                                                                | write           |
| nemo-security                                | Opus 5.5 · high     | review of every RULES.md-area change                                                                                                                                                                            | review          |
| nemo-reviewer                                | Opus 5.5 · medium   | review of every PR (MERGE-READY + head SHA)                                                                                                                                                                     | review          |
| nemo-creativity                              | Fable 5.1 · high    | ideas, fresh-eyes checks (fallback Opus high if not budgetable)                                                                                                                                                 | review          |
| nemo-frontend / backend / native / extension | Sonnet 5.5 · medium | implementation per area                                                                                                                                                                                         | write           |
| nemo-qa, nemo-deps, nemo-perf, nemo-devops   | Sonnet 5.5 · medium | tests, dependencies, measurements, CI (devops may re-run jobs)                                                                                                                                                  | write           |
| nemo-design, nemo-a11y, nemo-po              | Sonnet 5.5 · medium | UI review, accessibility review, requirements                                                                                                                                                                   | review          |
| nemo-merge                                   | Sonnet 5.5 · medium | the only agent that merges                                                                                                                                                                                      | merge           |
| nemo-docs, nemo-i18n                         | Haiku 5.5 · medium  | docs, UI texts (i18n: try Haiku, fall back to Sonnet on wording findings)                                                                                                                                       | write           |
| nemo-triage                                  | Haiku 5.5 · low     | CHATS/MANUAL-TESTS/scribble housekeeping                                                                                                                                                                        | write           |

"write" = PRs, comments, reviews; never merge/auto-merge/file writes via MCP. "review" = additionally no PR/branch/issue writes. "merge" = everything except repo-destructive tools. Web search/fetch off everywhere.

## Workflow v3 (one request from Sven)

1. **Start:** `node scripts/agents/session.mjs --budget <USD> "<Auftrag>"` – one session = lead + 19 subagent threads, one shared sandbox, one budget, repo mounted on `develop`.
2. **Situation** – lead reads SHARED.md, CLAUDE.md, STATUS, CHATS, open PRs (GitHub is the truth), `chats:status`; never assigns colliding work.
3. **Split** – one topic = one branch = one PR; big work = packages with a stop; phase 1 = plan, Sven says "Plan freigegeben".
4. **Implement** – area agent in its own worktree; `check` + touched specs locally, CI runs the rest; PR in hand-over format; report = the SHARED.md block (≤ 10 lines) in the thread + file in the notes dir.
5. **Review – full path:** reviewer always; security for RULES.md areas; design and/or a11y for UI. **Light path** (docs-/test-/i18n-only; never `.github/**`): reviewer (scope, CI, hand-over) → merge; no security/design/a11y, no local suites.
6. **Merge** – `nemo-merge` only: green checks, MERGE-READY + head SHA, note or `no-changelog`, merge commit with `expectedHeadSha`.
7. **Report** – lead: 3 points + PR links; open decisions bundled (≤ 4) via triage into CHATS "Wartet auf Sven". Budget reached → session pauses, `session.mjs budget <id> <USD>` resumes it.

## Changes v2 → v3

| Change                                                                                                      | Why (evidence in REVIEW.md)                                                                           |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `multiagent` block in `nemo-lead` (19 predefined, inline off, workflows off, advisor off)                   | v2 lead had none → it would do everything itself (finding 1)                                          |
| Shared block → `SHARED.md`, prompts keep role + 5 hard limits                                               | one source, −45 % prompt per agent, no 20× re-apply on a rule change (3a)                             |
| Models per role (Opus/Sonnet/Haiku/Fable) + effort                                                          | doc example "strong coordinator, small specialists"; Fable is in the model list (3c)                  |
| `web_search`/`web_fetch` off; GitHub-MCP deny lists per role                                                | limited networking blocks them anyway; tool lock beats prompt-only limits (1.3, 3e)                   |
| CI is the truth: no local `npm test`/full E2E                                                               | 13 + 10 min per agent, $0.08/h running time, CI runs them on every PR (3i)                            |
| Light path for small PRs (docs/test/i18n; `.github/**` stays on the full path)                              | v2 sent docs-only PRs through five agents (1.2)                                                       |
| Report = fixed block (≤ 10 lines) + file, never the diff in the thread                                      | lead context, thread reuse (3g)                                                                       |
| `checkout: develop` on the repo mount (`session.mjs`)                                                       | default is the repo's default branch = `main` (lesson 2026-11-07)                                     |
| Budget mandatory at session start                                                                           | can be raised/removed later, never added (3d)                                                         |
| `$GITHUB_TOKEN` = egress-substituted placeholder; REST via header only, git via the mount                   | vault mechanics (1.4)                                                                                 |
| `always_allow` kept explicit on both toolsets                                                               | MCP default is `always_ask`; "Permission … denied" is the `auto` policy's wording (1.4)               |
| Owners for `site/`, `services/`, `tools/`, `design/icon/`; `dependabot.yml` → deps; `contract/` → architekt | gaps/overlaps (1.1, 6)                                                                                |
| `ant apply` + `claude-lock.json` instead of the Console                                                     | Console-made agents cannot be adopted by `ant`; multiagent/effort/budget are API/CLI-only (SETUP 1–2) |

## Switch-over (after Sven's decision)

1. Rename `docs/meta/agents-v3/` → `docs/meta/agents/`, replace the path in the 20 JSON prompts (`docs/meta/agents-v3/` → `docs/meta/agents/`, incl. the lead's matrix pointer `AGENTS.proposed.md` → `AGENTS.md`), in `scripts/agents/session.mjs` (`leadFile`, `envFile`) and in `SETUP.md`; regenerate `.md` (`to-ant.mjs`), `ant apply`, then `ant apply --prune` for the old paths.
2. Replace `docs/meta/AGENTS.md` with `AGENTS.proposed.md` (fix its relative links: `../../` → `../`, `../../../CLAUDE.md` → `../../CLAUDE.md`); decision bullets in `docs/decisions/meta.md` (text in the PR).
3. Delete `docs/meta/agents-v2/`.
