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
| `nemo-docs` | `docs/**`, `README*`, `strings.ts`, `i18n/` | – |
| `nemo-design` | UI review against `docs/design/DESIGN-SPEC.md` §4a, FOCUS-GUIDELINES | – |
| `nemo-security` | review of every security-relevant change ([RULES.md](../RULES.md)) | – |
| `nemo-reviewer` | every finished PR, before hand-over | – |

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
