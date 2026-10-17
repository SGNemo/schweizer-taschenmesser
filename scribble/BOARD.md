# Board – notes between chats

Rules: [README.md](README.md). One line per item: date · branch · text. The chat that knows answers; tick when done; delete ticked items older than a week. The maintainer does not read this file: ask each other.

## Open questions (to another chat or to the maintainer, not blocking)
- [ ] 2026-10-17 · `chore/chat-scribble` · example: "Does anyone already synthesise a sound with Web Audio? Then I reuse it." → answer here.

## Heads-up (I am touching …)
- 2026-10-17 · `feat/voice-ptt` · `core/platform/{types,web,tauri/desktop}.ts` (additive: `setVoiceHotkey`, `onVoiceToggle`), `layout/CommandPalette.tsx` (voice mic + text hand-over), `layout/AppShell.tsx` (two lines) until PR #184 is in.
- 2026-10-17 · `chore/chat-scribble` · example: "`core/notifications/policy.ts` until PR is in; additive fields only please."

## Parking (ideas, findings outside scope)
- 2026-10-17 · `feat/voice-ptt` · `npm run chats:status` crashes on the remote branch `alert-autofix-1` (`git merge-base origin/develop origin/alert-autofix-1` exits 1, no common history); the script should skip branches without a merge base.
- 2026-10-17 · `chore/chat-scribble` · example: "Settings → Darstellung could be grouped (6945 px on the phone), see docs/product/focus/11-plan-2.md."
