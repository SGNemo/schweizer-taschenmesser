# CI speed, round 2 – baseline 2026-11-04

Measured on `develop` @ `eeb4e03d` before any change. Round 1 is [BUILD-BASELINE-2026-10-01.md](BUILD-BASELINE-2026-10-01.md)
(PR checks 14.5 → 4.3 min). Since then the suite grew and the wait is back at 20–35 min. Source: GitHub REST
(`runs`, `jobs` with steps) for the last 30 runs of each workflow, job logs of one Windows release job and one
Dev-Preview run, local runs in the sandbox (4 vCPU). The cache listing API is blocked by the sandbox proxy, so cache
hits are read from job logs ("Cache hit for", number of `Compiling` lines).

## What changed since round 1

| | 2026-10-01 | 2026-11-04 |
|---|---|---|
| Unit tests | 168 files, 1596 tests, 2 min in CI | 598 files, 5421 tests, **7.7 min** median in CI (4.2 to 11.2) |
| E2E | 468 tests, 4 shards x 3 min | **1677 tests** (824 per browser project x 2 + 29 seed), 4 shards x **11.6 to 14.3 min** |
| Jobs per CI run | 7 | **19** (+ CodeQL 3, Website, Change note) |
| Windows release build | 7 min | **20.8 min** (llama.cpp + Vulkan, torrent crates) |

## 1. Per event: what a user waits for

Wall clock = first job start to last job end (jobs API), 12 CI runs, 14 Release runs, 7 real Dev-Preview runs.

| Event | Median wall | Range | Decided by |
|---|---|---|---|
| PR, all checks | **24 min** (CI 24 to 35 min; docs-only PR 7.4 min) | CI alone, 8 code PRs | queue (up to 15 min) + slowest E2E shard (11.6 to 17 min); CodeQL Rust runs 9 to 14 min next to it |
| Push `develop`, CI only | 9 min docs-only, 17 to 27 min code | | same chain as the PR |
| Push `develop`, with Dev-Preview | CI (17 to 27) **+ 13 to 14 min** build, in a row | | Dev-Preview `needs` every CI job, then builds |
| Push `develop` touching `web/src-tauri/**`, `web/scripts/**` | Release dry run **18 to 33 min** (median 23) | 29 runs | Windows job 20.8 min |
| Release (tag / dispatch on `main`) | same jobs as the dry run, cold cache (see 4) | | Windows job |

### Critical path today

```
PR / develop CI:
  queue 1 to 15 min -> checkout/npm ci 0.5 min -> E2E shard 4 (12 to 16 min) -> "Web" aggregate 4 s
  parallel, shorter: unit 7.7 | sync E2E 3.0 | Rust 2.6 | extension 2.5 | static 2.2 | stimulus 2.2 | 7 small jobs ~1
  parallel, outside ci.yml: CodeQL rust 9 to 14 | CodeQL js 2 | Website 3 (site/ only)

develop push, code change:
  CI critical path (17 to 27)  ->  Dev-Preview: gitleaks 1 -> prepare 0.3 -> Windows 13 || Android 5.6 -> publish 0.5
  Release dry run (parallel, own workflow): gitleaks -> prepare -> Windows 20.8 || Android 6.7

Release (tag): gitleaks 1 -> prepare 0.3 -> Windows 20 || Android 6 -> publish/audit/link check
```

## 2. Per job (median of the successful runs, minutes)

CI (8 code runs): E2E shards 14.3 / 13.1 / 11.8 / 11.6, Web unit 7.7, Sync E2E 3.0, Native shell 2.6, Extension 2.5,
Web static 2.2, Stimulus budget 2.2 (warning only), Sync server 1.1, Supporter 1.1 + 1.1, MCP 1.0, vault-core 1.0,
gitleaks 0.8, Local model 0.7 (up to 7.3 on cache miss), docs jobs 0.3, change detector 0.2.
Release dry run: Windows 20.8 (max 30.8), Android 6.7, gitleaks 0.6, prepare 0.3.
Dev-Preview: Windows 7.3 to 13 (build step 10 min), Android 5.5 (build step 4 min), publish 0.4.

