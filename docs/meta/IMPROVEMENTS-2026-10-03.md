# Improvement proposals – 2026-10-03

Result of the repo cleanup analysis ([CLEANUP-2026-10-03](CLEANUP-2026-10-03.md)). Proposals only; none of this was changed except where the cleanup file says so. Effort: S (< 1 day), M (1–3 days), L (> 3 days). "Conflict" = likelihood of clashing with running chats (see [CHATS](../CHATS.md)). P = protected area (sync, vault, crypto, localapi, seed/registry): needs the maintainer and a heads-up row first.

## Top 10

| # | Proposal | Why | Effort | Risk | Conflict |
|---|---|---|---|---|---|
| 1 | Typed row helpers in `core/db/repo.ts` / `tx.ts` instead of ~10 `as unknown as` | the data layer is the one place where a type hole hides every module's bugs | M | medium (central code, tests exist) | low |
| 2 | One `logError(tag, e)` feeding the redacted diagnostics log; replace ~40 silent `.catch(() => undefined)` (start with disk, `core/sync/service.ts:106` chain, localapi, vault bridge – P) | failures vanish today, diagnostics export misses them | M | low (never log tokens or bodies) | medium (sync, localapi) |
| 3 | `EditorActions` base component in `@/ui` for the Save/Cancel/Delete footer copied in ~9 module editors | biggest real duplication (23–27 lines each), one fix point for touch targets and focus | M | low-medium (mechanical, `NoteEditor` has a scratch variant) | medium (all modules) |
| 4 | Split `server/src/app.ts` `buildApp` (~410 lines) into route plugins (auth, ops, push, proxy); keep `store.ts` untouched | review and test cost, server tests exist | M | low | low |
| 5 | Split `ScanView.tsx` (516 lines, 18 hooks) into `useScanTrail`, `useScanActions`, sub-views | largest component; disk is a safety area, so keep the delete path byte-identical | M | low-medium (e2e disk) | low |
| 6 | Split `OnboardingWizard.tsx` (551 lines) into step components + reducer | same pattern as 5 | M | medium | medium (importer chats) |
| 7 | Add `complexity` and `max-lines-per-function` as ESLint **warnings** | makes 4–6 visible without blocking anyone | S | none | low |
| 8 | Whole-store subscriptions → selectors (`ScanPage.tsx` re-renders on every scan progress tick) | real perf win in the disk scan | S | low | low |
| 9 | Shared encoding helpers in `core` (`toHex`, base64/base64url) replacing 5 + 4 copies (P for sync/vault/backup copies) | duplicated byte code is where subtle differences hide | S–M | low-medium | medium |
| 10 | `MS_PER_DAY` + one push window constant in `core/time`; replace 8 literal copies (`push.ts` and `nativeSchedule.ts` define the same 14-day window twice) | wrong-in-one-place bug risk | S | none | medium (notifications, server push) |

## Further proposals

### Code structure
- `LocalApiSection` (~384 lines) and `AiSection`/`ProviderCard` (~281): move state and IO into hooks (`useLocalApiSettings`); behaviour must stay byte-identical (local API security rules). M, low.
- `CommandPalette` (~286), `BackupSection` (~255), `FocusPage` (~245), `SetupWizard` (~241): same hook extraction. M, medium. `accounts/components/ToolsDialog.tsx`: P.
- `core/ai/testing.ts` imports modules from `core`; move to a fixtures folder and exempt it in the isolation lint. S, low.
- `core/platform/fakeDisk.ts` (683 lines): confirm it is a lazy import / not in the production bundle; optionally split data from implementation. S–M.
- Central `Window` augmentation (`global.d.ts`) instead of repeated `window as unknown as {…}` (vault bridge fakes, audio context, BarcodeDetector); one `getAudioContextCtor()` shared by `core/focus/announce.ts` and `tools/timer/engine.ts`. S.
- `Date.now()` in `core/ai/providers/claude.ts:102` (retry-after), `platform/fakeLocalApi.ts:34`, `core/backup/verify.ts:61`: inject `now()`. S, low (fake-clock tests may change).
- `layout/setup/steps/NotificationsStep.tsx` branches on `platform.kind === 'android'`: could be a platform capability flag. S, optional.
- Rust files just over 600 lines (`disk.rs`, `tree.rs`, `drives.rs`): split `cfg(windows)`/`cfg(unix)` parts; `guard.rs` must not move or weaken. M, medium; leave as is.
- Hex/base64/byte-size/`pad`/`HH:mm` copies listed in the cleanup file (B1–B5): merge remaining non-protected copies into `core/time` and `core/format`. S each.
- Quick-capture parser date math (`quickCapture/parser/util.ts`) wraps own `{y,m,d}` helpers parallel to `core/time/dates.ts`: wrap the core string helpers. M, medium.

