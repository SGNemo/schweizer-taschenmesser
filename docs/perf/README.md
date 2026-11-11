# Performance reports

| File | Date | What |
|---|---|---|
| [BUILD-BASELINE-2026-10-01.md](BUILD-BASELINE-2026-10-01.md) | 2026-10-01 | CI/test/build timings before and after; open speed-up options are in [../ROADMAP.md](../ROADMAP.md) ("Build-/CI-Tempo") |
| [COLD-START-2026-10.md](COLD-START-2026-10.md) | 2026-10-31 | critical path, precache and cold start before/after (lazy boundaries, precache without tools/chat/dictionaries), bundle budget |
| [DATA-BASELINE-2026-11-03.md](DATA-BASELINE-2026-11-03.md) | 2026-11-03 | data layer with 33k rows (20k bookings): start, modules, search, backup, sync; ranked time sinks; `npm run measure:data` / `measure:micro` |
| [CI-BASELINE-2-2026-11-04.md](CI-BASELINE-2-2026-11-04.md) | 2026-11-04 | CI/Release/Dev-Preview wall clock, critical path, caches and plan for round 2 |
| [MAIN-THREAD-COMMANDS-2026-11.md](MAIN-THREAD-COMMANDS-2026-11.md) | 2026-11-10 | every Tauri command: sync or async, can it block the main thread (yes / no / unchecked), what moved off it (UI audit 0a-4) |
| [CI-2026-11.md](CI-2026-11.md) | 2026-11-10 | CI round 3: wait and run time per job over 1000 runs, push → green, runner load, waste, flaky tests by file:line, levers; repeat with `node scripts/ci/measure.mjs` |
| [CI-2026-11-PACKAGES.md](CI-2026-11-PACKAGES.md) | 2026-11-10 | hand-over prompts for the larger CI levers (order, model, what only the maintainer can do) |