Steps that decide: E2E step 905 to 910 s of a 950 s shard job; `npm test` 423 to 642 s of a 459 to 675 s unit job;
Windows release `Build` 1187 s of 1360 s; install/checkout/cache are 30 to 60 s per job.

## 3. Queue: jobs wait for a runner

In the two inspected runs, jobs of one CI run started between 0 s and 906 s after creation (the 19 jobs plus
CodeQL, Website, Change note of the same push and other open PRs compete for the free-plan concurrency cap of
20 Linux runners). Max job queue per CI run: 217 to 934 s on PRs (median ~600 s), 217 to 542 s on `develop`.
Release and Dev-Preview jobs start within seconds (Windows runners are a separate pool). So: **every extra job
costs queue time for everyone; fewer, fuller jobs beat more jobs** unless the job is on the critical path.

## 4. Caches

| Cache | Finding |
|---|---|
| npm (`setup-node cache: npm`) | hits, restore 6 to 8 s, `npm ci` 7 to 27 s. Fine. |
| Playwright browsers | hits (`install-deps` 11 to 12 s remains per job, needed for system libs). Fine. |
| Rust, Linux (`rust` job, Android) | hits, Android `Compiling` 57 crates only, build 4 min is Gradle/NDK link. |
| **Rust, Windows release (`release.yml`)** | **0 % useful: 476 of 476 crates compiled, 19 min 08 s.** The job builds into `CARGO_TARGET_DIR=C:/t` (path limit of llama.cpp), but `rust-cache` is configured for `web/src-tauri/target`: it restores and saves (621 MB, every run) a directory that holds nothing the build uses. |
| Rust, Windows Dev-Preview | partial: 254 crates compiled per run (cache key `rust-windows-…` is shared with the release job, the first writer wins, rust version in the key changes weekly). Build 10 min. |
| Cache scope | `main` is the default branch. A tag or dispatch run on `main` sees only caches written on `main`, never `develop`'s. `release.yml` dry runs write on `develop`, so a real release starts cold regardless of the fix above (unless a `main` warm-up exists). |
| gitleaks | built from source on purpose (`go install`, 20 s), not cached: a hard rule from an earlier review. Left as is. |

## 5. Redundant or avoidable work

| What | Evidence | Size |
|---|---|---|
| Every code PR runs all 19 jobs (server, MCP, vault-core, supporter x2, extension, Rust, local-llm, sync E2E even when only `web/src/modules/**` changed) | `changes` job knows only "docs or code" | 11 runners, 12 min of runner time, plus queue |
| E2E on every PR commit: 2 browser projects (desktop + Pixel 7) x 824 tests + seed project, shards 4 | `playwright test --shard=n/4`, 1677 tests | 4 runners x ~13 min = 52 min runner time |
| Playwright starts **two** web servers per shard (`build:e2e` and `build:e2e-seed`), each shard builds both | `playwright.config.ts` `webServer` | ~10 to 20 s per shard, 4x |
| `retries: 1` in CI for E2E | `playwright.config.ts` | hides flaky tests (not touched, reported in the PR) |
| Unit tests: one runner, one process pool for 598 files | `npm test` = `vitest run` | 7.7 min, 4 cores |
| Typecheck/lint/format twice: `Web static` and again inside the `extension`, `server`, `mcp`, … jobs for their own packages | separate packages, not duplicates | none to save |
| Dev-Preview waits for the whole CI (`needs` = 9 jobs), then builds 13 min | `ci.yml` `dev-preview` job | 13 min in a row on every code merge |
| Release dry run and Dev-Preview both build Windows + Android + gitleaks for the same commit | two workflows | different features (the dry run builds with `local-llm-vulkan`, the preview without), so the dry run is the only check of the release build. Cannot be dropped, only made cheap. |
| CodeQL: 3 languages on every PR, no `concurrency`, runs also on docs-only PRs | `codeql.yml`; Rust 9 to 14 min | keeps a PR "not green" after CI is done; a security step, see questions |
| Cloudflare Pages check red on every PR | `scribble/fix-site-cloudflare-checks.md`: `IMPRESSUM_*` missing in the Cloudflare project (Production and Preview) | needs the maintainer in the Cloudflare UI; not a repo change |

