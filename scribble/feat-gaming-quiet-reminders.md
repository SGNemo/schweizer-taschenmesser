# feat/gaming-quiet-reminders (PR #180) – notes for the next chat

for the next chat:
- Game mode lives in `core/notifications/{gameMode,gameDelivery,sound}.ts`; Rust side `crates/system-info/src/{gaming,tone}.rs`. Overview: `docs/features/game-mode.md`.
- Hand tests Z1–Z5 (`docs/MANUAL-TESTS.md`) are open. Z2 decides whether the native `PlaySound` fallback stays: if Web Audio plays with the window hidden in the tray, drop it.
- Z1: by source (`tauri-winrt-notification` 0.8) a toast without `sound` is `<audio silent="true"/>`, so the old "OS toast sound cannot be silenced" note in `docs/decisions/focus.md` (Stumm entry) is probably outdated. Correct it once Z1 confirms.
- `policy.ts` got `quietAll` (+ `applyQuietAll`), `triggers.ts` listens to `onGameModeChange`. #181 touches the same files; only `policy.test.ts` conflicts (both append a `describe`).
- `npm run chats:status` crashed in my clone at `git merge-base origin/develop origin/alert-autofix-1` (no common history in a shallow clone). Worth a try/catch in `web/scripts/chats-status.mjs`.
- `tests/commands.rs` (src-tauri) cannot build on Linux without gdk; I compared `build.rs` / `lib.rs` / `desktop.json` by hand.
- Idea, not built: the app tone could also be offered outside game mode (desktop toasts are silent by default).
