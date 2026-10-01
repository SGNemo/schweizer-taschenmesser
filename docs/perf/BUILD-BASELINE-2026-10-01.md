# Build, test and CI timings – baseline 2026-10-01

Measured on `develop` @ `039f2f9` before any performance change. A "after" section is appended at the end of the
work (see bottom). Raw numbers; reasoning and decisions are in the pull request.

## Environment

| | Local | CI |
|---|---|---|
| Machine | sandbox, 4 vCPU (Intel Xeon 2.1 GHz), 15 GB RAM, Node 22.22, Rust 1.97 | GitHub-hosted `ubuntu-latest` / `windows-latest` (4 vCPU) |
| Chromium | pre-installed, Playwright 1.63 | Playwright cache + `install-deps` |
| Not measurable locally | main `taschenmesser` crate (no GTK/WebKit), Windows build, Android build | taken from the CI logs below |

CI runs used: develop push `36788198450` (CI) and `36788198521` (Release dry run), PR runs `36786340143` and `36783846781`.

## CI (before)

Wall clock of a whole CI run: 14.4 min (`36788198450`), 14.5 min (`36786340143`), 16.6 min (`36783846781`).
One job (`web`) decides it; every other job is done in under 3 minutes.

| Job | Duration | Notes |
|---|---|---|
| Web (lint, types, unit, E2E) | 14 min 22 s | npm ci 8 s, format 9 s, lint 17 s, typecheck 13 s, unit tests 2 min 35 s, Playwright `install-deps` 16 s, E2E 10 min 35 s |
| Native shell (fmt, clippy, tests) | 2 min 49 s | apt libs 54 s, rust-cache restore 46 s, fmt 2 s, clippy 22 s, test 20 s, cache save 18 s |
| Multi-device sync E2E | 1 min 53 s | `install-deps` 14 s, tests 69 s |
| Secret scan (gitleaks) | 22 s | scan itself 1 s (cached binary) |
| Sync server | 22 s | |
| MCP wrapper | 17 s | |

Release workflow dry run (`36788198521`, runs on every develop push touching `web/src-tauri/**`, `web/scripts/**` or the workflow):

| Job | Duration | Notes |
|---|---|---|
| Secret scan | 17 s | |
| Version, changelog, signing check | 8 s | |
| Windows (portable) | 10 min 27 s | toolchain 27 s, rust-cache restore 38 s, npm ci 28 s, **build 7 min 9 s** (release profile: fat LTO, codegen-units 1), smoke test 25 s, rust-cache save 52 s |
| Android APK | 6 min 32 s | SDK/NDK 37 s, **build 4 min 50 s**, rust-cache save 18 s |
| Wall clock | 11 min 5 s | |

Queue wait: none (every job started within 3 s). Caches hit (npm, Playwright, gitleaks, rust-cache).

## Local (before, 4 vCPU)

| Step | Time |
|---|---|
| `npm ci` web / server / mcp | 19.8 / 9.2 / 4.1 s |
| `version:check` | 0.4 s |
| `format:check` | 16.6 s |
| `lint` | 33.5 s (warm 32.3 s) |
| `typecheck` | 25.8 s (app 20.0, sw 1.1, node 3.3; run one after the other) |
| `npm test` (vitest) | 221.6 s, 168 files, 1596 tests; test bodies sum to 49 s, rest is module import (56 %), jsdom creation (28 %) |
| `vite build` / `build:e2e` / `npm run build` | 2.9 / 4.3 / 27.5 s (`build` runs the typecheck first) |
| E2E app (4 shards, 2 workers each) | 264 + 238 + 243 + 243 s = about 16.5 min; 468 tests (465 pass, 3 skip); summed test time 1900 s |
| E2E sync | 93 s, 14 tests |
| Rust, 3 crates without Tauri: `cargo test --no-run` cold / warm | 29.6 / 0.5 s |
| Rust, `cargo test` run | 3.0 s (71 tests) |
| Rust, `cargo build --release` cold / warm | 12.8 / 0.6 s |
| `cargo fmt --check` | 0.8 s |
| server: format / lint / typecheck / test / build | 1.4 / 2.4 / 3.1 / 4.5 / 2.4 s |
| mcp: format / lint / typecheck / test / build | 0.7 / 1.7 / 2.2 / 1.3 / 1.7 s |

### Slowest unit-test files (ms)

sync/hardening 8609, SetupWizard 4467, setup/steps/security 3558, settings/AiSection 2206, io/feed 1938,
crypto 1571, importer/moduleImporters 1425, quickCapture/CaptureForm 1317, CommandPalette 1257, ai/privacy 1241.

### Slowest unit tests (ms)

sync "uploads hundreds of records in batches" 5165, io/feed "ignores duplicates and caps the number of entries" 1711,
sync "resumes an interrupted first upload" 1445, crypto "randomInt stays in range" 1400, setup security "creates the
vault only on commit" 1304, sync "resumes an interrupted download" 1278, SetupWizard "saves each step" 963.
These tests are deliberately heavy (data volume, key derivation); they are not touched.

### Slowest E2E files (sum over both browser projects, seconds)

a11y 627, layout 375, disk 128, extras 93, money 87, assistant 78, core 59, modules 58, accounts 52, backup 49.
Slowest single tests: a11y "tools: toolbar sheet and every tool" about 30 s, a11y "dialogs" about 21 s, layout
"every page fits the window" about 18 s per viewport.