## 6. Local, same sandbox (4 vCPU)

| Step | Time |
|---|---|
| `npm ci` (web, cold) | 74.7 s |
| `vitest run`: 598 files, 5421 tests, all pass | summed file time 237 s on 4 cores; slowest files: `core/seed/devFlag` 13.1 s, `modules/maps/maps.page` 11.9 s, `CommandPalette` 8.5 s, `setup/steps/security` 6.6 s, `accounts/strengthOffline` 6.2 s |
| `playwright test --list` | 1677 tests in 119 files (desktop-chrome 824, pixel-7 824, seed-dev 29) |
| Full E2E, Rust Windows/Android builds | not run locally: ~45+ min on 4 vCPU; the main crate needs GTK/WebKit, Windows/Android need their runners. CI numbers above stand in. |

Per-file E2E timing is not available yet (CI uses the `github` reporter). First measure-only commit of Phase 2 adds
the JSON reporter output as an artifact of one run, so the smoke list is chosen from data.

## 7. Plan and expected gain (Phase 2, each measure its own commit with a measurement)

Targets and what is realistic: PR checks < 10 min is reachable for CI (about 7 to 8 min) **only if** the CodeQL
Rust job (9 to 14 min) is not counted or is moved; Dev-Preview < 20 min is reachable (about 14 to 16 min);
Release < 30 min is already true for a warm cache (about 10 to 12 min), and about 25 to 28 min cold.

| # | Measure | Event | Expected gain | Risk / note |
|---|---|---|---|---|
| 1 | Windows release: put `CARGO_TARGET_DIR` at job level so `rust-cache` caches `C:/t`; own cache key per variant (release / dev) | dry run, release | Windows 20.8 → ~8 min (warm), dry run 23 → ~10 min | artifact bytes unchanged (same profile, same sources); verify SHA of exe/APK |
| 2 | Warm-up for `main` caches (release dispatch reads only `main`): weekly + after sync-merges `release.yml` dry run also on `main` push | release | cold 21 → warm ~9 min Windows | extra runs on `main`; needs your yes |
| 3 | Pre-check job (per package: web, server, mcp, vault-core, supporter, webhook, extension, tauri, local-llm, site) → jobs run only for changed packages (shared `packages/**`, lockfiles, workflows count as "all") | PR, develop | fewer runners (19 → ~7 for a typical web change), queue 10 → ~2 min | "any doubt = run" like today; everything runs on `develop` and nightly |
| 4 | Unit tests in 3 vitest shards (`--shard`), same files, same assertions | PR, develop | 7.7 → ~3.5 min | +2 runners; per-test list compared before/after |
| 5 | E2E on PR: desktop-chrome only and the critical-path smoke list (3 to 5 min, from measured per-file times); **full suite (both projects, 6 shards) on `develop` push, nightly, and label `full-ci`** | PR / develop | PR: 14 → ~5 min; develop: 14 → ~9 min (6 shards) | what leaves the PR runs on `develop` and nightly; per-test list compared |
| 6 | Playwright: only the web server a shard needs (seed server only in the seed shard) | all E2E | ~20 s per shard | config only |
| 7 | Dev-Preview: build in parallel with the tests, **publish only after all checks are green** (publish job `needs` CI; build job `needs` only the pre-check) | develop | 17 to 27 + 13 → ~max(CI, 11) + 1 ≈ 16 to 19 min | splits `dev-preview.yml` into build + publish; gitleaks, audit, signing, keystore cleanup, link check all stay |
| 8 | Dev-Preview Windows: reuse the cache of measure 1 (own key); `concurrency` stays `cancel-in-progress` (debounce of several merges) | develop | Windows build 10 → ~5 min | |
| 9 | `concurrency` (cancel superseded) for CodeQL on PRs; `paths-ignore` stays off for CodeQL | PR | saves runner minutes only | no scan skipped on the final commit |
| 10 | Draft PRs: only static checks + unit; rest on "ready for review" or label `full-ci` | PR | draft PRs ~4 min | see question 3 |
| 11 | `sccache`, mold/lld, other Rust profiles | – | none measured (round 1: lld no gain; lto/codegen-units must stay for identical artifacts) | not done, reported |
| 12 | Larger runners | – | proposal only: 8 vCPU Linux halves E2E/unit shard time for ~2x price per minute (same cost per job, shorter wait) | not set up |

