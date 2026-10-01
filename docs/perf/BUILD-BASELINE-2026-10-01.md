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
