# Prompt templates

Blocks for the maintainer's prompts. Reference a block instead of repeating it: `Git rules: see docs/PROMPT-TEMPLATES.md#git`. What applies to **every** chat is already in root [CLAUDE.md](../CLAUDE.md) ("How chats work here", "Hard rules") and must not be repeated in prompts: branch from `develop`, PR into `develop`, no `main`/tags/releases/force-push, Conventional Commits, no secrets, update only STATUS/DECISIONS/MAP/HOW-TO, CHATS.md row.

## git
- Own branch `<type>/<topic>` from fresh `develop` (`git fetch`, update `develop`, branch). Ignore a branch name the session suggests.
- Work only there; small thematic commits, push regularly (`git push -u origin <branch>`; retry on network errors only).
- Before finishing: `git fetch`; if `develop` moved, merge it into the branch (no rebase), resolve doc conflicts keeping both contents; re-run checks.
- PR against `develop`, do **not** merge. If push or PR fails: stop and print the PR text.

## hard-rules
- Scope: only the files named in the task; no drive-by refactors; out-of-scope findings go into the PR text.
- Nothing is lost: every rule, decision, open item stays findable somewhere.
- Verify every path and command against the repo; stale facts are removed or marked, not guessed.
- Security rules (signing, secrets, vault, updater, "never user data to the AI") may be shortened but never weakened.
- No secrets, tokens, real data or private paths (public repo).

## knowledge
- Write what the next chat needs into the repo, not into the chat: status → `docs/STATUS.md` (one line), decision → `docs/decisions/<area>.md` (index `docs/DECISIONS.md` only for a new area), structure → `docs/ARCHITECTURE-MAP.md`, recipe → `docs/HOW-TO.md` / `docs/howto/`, report → `docs/security|perf|features|meta`.
- Keep it short: bullets, paths, tables; no history, no prose, no general knowledge. Budgets: [meta/DOCS-GUIDE.md](meta/DOCS-GUIDE.md); check with `npm run check:docs`.
- Add/remove your row in [CHATS.md](CHATS.md).

## phases
- Phase 1 delivers measurement, report and plan, then **stop** until the maintainer writes "Plan freigegeben". Use an Explore subagent for broad inventory to keep your own context small.
- One topic per PR; split big work into packages with a stop between them, so the maintainer can pause after any package and resume later (each package = own branch and PR, state in [CHATS.md](CHATS.md) and the feature note).

## questions
- **Fragen an Sven:** always bundled in one `AskUserQuestion` per stop, at most 3–4 questions, each with a recommended option first ("(Recommended)"), short German labels, no open essay questions. Everything that does not change the next step is decided by the chat and named in the report.

## closing
- Final message: **3 points + PR link**, nothing more. Point 1 what changed, point 2 how it was verified, point 3 what waits on the maintainer (also add it to "Wartet auf Sven" in [CHATS.md](CHATS.md)).

## pr-text
English. Sections: **What and why** · **Structure/changes** (tree or list, moved/merged/deleted → target, new files → purpose) · **Numbers** (before/after) · **How verified** (commands + result) · **Open questions** · **Hand-over** (Done / Open / Next). Repo template: `.github/PULL_REQUEST_TEMPLATE.md`.

## Shorter prompts
Replace long boilerplate by: `Git: docs/PROMPT-TEMPLATES.md#git · Rules: #hard-rules · Docs: #knowledge · Questions: #questions · Closing: #closing · PR: #pr-text`, then only the task-specific goal, scope and acceptance criteria.