Not changed on purpose: gitleaks (every run, every history), artifact audit, signing, keystore cleanup, link check,
licence check, secret scan; `retries: 1` of Playwright (reported, flaky causes are a separate task).

## 8. Questions for the maintainer

1. (answered 2026-11-04: yes) **CodeQL Rust on PRs** (9 to 14 min, the longest check): run it on PRs only when Rust files changed, and always on `develop` push + weekly? It would be a security step that runs less often on PRs, so I do not do it without your yes. Recommendation: yes; the same code is scanned on `develop` anyway. Without it, "all checks green" on a PR stays at ~14 min.
2. (answered: smoke list plus label `full-ci`) **E2E on PR**: smoke list (desktop only, ~5 min) vs. whole suite on desktop only (~7 min). Recommendation: smoke list + label `full-ci`; full suite on `develop` and nightly.
3. (answered: yes) **Draft PRs** run only static checks and unit tests. OK? Recommendation: yes.
4. (answered: yes, on pushes to `main`) **Weekly warm-up of the `main` cache** (measure 2): scheduled run + release dry run on `main` push. Recommendation: dry run on `main` push only (no schedule), because it fits your release routine (merge to `main`, then release).

---

# After (measured on PR #439 and manual runs on `ci/speed-round-2`)

Honest limits: the PR changes workflows, so its pre-check turns **every** package on (worst case for a plain PR: 17
jobs); a typical `web/src/**` PR starts 14. Runs on the PR are real PR runs; the `develop` push and a real
tag release cannot be measured before the merge (details under "Not measured"). Fewer than 5 runs per event
exist because every run here is a run of this one PR; the tables list each of them.

## Wall clock per event

| Event | Before (median, range) | After (this branch) |
|---|---|---|
| PR, all CI checks | 24 min (24 to 35, loaded runner pool) | **4.7, 4.9, 8.4 min** with a free pool (17 jobs); **20.9 min** when the pool was full (one run: queue of 7 to 14 min for the 17 jobs, compute of the critical path 4 min) |
| PR, docs/scribble only | 7.4 min | not measured on its own (the pre-check skips every heavy job; unit-tested on 5 historical ranges) |
| Full run = `develop` push without preview (manual dispatch of `ci.yml`, 6 E2E shards) | 17 to 27 min | **11.7 min**, 21 jobs, queue at most 22 s |
| Dev-Preview after a green develop push | CI 17 to 27 min **then** 13 to 14 min | built next to the tests: expected CI 11.7 min + about 1 min publish gate = **about 13 min**; a stand-alone Dev-Preview run takes **8 to 9 min** warm. The split build/publish path is only exercised on a real `develop` push (see risks). |
| Release dry run (Windows + Android + audit) | 23 min median (18 to 33) | **11.3 min** warm (678 s); 25 min the one run that fills the cache |
| Real release (tag / dispatch on `main`) | same jobs, cache of `develop` not visible | first run on `main` is cold (about 25 min), later ones warm; the new dry run on `main` pushes keeps it warm |

PR critical path now (free pool): queue under 1.5 min, then the slowest of E2E smoke (209 to 264 s), unit shard
(165 to 269 s), static (141 to 178 s), sync E2E (146 to 193 s), extension (147 to 183 s). Remaining long pole outside
CI: CodeQL Rust (9 to 14 min) only on PRs that touch Rust.

## Per job

| Job | Before | After |
|---|---|---|
| E2E app, slowest shard | 14.3 min (4 shards, 824 x 2 projects + seed) | PR: smoke 3.5 to 4.4 min (171 tests, 2 shards); full: 6.6 to 11.0 min (6 shards, 1648 tests) |
| Web unit tests | 7.7 min (one job) | 2.8 to 4.5 min (3 shards) |
| Small packages (server, MCP, vault-core, supporter x2, webhook) | 6 jobs, each 1.0 to 1.1 min plus a runner each | one job, 81 to 123 s |
| Windows release build step | 1187 s, 476 of 476 crates compiled | **408 s warm, 15 crates**; job 609 s instead of 1360 s |
| Windows Dev-Preview build step | 653 s, 254 crates | **360 s warm, 14 crates**; job 486 s instead of 780 s |
| Android (release, dev) | 349 s, 333 s | 289 to 300 s (release warm), 412 s (dev, cache of the new key only half warm) |

