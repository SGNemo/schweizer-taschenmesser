# Agent team v2 – draft for review (not merged)

Branch `review/agents-v2`, no PR. Purpose: a fresh-eyes review (Fable) of the agent definitions and the workflow before Sven re-creates all agents. Nothing here is in force yet; the binding roster is still [../AGENTS.md](../AGENTS.md) and [../../decisions/meta.md](../../decisions/meta.md).

## Contents
- `nemo-*.json` (20): raw Claude Managed Agents definitions (name, model, description, system, mcp_servers, tools). No secrets: the GitHub token is supplied via the session vault as `GITHUB_TOKEN` and as the GitHub MCP credential, never in `system`.
- Models: all files say `claude-sonnet-5-5`; intended: Opus for lead, security, architekt; Fable for creativity; Haiku optional for triage. Effort: high for lead/security/architekt/creativity, low for triage, medium otherwise.

## Team
| Agent | Role |
|---|---|
| nemo-lead | delegates, scrum master, reports to Sven; writes no product code, never merges |
| nemo-po | requirements, priorities |
| nemo-creativity | ideas, fresh-eyes reviews of plans (Fable) |
| nemo-architekt | contracts, hotspots, package plans |
| nemo-frontend / nemo-backend / nemo-native / nemo-extension | implementation per area |
| nemo-deps | dependencies, pins, licences, audits |
| nemo-perf | size, cold start, memory measurements |
| nemo-i18n | UI texts de+en |
| nemo-design / nemo-a11y | UI review, accessibility review |
| nemo-qa | tests, E2E, regressions |
| nemo-devops | CI, release prep |
| nemo-docs | docs |
| nemo-security | review of every security-relevant change |
| nemo-reviewer | final review of every PR (verdict MERGE-READY + head SHA) |
| nemo-triage | CHATS.md, hand-test bundles, PR-format checks |
| nemo-merge | the only agent that merges |

## Workflow (one request from Sven)
1. **Situation** – lead reads CLAUDE.md, STATUS, CHATS, open PRs (GitHub is the truth); never assigns work that collides with running work (same files, hotspots, `docs/decisions/*.md`).
2. **Split** – one topic = one branch = one PR. Big work = packages with a stop between them. Phase 1 is always a plan (architekt or area agent), Sven answers ≤ 4 questions (recommendation first) and says "Plan freigegeben".
3. **Optional fresh eyes** – nemo-creativity reviews concepts/plans (format like `docs/design/sync-lan/REVIEW-FABLE.md`).
4. **Implement** – area agent in its own worktree `/workspace/wt-<agent>`, branch from fresh `develop`; CHATS row in the first commit, removed in the last; dependencies in their own commits (+ `gen:licenses`); root CLAUDE.md lines in their own commit; PR in hand-over format (What and why / Done / How verified / Open / Open questions / Next); label `no-changelog` when nothing is user-visible.
5. **Review** – nemo-security (when RULES.md areas are touched; also deps until nemo-deps exists) → author fixes on the same branch (no force-push) → nemo-reviewer gives `MERGE-READY yes/no` + reviewed head SHA. Findings deferred to the next package are written into the PR text under "Open".
6. **Merge** – lead hands the PR + reviewed head SHA to nemo-merge; it waits for all checks (incl. CodeQL, Windows job), merges with a merge commit and `expectedHeadSha` into `develop` (MCP first, REST with the session token on 403). Never `main`, tags, releases.
7. **Report** – lead: 3 points + PR links to Sven; open decisions bundled (≤ 4) into CHATS "Wartet auf Sven".

## GitHub rules
- MCP first; on 403 "Resource not accessible by integration" REST with `$GITHUB_TOKEN` is allowed for PRs, PR text, labels, comments, reviews and (nemo-merge only) merges.
- A harness permission denial ("Permission to use bash has been denied") is never worked around: stop, report the exact remaining commands to the lead. Tools are set to `always_allow` in v2 to avoid these stops.
- One token with admin rights for all agents (Sven, 2026-11-07); the prompts' hard limits are the guard.

## Lessons from the session that produced this (2026-11-07, LAN sync #520–#526)
- Local checkout sat on `main` → always read `origin/develop`.
- CI traps: `gen:licenses` after dependency changes; `cargo fmt` inside each path crate; bundled-C crates off the msvc cross-check; Windows path separators in source-scan tests (caught by the new Windows job); docs budgets.
- Agents lost bash mid-task three times → handover with exact commands worked; `always_allow` should prevent it.
- Reviewers could not post GitHub approvals (token owner = PR author) → written MERGE-READY verdict counts.
- The lead merged via REST once without approval → now only nemo-merge merges.

## Questions for the reviewer
1. Gaps or overlaps between agents (e.g. design vs a11y, docs vs i18n, devops vs deps)?
2. Is the workflow too heavy for small PRs (docs-only, CI-only)? Where can steps be skipped safely?
3. Are the hard limits enough given an admin token for all agents?
4. Anything in the shared block of the prompts that is wrong, redundant or missing?
