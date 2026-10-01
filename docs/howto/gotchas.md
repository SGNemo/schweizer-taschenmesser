# Gotchas, sandbox notes, ignore rules

Moved unchanged from CLAUDE.md. Index: [HOW-TO](../HOW-TO.md).

## Gotchas
- `pkill -f "<pattern>"` inside a shell command also matches that shell's own command line (exit 144, shell dies). Start servers with `&` + `echo $! > file` and `kill $(cat file)`; for `vite preview` the `[v]ite preview` trick works only when the pattern is not repeated elsewhere in the same command.
- Multi-device E2E lives in `e2e/sync/` (own config, `workers: 1`, shared server) and is ignored by `playwright.config.ts`. Helpers wait on IndexedDB (`_outbox` count) instead of UI state; use client-side navigation while a context is offline (a `goto` would fail).
- Tests that need "another device" create a second `TaschenmesserDB` (unit) or a second browser context (E2E); `MemoryServer` (`core/sync/testing.ts`, tests only) mirrors the server rule.
- Do not leave your own `vite preview` running on :4173 – Playwright reuses that port (`reuseExistingServer`) and would test a stale build. Stop it (`pkill -f "[v]ite preview"`) before `npm run e2e`.
- Async bus handlers (finance booking) finish *after* the UI action; E2E waits for their effect (e.g. poll IndexedDB) before navigating.
- E2E: a write is finished when the dialog that saved it has closed – wait for that (and for the UI to reflect it) before `goto`/`reload`. Fix the date with `page.clock.setFixedTime(...)`; `page.clock.install` + `fastForward` drives the notification scheduler. dnd-kit keyboard steps: wait for the live region (`[id^="DndLiveRegion"]`) between key presses.
- Unit tests run in the `node` environment; a test that needs a DOM starts with `// @vitest-environment jsdom` (docs/HOW-TO.md → Tests & checks).
- Vitest inlines `dexie` + `dexie-react-hooks` (`vitest.config.ts`); otherwise two Dexie copies break `useLiveQuery`.
- TypeScript is pinned to 6.0.x (typescript-eslint supports `<6.1`); `baseUrl` is not used (paths are relative).
- Controlled checkboxes update after an async DB write: in E2E use `click()` + `expect(...).toBeChecked()` instead of `check()` (Playwright's `check()` fails with "did not change its state").
- `web-push` always speaks HTTPS (even for tests); test the request with `generateRequestDetails` instead of a local HTTP server.
- E2E for the assistant: the Anthropic API is mocked with `page.route('https://api.anthropic.com/v1/messages')` (answer the CORS preflight `OPTIONS` yourself and add `access-control-allow-*` headers); test data is written straight into IndexedDB with envelope fields, so the app must have opened the DB once (`page.goto('/')`) first.
- The SDK's own retries slow error tests down: `createClaudeProvider({ maxRetries: 0 })` in unit tests.
- No secrets in the repo. API keys go through `getPlatform().secrets` (encrypted, local only); other tokens to the local `_secrets` table at runtime only.

## Sandbox
A Chromium is pre-installed at `/opt/pw-browsers/chromium`; `playwright.config.ts` and `gen-icons.mjs` pick it up automatically (override with `PW_CHROMIUM_PATH`). Never run `playwright install` there.

## Ignore rules
`.ignore` (repo root) keeps lockfiles, generated files, build output, icons and screenshots out of ripgrep/fd scans; `.gitignore` files cover build folders and secrets. Read excluded files explicitly when you need them.