## Caches

| Cache | Result |
|---|---|
| Windows release `rust-cache` | was 0 % useful. `rust-cache` does not follow `CARGO_TARGET_DIR` (it logged `src-tauri\target` although the job builds into `C:/t`); first fix attempt (env only) still compiled 476 crates, run 41787006854. Now `cache-directories: C:/t`: warm run restored 1004 MB and compiled 15 crates. Cost: a 1 GB cache entry per key on the repository's 10 GB budget. |
| Windows Dev-Preview | own key `windows-dev`; 254 to 14 crates compiled. |
| npm, Playwright browsers | unchanged, hit on every job. |

## Same coverage

| Check | Before | After |
|---|---|---|
| E2E tests listed | 1677 (824 + 824 + 29) | 1677: smoke 171 (PR), full 1648 + seed 29 (`playwright test --list` with the profiles) |
| E2E executed in the full dispatch run | – | 1542 passed + 105 skipped + 1 flaky = 1648 in six shards; sync job 15 passed, seed project 29 passed |
| Unit tests | 599 files, 5426 tests (full run, branch head) | three shards: 200 + 200 + 200 files, 1686 + 1899 + 1847 = 5432 tests, all passed (the PR run includes newer `develop` commits than the local run) |
| Security steps | gitleaks (4 workflows), artifact audit, signing, keystore cleanup, link check, licence check | unchanged and still on every run they ran on before; `git diff origin/develop -- .github/workflows` adds no step removal; CodeQL is the only scan that differs on PRs: Rust is scanned on a PR only when the PR touches Rust, by the maintainer's decision (every push to `develop`, the weekly run and manual runs scan all three languages) |
| Artifacts | exe 62 735 872 B, signed | exe 62 735 872 B in cold and warm dry runs (zip hashes differ: signature and zip timestamps; byte-identical exe is not provable from logs, same profile and sources) |

## Flaky tests seen (not changed, not retried; on `scribble/BOARD.md`)

`cockpit.spec.ts:123` (axe contrast, dark; failed twice in a row once), `notes.spec.ts:77` (view mode after reload),
`reminders.spec.ts:121` (clock), `automation.spec.ts:35` (flaky, passed on the built-in retry), `crates/torrent`
`preview_lists_files_and_selection_downloads_only_those`. Each passed on one re-run; the app code was identical.

## Not measured / risks

- **Dev-Preview staged path** (`stage: build` then `stage: publish` in one run) runs only on a push to `develop`.
  The `all` path (manual run) and the build jobs were run on the branch; publish gating was reviewed, not run. If the
  first merge shows trouble, `stage` can be dropped to `all` in `ci.yml` (one line) to get the old behaviour.
- Runner queue is outside the repository: a loaded pool turned 4.7 min into 20.9 min once. Fewer, fuller jobs help;
  larger or more runners would be the next lever (proposal below).
- A PR that touches only `.changes/` or `web/src-tauri/**` skips E2E on purpose.

## Open proposals (not done)

- Larger runners (8 vCPU Linux) for E2E and unit shards: about half the shard time at about twice the price per minute.
- Merge queue on `develop`: would let the PR run stay smaller; needs a repository setting.
- `retries: 1` in `playwright.config.ts` hides the flakes above as "flaky"; fixing causes is a separate task.

## Council review notes (round 1, applied)

Concurrency groups now include the event (a nightly dispatch cannot cancel a push run); CodeQL pushes to `develop`
are never cancelled or replaced; the E2E matrix falls back to the six shards if the pre-check fails; the
Dev-Preview publish also waits for `docs-pairs`; a release run reads but never writes the Windows cache. Known and
accepted: the seed step of the full run also builds the first web server (about 20 s); a skipped CodeQL Rust leg
shows a green check that says so in its log; no required status checks were found in the `develop` ruleset, so
retiring the old per-package job names blocks nothing.

