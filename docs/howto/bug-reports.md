# Bug reports, recovery, fixtures

## Reading a bug report
Users report through Settings → Über Nemo → Diagnose (or the command palette, or the error card): a prefilled GitHub issue (`bug_report.yml`: version, build, platform, steps) opens in the browser; the user may attach the diagnostics `.txt`. The app transmits nothing; `REPORT_MAIL` in `core/diagnostics/config.ts` is a placeholder (set it to enable "Per Mail melden").
- The file lists version/build/channel/platform/OS, active modules and tools, appearance, sync phase (no URL), record **counts** per module (vault excluded), migration state (Dexie version, module versions), storage, last 200 log lines and last 50 errors with 8 stack frames. Stacks are minified: match the build commit to the release tag's sourcemap/build.
- Everything passes `scrub()` (`core/diagnostics/errorLog.ts`); `diagnostics.test.ts` holds the negative list. New field in the report? Add a canary to that test.

## Recovery and safe mode
- Boot (`main.tsx`): `checkDb()` opens the DB and reads one row per table. Failure → `RecoveryScreen` (repair / restore backup / empty start after typing `NEU STARTEN`); always a copy of the defective state first (`dumpDb`, no `_secrets`/`_blobs`).
- Fatal render error → `RootErrorBoundary` → `FatalErrorScreen`. A module error → `ModuleErrorBoundary` (card; the rest keeps running).
- **Safe mode** (all modules off for one run, nothing saved): desktop `Nemo.exe --safe-mode` or env `NEMO_SAFE_MODE=1`; Android/browser: triple tap on the logo in the fatal screen (or its button), or `/?safe=1`. Leave: restart normally.

## Fixtures and the update path
- `web/tests/fixtures/backups/<tag>.json` = invented backup per release, `index.json` = that release's Dexie stores. Regenerate: `git fetch --tags && node scripts/gen-backup-fixtures.mjs`. New release → add the tag to `RELEASES`, run, commit. Details: that folder's README.
- `releaseFixtures.test.ts` restores each into the current schema. `npm run test:update-path` (e2e) creates the old browser database of the **last** release, starts the current build on top and checks upgrade, no recovery screen, data visible. It does not cover the real exe/apk: use [LAUNCH-CHECKLIST](../LAUNCH-CHECKLIST.md).
- Fresh install: `web/e2e/sync/fresh-install.spec.ts` (runs in `npm run e2e:sync`).