## Experiments (flags only, nothing changed)

| Experiment | Result |
|---|---|
| vitest `--pool=vmThreads` | 46 s, but 149 tests fail (WebCrypto realm) |
| vitest `--no-isolate` | 27 s, but 5 tests in 4 files fail (shared Dexie singleton) |
| vitest `--pool=threads` | 222 s, 3 timezone tests fail |
| vitest `--environment=node` | 153 s; only 22 of 168 files need jsdom |
| Playwright 4 workers on 4 cores (shard 1/4) | 212 s instead of 264 s, 1 test failed under load |
| eslint `--cache` / prettier `--cache`, warm | 2.6 s instead of 31.5 s / 3.8 s instead of 16.5 s |
| cargo `debug=line-tables-only` | no time gain on small crates, target dir 340 -> 272 MB |
| lld linker | no gain |

---

# After (same document, measured on branch `chore/build-performance`)

Measured on the pull request (#18): CI run `36825777063` (head `4057d25`) and `36826601517` (head `f748902`, with
`develop` merged in), Release dry run `36826255580` (manual run on the branch, no `version` input, nothing published).
Local numbers on the same 4 vCPU sandbox as the baseline. Timings of unchanged commands vary by about 30 % between
runs (compare `lint` 33.5 s before, 24.2 s after, with no change to lint), so read small differences as noise.

## CI wall clock

| Run | Before | After |
|---|---|---|
| PR / push CI run | 14 min 26 s, 14 min 30 s, 16 min 32 s | **4 min 19 s**, 4 min 10 s |
| Runner minutes of all jobs added up | about 20.5 min | about 21 min (the work is spread over more runners, not reduced) |

## CI jobs

| Job | Before | After |
|---|---|---|
| Web (one job: static checks, unit tests, 468 E2E tests in sequence) | 14 min 22 s | replaced by the five rows below |
| Web static (format, lint, types) | 47 s of steps inside the web job | 1 min 3 s (own runner, includes install) |
| Web unit tests | 2 min 35 s inside the web job | 1 min 55 s (vitest 90.6 s) |
| E2E app, four shards | 10 min 35 s | 3 min 2 s, 3 min 6 s, 2 min 57 s, 3 min 57 s (the slowest shard sets the wall clock) |
| Web (lint, types, unit, E2E), aggregate with the old check name | – | 4 s |
| Which parts changed (docs-only gate) | – | 6 s |
| Native shell | 2 min 49 s | 1 min 56 s (cache restore luck, job unchanged) |
| Multi-device sync E2E | 1 min 53 s | 1 min 53 s |
| Secret scan, Sync server, MCP wrapper | 22 s, 22 s, 17 s | 16 s, 25 s, 14 s |

E2E per shard: 117 + 117 + 117 + 114 passed (plus 3 skipped) = the same 465 passed + 3 skipped as the single job.

## Release workflow (dry run)

Only six `timeout-minutes` lines were added to `release.yml`; no build, signing, audit or cleanup step changed. The
differences below come from cache state and runner speed, not from the change.

| | Baseline (develop push `36788198521`) | After (manual run on the branch `36826255580`) |
|---|---|---|
| Wall clock | 11 min 5 s | 7 min 38 s |
| Windows job / build step | 10 min 27 s / 7 min 9 s | 6 min 52 s / 5 min 13 s |
| Android job / build step | 6 min 32 s / 4 min 50 s | 6 min 2 s / 4 min 41 s |
| GitHub Release job | skipped | skipped (no publish) |

Artifacts, compared from the job logs (the artifact storage host is not reachable from the sandbox):

| | Baseline | After |
|---|---|---|
| Signed APK, SHA-256 | `bdc9f8b829a6cb11…8f71893f` | `bdc9f8b829a6cb11…8f71893f` (identical) |
| `Nemo-Portable.exe` / `.sig` size | 10 555 392 B / 404 B | 10 555 392 B / 404 B |
| Android artifact zip | 24 562 080 B | 24 562 080 B |
| Release audit | 247 files, 5 secret values searched, passed | 247 files, 5 secret values searched, passed |

## Local

| Step | Before | After |
|---|---|---|
| `npm test` | 221.6 s | 115.1 s (118.0 s after merging `develop`) |
| Everyday gate: format + lint + typecheck | 75.9 s one after the other | `npm run check`: 34.2 s cold, 5.7 to 5.9 s warm |
| `lint` / `typecheck` / `format:check` (unchanged commands) | 33.5 / 25.8 / 16.6 s | 24.2 / 18.4 / 11.2 s (machine noise) |

## Tests still check the same things

- Unit: 168 files and 1596 tests before and after; the per-test list (file, full name, status) is identical, all
  passed. 27 files start with `// @vitest-environment jsdom` (the 22 that fail without a DOM, plus 5 whose app code
  silently falls back when `localStorage`/`window` are missing, found by a probe that logged every DOM-global read in
  node). The other 141 run in node.
- E2E: 468 tests listed before and after, 465 passed and 3 skipped, split over four shards. Sync E2E 14, server and
  MCP unchanged.
- There is no coverage tooling in the repository and none was added; the per-test comparison above replaces a
  coverage diff.
- Security steps: `git diff origin/develop -- .github/workflows/release.yml` is six added `timeout-minutes` lines;
  in `ci.yml` the secret-scan job gained only its own `timeout-minutes` and runs on every change.
