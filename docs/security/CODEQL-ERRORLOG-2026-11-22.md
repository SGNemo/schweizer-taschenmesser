# CodeQL `js/clear-text-storage-of-sensitive-data` on `errorLog.ts` (2026-11-22)

**Alert:** high, `web/src/core/diagnostics/errorLog.ts` line 88 (`persist()` → `localStorage.setItem`), "sensitive data returned by an access to secrets". Shown on PR #1050 (`web/scripts` release audit); not reproducible on `develop` alone.

## Trace (CodeQL 2.27.5 CLI, `javascript-queries` `CWE-312/CleartextStorage.ql`, PR #1050 merge ref)

1. Source: the variable `secrets` in `web/scripts/audit-release.mjs` (a Node CI script), passed as `AuditCoverage.secrets` to `coverageFindings` in `web/scripts/lib/audit.ts`.
2. `coverageFindings` puts `s.name` – the **name** of an empty env variable from `AUDIT_SECRET_ENV`, never its value – into `Finding.detail`.
3. `audit-release.mjs` prints the finding with `console.error('::error::…')`.
4. CodeQL links that call to the function `installErrorLog` assigns to the global `console.error` (browser bundle), then `tag[1]` → `recordError(source)` → `entries` → `persist()`.

## Verdict: false positive for the app

- Step 3 → 4 joins two programs that never run together: the CI script runs in Node, never imports `core/diagnostics`, and is not in the app bundle; the hook exists only in the browser.
- The data is a variable name, which the script deliberately prints to the CI log.
- In the app no `console.error('[tag] …')` or `recordError` call passes a value from `getPlatform().secrets` (checked: all tagged calls in `web/src`).

## Fixed anyway (the real gap found on the way)

`scrub()` let short secret values through when a message named them (`password=hunter2`, `Authorization: Basic …`, `"apiKey":"P@ss!"`): the token rule needs ≥ 24 characters. Now redacted as `[secret]`; test `core/diagnostics/scrubSecrets.test.ts` (11 cases red before the fix), covering the persisted copy too.

## Dismissal

The fix does not silence the alert (CodeQL does not model a regex replace as a sanitizer). Per [howto/release-deps.md](../howto/release-deps.md): dismiss as **false positive** only after `nemo-security` concurs. Proposed reason (≤ 280 characters): *"Cross-program path: Node CI script audit-release.mjs console.error → browser console hook in errorLog.ts; they never run together, and the data is an env variable name. In-app values are scrubbed (scrubSecrets.test.ts)."*