Round 2 of the council (Architect 9/10 approve; Guardian 7/10, Advocate 8/10, then fixed): the licence check moved to
its own job so it still runs on every code change; CodeQL got a manual trigger; the release keeps one concurrency
group per ref. Declined as follow-up: the Dev-Preview publish stage recomputes version/tag in `prepare` (a tag pushed
between the two stages of one run, about 12 min apart, could change the label of the release; asset names and
signatures are unaffected).

---

# Dev release, round 3 (PR #462)

Goal: the Dev app as early as possible after a merge to `develop`. Measured on the real develop runs after round 2
(`41906185037`, `41898666199`, `41895791819`) and on manual Dev-Preview runs on the branch.

## Where the 14 to 15 minutes went

| Part | Time after the push |
|---|---|
| Windows build done (gitleaks + prepare in front: 70 s, runner start, setup 95 s, build 307 to 377 s, smoke test 25 s) | 7.5 to 9 min |
| Android build done | 6 to 8 min |
| Full E2E (six shards, desktop + Pixel 7) done, which the publish waited for | 11.5 to 13 min |
| Publish (prepare again 21 s + release step 25 to 32 s) | +1 min after the last gate job |

So the app was built 4 to 6 minutes before it was published. The time was spent waiting for checks.

## What changed

| Measure | Effect |
|---|---|
| Publish gate = gitleaks, licences, web static, unit tests, E2E smoke (24 spec files), native shell. Rest of E2E (1543 tests), sync E2E + seed project, small packages, extension, local model, docs checks, CodeQL run next to the build and after the publish | the publish no longer waits for the 11 to 13 min E2E; a red late check turns the run red but the preview is out. Tests: smoke 171 + rest 1543 = 1714 app tests, seed 29, as before |
| Gitleaks next to `prepare` and the builds (publish still needs it) | Windows and Android start after 20 to 25 s instead of 70 to 195 s |
| Publish stage gets version/tag from the build stage (no second `prepare`) | about 25 s, and no version drift between the two stages |
| `web-e2e-rest` and `e2e-sync` start after the smoke E2E | the six + one runners no longer take the gate's runners (free plan: 20 at a time) |
| `dev-preview` concurrency group per ref | a manual run on a branch can no longer cancel a develop preview (it did once while measuring) |

Expected: Dev app out about 9 to 10 min after the push (Windows build end + publish), instead of 14 to 15. The first
real develop run shows the number; a loaded runner pool can add minutes to any of it.

## Tried and dropped: Windows preview without fat LTO

`CARGO_PROFILE_RELEASE_LTO=false`, `CODEGEN_UNITS=16` for the Windows dev build only (env, no `Cargo.toml` change):
build step 488 s warm (486 s cold) against 377 s warm with the release profile, and the .exe grew from 15.3 to
17.8 MB (+16 %). Not faster, so reverted. The 14 workspace crates are compiled on every run (`rust-cache` keeps
dependencies only); a build that really got faster would need the workspace crates cached too.

## Unit coverage (measured once, not added to the repo)

`vitest --coverage` (v8, 599 files, 5426 tests): **lines 80.8 %, statements 79.3 %, functions 74.4 %, branches
73.8 %**. Weak in the unit tests alone: `pages` 40 %, `layout` 55 % (the E2E specs cover those), `modules/accounts`
76 %, `todos` 76 %, `calendar` 76 %; strong: `core` 87 %, `tools` 88 %, `maps` 92 %, `finance` 93 %, `i18n` 100 %.
There is no coverage gate in CI. Adding one means a dependency (`@vitest/coverage-v8`) and a slower unit job, so it
is only proposed: a floor of 78 % lines would pass today.

## Further levers, not done

- Android: build only `aarch64` for the preview (saves about 80 s, but Android is not the critical path).
- Cache the 14 workspace crates on Windows (needs `cache-workspace-crates` and size care on the 10 GB budget).
- Larger Windows runner for the dev build (cost).
- Move the Windows smoke test (25 s) after the upload; it is a safety gate before signing, so not done.
