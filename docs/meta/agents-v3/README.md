# Agent team v3.1 – Routing & Guardrails (2026-11-08)

Decided 2026-11-10 ([../../decisions/meta.md](../../decisions/meta.md)): these seven definitions and [SHARED.md](SHARED.md) are the agent team; [../AGENTS.md](../AGENTS.md) describes the roster; the lead delegates by the table in its own prompt (`nemo-lead.json`), which wins if the two differ. What is not applied yet: [Switch-over](#switch-over-state-2026-11-10). Evidence: [REVIEW.md](REVIEW.md). **Routing comes first:** [../WORK-ROUTING.md](../WORK-ROUTING.md) – Claude Code chats (subscription) build everything; the agents take only bounded coordination and review jobs.

## Changes v3 → v3.1

| Change                                                                                                                                                      | Why                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Roster 21 → 7 (lenses and modes instead of roles); 16 definitions deleted, `nemo-builder` and `nemo-ops` new                                                | fewer threads per task; one lead session with 9 delegations cost 82 USD (REVIEW "v3.1") |
| `docs/meta/WORK-ROUTING.md`: who does what, decline list, five questions, budget classes S/M/L                                                              | one source for routing; budget 200 USD/month                                            |
| Routing gate as the first step of every prompt (`validate.mjs` pins the line); guardrails block at the top of `SHARED.md`                                   | agents decline out-of-routing work before they spend tokens                             |
| Lead: routing gate, ≤ 4 threads, follow-up instead of a new thread, bundling; PO + triage folded in                                                         | threads, not work, drove the cost                                                       |
| Reviewer: correctness always, security lens for every path outside the light-path allowlist (`Security lens applied: <paths>`), design/a11y lens on UI paths | one review thread instead of three or four                                              |
| `nemo-merge` on Haiku low, trivial conflicts only (everything else back to builder/ops)                                                                     | the merge gate is a checklist; judgement stays with the reviewer                        |
| `session.mjs`: `--class S\|M\|L` (5/10/15 USD, default S), > 15 USD only with `--yes-expensive`, routing header, `--routing-check`, raise only with `--yes` | a session = a task = a budget, never raised to keep going                               |
| `validate.mjs`: exactly 7, model/effort per role, prompt ≤ 7 000 chars (lead ≤ 8 000, builder ≤ 4 353, merge ≤ 7 450), routing line, lead advisor Opus      | the rules are checked, not only written                                                 |

## Contents

| File                    | Purpose                                                                                                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `nemo-*.json` (7)       | **Source of truth.** Managed Agents definitions: model/effort per role, prompt = role + routing gate + five hard limits (plus the role's own limits and gates; shared rules from `SHARED.md` and root `CLAUDE.md` are cited, not restated), tools and GitHub-MCP deny list per role, `multiagent` block only in `nemo-lead` and `nemo-auditor`. No secrets (`validate.mjs`).             |
| `nemo-*.md` (7)         | Generated `ant apply` files – `node scripts/agents/to-ant.mjs`; never edit by hand (`--check` proves they match).                                                                                                                                                    |
| `SHARED.md`             | The shared rule block every agent reads once per thread from the mounted repo (guardrails first).                                                                                                                                                                    |
| `environment.yaml`      | Cloud environment, limited egress (package managers + MCP hosts).                                                                                                                                                                                                    |
| `../AGENTS.md`         | The v3.1 roster (was `AGENTS.proposed.md` here until 2026-11-10).                                                                                             |
| `SETUP.md`              | Step-by-step for Sven: Console, `ant`, vault/GitHub, start a session, costs, switch v3 → v3.1.                                                                                                                                                                       |
| `../../scripts/agents/` | `validate.mjs` (offline schema check), `to-ant.mjs` (JSON → md), `session.mjs` (runner: lead + env + repo mount + budget class). `@anthropic-ai/sdk` is pinned (1.6.0) and not covered by Dependabot: `nemo-ops` (mode `deps`) prepares the bump PR, Sven merges it. |

## Team (model table derived from the JSON: [MODELS.md](MODELS.md))

| Agent         | Model · effort                      | Combines                                                         | GitHub MCP |
| ------------- | ----------------------------------- | ---------------------------------------------------------------- | ---------- |
| nemo-lead     | Sonnet 5.5 · high, advisor Opus 5.5 | lead + po + triage; German prompt (talks to Sven)                | review     |
| nemo-builder  | Sonnet 5.5 · medium                 | frontend, backend, native, extension, i18n, qa fixes             | write      |
| nemo-reviewer | Opus 5.5 · medium                   | reviewer + design + a11y + security (lenses)                     | review     |
| nemo-ops      | Sonnet 5.5 · medium                 | devops, deps, perf (modes); never pushes `.github/**`            | write      |
| nemo-docs     | Haiku 5.5 · medium                  | docs + website texts + CHATS/MANUAL-TESTS/board                  | write      |
| nemo-merge    | Haiku 5.5 · low                     | unchanged role: the only agent that merges                       | merge      |
| nemo-auditor  | Fable 5.1 · high                    | unchanged: Sven's audit, own session, never in the lead's roster | review     |

Dropped without replacement: `nemo-creativity` (ideas → a Fable chat in Claude Code) and `nemo-architekt` (contracts are planned by a Claude Code chat; the lead declines contract/schema work per WORK-ROUTING).

"write" = PRs and comments (no reviews – only the reviewer posts them); never merge/auto-merge/file writes via MCP. "review" = additionally no PR/branch/issue writes. "merge" = everything except repo-destructive tools. Web search/fetch off everywhere.

**One level deep:** an agent with a `multiagent` block cannot be anyone's subagent (the API answers 400), so `nemo-auditor` is not in the lead's roster and `nemo-lead` is not in the auditor's. `nemo-merge` is left out of the auditor's roster (4 roles): an audit never merges, and a manipulated audit must not reach the only merging agent. `validate.mjs` checks exactly these two carry the block, every list ≤ 20, the lead's roster = all 5, the auditor's = all except `nemo-merge` (`ROSTER_EXCLUDE`), sibling names only, `inline_agents` and `workflows` disabled, the lead's advisor = Opus.

## Workflow v3.1 (one task from Sven)

1. **Route:** `node scripts/agents/session.mjs --routing-check` or WORK-ROUTING; "Claude Code" → a chat, not a session.
2. **Start:** `node scripts/agents/session.mjs "Routing: Lead, S (5 USD) · <title> · done means <…>"` – one session = one task = one budget class (S 5, M 10, L 15 USD), taken from the routing line (or `--class`).
3. **Gate + situation** – the lead classifies again (declines with a ready prompt head), reads SHARED.md, CHATS, open PRs, `chats:status`.
4. **Delegate** – at most 4 child threads, one per agent, bundled per area; follow-ups go into the open thread.
5. **Review** – `nemo-reviewer` with the lenses the paths need (security lens for every path outside the light-path allowlist in SHARED.md; light path = correctness only).
6. **Merge** – `nemo-merge` only: green checks, `MERGE-READY yes` + head SHA (+ `Security lens applied: <paths>`), note or `no-changelog`, merge commit with `expectedHeadSha`. The paths under "Sven merges himself" in SHARED.md are merged by Sven.
7. **Report** – budget class first, 3 points + PR links; then the session ends (a new task = a new session).

**Audit (Sven's tool, outside the flow):** `node scripts/agents/session.mjs "Routing: Auditor, M (10 USD) · PR #535 · done means: AUDIT-pr535.md"` – own session, `nemo-auditor` as primary agent; result `AUDIT-<pr|branch>.md` in the session outputs.

## Changes v2 → v3 (history; v3 roles were merged in v3.1)

| Change                                                                                                              | Why (evidence in REVIEW.md)                                                                           |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `multiagent` block in `nemo-lead` (19 predefined, inline off, workflows off, Opus advisor)                          | v2 lead had none → it would do everything itself (finding 1)                                          |
| Shared block → `SHARED.md`, prompts keep role + 5 hard limits                                                       | one source, −45 % prompt per agent, no 20× re-apply on a rule change (3a)                             |
| Models per role (Opus/Sonnet/Haiku/Fable) + effort                                                                  | doc example "strong coordinator, small specialists"; Fable is in the model list (3c)                  |
| `web_search`/`web_fetch` off; GitHub-MCP deny lists per role                                                        | limited networking blocks them anyway; tool lock beats prompt-only limits (1.3, 3e)                   |
| CI is the truth: no local `npm test`/full E2E                                                                       | 13 + 10 min per agent, $0.08/h running time, CI runs them on every PR (3i)                            |
| Light path for small PRs (docs/test/i18n; `.github/**` stays on the full path; v3.1: plain docs + `.changes/` only) | v2 sent docs-only PRs through five agents (1.2)                                                       |
| Report = fixed block (≤ 10 lines) + file, never the diff in the thread                                              | lead context, thread reuse (3g)                                                                       |
| `checkout: develop` on the repo mount (`session.mjs`)                                                               | default is the repo's default branch = `main` (lesson 2026-11-07)                                     |
| Budget mandatory at session start                                                                                   | can be raised/removed later, never added (3d)                                                         |
| `$GITHUB_TOKEN` = egress-substituted placeholder; REST via header only, git via the mount                           | vault mechanics (1.4)                                                                                 |
| `always_allow` kept explicit on both toolsets                                                                       | MCP default is `always_ask`; "Permission … denied" is the `auto` policy's wording (1.4)               |
| Owners for `site/`, `services/`, `tools/`, `design/icon/`; `dependabot.yml` → deps; `contract/` → architekt         | gaps/overlaps (1.1, 6)                                                                                |
| `ant apply` + `claude-lock.json` instead of the Console                                                             | Console-made agents cannot be adopted by `ant`; multiagent/effort/budget are API/CLI-only (SETUP 1–2) |

## Switch-over state (2026-11-10)

| Step | State |
| --- | --- |
| Decision for v3.1, roster in `docs/meta/AGENTS.md`, `docs/meta/agents-v2/` deleted | done ([../../decisions/meta.md](../../decisions/meta.md), 2026-11-10) |
| `ant apply` of the seven definitions and `--prune` of the 16 v3 agents ([SETUP.md](SETUP.md) §2a) | **open, Sven's step.** `claude-lock.json` (state 2026-11-10) lists six of the seven (`nemo-builder`, `nemo-ops` version 1; `nemo-docs`, `nemo-lead`, `nemo-merge`, `nemo-reviewer` version 2), no `nemo-auditor`, and still the 16 v3 agents. Whether the applied versions equal the files here cannot be seen from the repo: `ant apply --dry-run` shows it. Until then a running agent may carry an older prompt; `SHARED.md` is read live from `develop` either way. |
| First real run of `nemo-merge` rule 7 (stimulus ratchet) | open, deferred to December 2026 ([../../decisions/meta.md](../../decisions/meta.md)) |
| Folder rename to `docs/meta/agents/` | **dropped** (2026-11-10). The path is in every applied prompt (`cat …/docs/meta/agents-v3/SHARED.md`), is pinned by `validate.mjs` and is the key of every entry in `claude-lock.json`; a rename would break running agents until the next `ant apply` and buys nothing. "v3" in the path is a folder name, not the version: the version is the title of this file. |
