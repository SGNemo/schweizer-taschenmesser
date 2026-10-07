# Docs guide – what goes where, budgets, style

Goal: a new chat starts with ≈ 2 000 tokens (hard budget 2 600, so there is room to grow) and loads details only on purpose. Check: `cd web && npm run check:docs` (warnings; `--strict` exits 1). Tokens ≈ bytes / 4.

## Where things go
| Kind | File |
|---|---|
| Rule every chat needs (short) | root `CLAUDE.md`; unabridged → `docs/RULES.md` |
| Area-only rule | `<area>/CLAUDE.md` (`web/src/modules`, `web/src-tauri`, `server`) – loaded only there |
| Where is X / interfaces / data flow | `docs/ARCHITECTURE-MAP.md`; long design notes → `docs/architecture/<topic>.md` |
| Why (decision) | one bullet in `docs/decisions/<area>.md` (what – why, date, sources); `docs/DECISIONS.md` is the index of areas |
| How (command, recipe, gotcha) | `docs/HOW-TO.md` index → `docs/howto/<topic>.md` |
| Status, open, limits, next steps | `docs/STATUS.md` (German parts stay German); hardware checklists → `docs/MANUAL-TESTS.md`; ideas → `docs/ROADMAP.md` |
| Running chats, hotspots | `docs/CHATS.md` |
| Report/audit/measurement | `docs/security/`, `docs/perf/`, `docs/features/`, `docs/meta/` (each with an index) |
| Finished/obsolete report | `docs/archive/<yyyy-mm>/` + banner |
| User docs, README | English source + German copy: `README.md`/`README.de.md`, `docs/user/<name>.md`/`<name>.de.md` (short, no dev details); change both, `npm run check:readme` compares them |

## Budgets (tokens)
| Class | Budget |
|---|---|
| Start context (root `CLAUDE.md`, no `@` imports) | ≤ 2 600 (target ≈ 2 000; raised 2026-10-02 so small rule additions need no cuts elsewhere) |
| Area `CLAUDE.md` | ≤ 500 |
| Lookup doc (every `docs/**` file not exempt) | ≤ 3 000; overrides in `web/scripts/check-docs.mjs` (MAP 4 200; DECISIONS 3 500; STATUS 5 000; CHATS/PROMPT-TEMPLATES 2 000; `docs/README.md` 700; DOCS-GUIDE 1 500) |
| Exempt (never auto-loaded) | `docs/user/`, `archive/`, `security/`, `perf/`, `features/`, `meta/`, `AI-IMPORT.md` (+ `.de.md`), `MANUAL-TESTS.md`, `ROADMAP.md`, `CHANGELOG.md` |
A file over budget is split by topic (index + `<dir>/<topic>.md`), not trimmed by dropping content.

## Style
- All docs English (source language); German only as `*.de.md` translations of user docs and README, plus the German parts named in STATUS/MANUAL-TESTS/legal. Chat docs: bullets, tables, paths; one fact once (link instead of copying); no history, no "this PR", no general knowledge.
- Every path/command must exist (verify with `ls`/`grep`/`npm run`); relative links only; mark or delete stale facts.
- Decisions get a date or release; status is one line per release.
- Pinned names: `docs/AI-IMPORT.md` + `.de.md` (read by `core/localapi/prompt.test.ts`), `README.md`, `README.de.md`, `docs/user/installation.md` + `.de.md` (read by `scripts/lib/releaseAssets.test.ts`, `docPairs.test.ts`), heading "Offen – macht Sven" in STATUS (referenced from `web/src/strings.ts`). Old section names ("Sync & backup", "Local AI import API", "Releases & CI") are kept inside the topic files because code comments cite them.
- Doc-only PRs skip heavy CI jobs (`ci.yml` `changes`): everything under `docs/` except the pinned files, root `CLAUDE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`.

## Archive rule
Move a report to `docs/archive/<yyyy-mm>/` when its findings are fixed or summarised in STATUS/DECISIONS; keep it unchanged below a banner (date, pointer). After a release, collapse the round log in STATUS to one line per release. `docs/archive/` is excluded from ripgrep/fd via `.ignore`.
