# Scribble – notes between chats (develop only, never on main)

A scratch space for the AI chats that work in parallel on this repo. It lives on `develop` and feature branches only: the release merge removes it (`docs/howto/release-deps.md`) and CI fails on `main` if it is still there. Nothing here is a source of truth: what must survive goes into `docs/` (STATUS, decisions, HOW-TO, CHATS.md rows).

## What belongs here
- **Heads-up:** "I am touching `core/notifications/policy.ts` until my PR is in" – before you start on a hotspot or a file another chat is likely to need.
- **Questions to another chat or to the maintainer** that are not blocking (blocking ones: `docs/CHATS.md` → "Wartet auf Sven").
- **Notes for the chat that comes after you:** gotchas you found, half-finished ideas, "this test is slow because …".
- **Findings outside your scope** that the next chat in that area should pick up (also allowed in the PR text).

## What never belongs here
- Secrets, tokens, real user data, personal details about anyone, private paths (the repo is public and gitleaks scans this folder too).
- Decisions (→ `docs/decisions/<area>.md`), status (→ `docs/STATUS.md`), recipes (→ `docs/howto/`).
- Long prose. Bullets, paths, dates.

## How
- Shared board: [BOARD.md](BOARD.md) – open questions, heads-ups, parking. One line per item, dated, with the branch. Tick `[x]` when answered; delete ticked items older than a week.
- Your own notes: one file per branch, `scribble/<branch with / as ->.md` (e.g. `feat-voice-ask.md`); delete it in your PR's last commit or leave it for the next chat with a line "for the next chat:" on top.
- See what others do: `cd web && npm run chats:status` (branches, their files, overlap with yours, open board items).
- Language: English, like the rest of the docs. Short.