### Tests
- Per-test DB reset loops (`core/modules/widgets.test.tsx` and ~31 other files): a shared `resetDb` helper that clears only touched tables, or one fake-indexeddb DB per file. S–M, low (unprotected files only). Most wall time (≈150 of 237 s) is per-file setup, so the next real gain is Vitest config: try `isolate: false` for pure-logic folders and measure (the runner itself hints at ~1.5 s). M, medium.
- jsdom flow files (`CommandPalette`, `CaptureForm`, `AiSection`, `focusPage`, `nav`): merge adjacent read-only `it`s that each mount the whole tree. M, medium (isolation); only with a before/after case list.
- Run logic-only e2e specs on `desktop-chrome` only (keep both projects for shell, settings, layout, home, quick-capture): roughly halves their e2e time. Maintainer decision. S, medium.
- P, report only: real 1.8 s sleep in `sync/startSync.test.ts:68` (fake timers would cost ~0 ms), two real vite builds in `seed/devFlag.test.ts` (release-safety check; keep), KDF in vault tests, 70 000-iteration loop in `crypto.test.ts` (collect values, assert min/max once).
- Spy-heavy `core/modules/services.test.ts` and `core/update/controller.test.ts` assert call counts rather than outcomes. S.

### Repo hygiene
- Root `package.json` is `{}` and the root lockfile empty: delete both or give them a purpose (workspaces with shared scripts). The `@nemo/vault-core` alias is repeated in 5 configs (`web/tsconfig.app.json`, `web/vite.config.ts`, `web/vitest.config.ts`, `extension/tsconfig.json`, `extension/vitest.config.ts`) and `tsconfig.app.json` pins `tldts`/`zod`; a `file:` dependency or workspaces would remove that. M, medium.
- `ui/global.css` loads the Inter font through a `node_modules/` path; use a package import. S.
- Move `playwright*.config.ts` into `web/e2e/` (CI and script paths change). S, low-medium. Five identical `.prettierrc.json`: optional single root file.
- `.dockerignore` is minimal; check the build context in `server/Dockerfile`, then exclude `docs`, `web/src-tauri`, `extension`, `**/target`. S.
- Remaining old-name strings: `strings.ts` (UI text `'Taschenmesser'`) and the proxy user agent `Taschenmesser-Proxy/1` (`server/src/proxy.ts:254`); rename the user agent if nothing depends on it. S.
- `core/net` and `core/text` hold a single file each; merge into `core/` if nobody objects. S, cosmetic.
- `googleDrive.stub.ts`: keep (documents the planned adapter) or delete it with the comment in `core/sync/types.ts:24`.
- Dynamic string-key lookups (`backup.mergeHint`/`replaceHint`, probably `disk.del.errors.*`, `disk.filter.*`) defeat unused-key checks; a typed lookup helper would let a lint rule find dead strings safely. S–M.
- Test counts drift (258 test files in git vs 236 vitest files in `web`, because git also holds server, extension, packages and mcp tests); docs should name the command, not the number.

### Protected areas (maintainer only)
Silent catches in `accounts/bridge/control.ts` (a failed bridge registration looks like success), localapi `setTokens`/`appendLog` failures, sync promise chain (`core/sync/service.ts:106`), shared hex/base64 helpers touching `backup/encrypted.ts`, `sync/crypto.ts`, vault code. Signing, keystore, updater key, gitleaks, artifact audit and link check were not touched.

## Suggested PR order

1. ESLint warnings for complexity (7), selector fix (8), `MS_PER_DAY` (10) – small, independent, no conflicts.
2. Typed row helpers (1), then `logError` (2) – data layer first, so the logger can rely on it.
3. `EditorActions` (3) – after the module chats that edit editors have merged.
4. Component splits (5, then 6) and the server split (4) – independent PRs, one each.
5. Encoding helpers (9) – after the maintainer agrees on the protected copies.
6. Test tooling (DB reset helper, Vitest isolation experiment, desktop-only e2e) – last, measured against the baseline in [CLEANUP-2026-10-03](CLEANUP-2026-10-03.md).
