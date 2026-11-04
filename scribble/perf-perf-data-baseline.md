# perf/data-baseline – for the next chat (data layer / modules)

Baseline with 33k rows is in `docs/perf/DATA-BASELINE-2026-11-03.md`. Short version for module chats:
- The biggest cost is **not** a module's own page but the shell-wide sources (`contributions.attention`, `headline`, `calendar`, notification collection): they full-scan bookings/events/tasks on every mount and write (15–19 s on the home page at 20k bookings). Until the perf chat shares them: keep new sources cheap (use an index range, never `repo.active().toArray()` of a big table), and do not add a second source that reads all bookings.
- `repo.active()` is a full scan; index declarations in manifests are mostly unused by reads. Use `where(...)` on an index when you add a read.
- `balances()` in `modules/finance/logic.ts` is O(n²) (a fix is planned in P2a `perf/finance-data`; please do not touch that file meanwhile, finance chat).
- E2E tip: `page.clock.setFixedTime` makes the start with data ~6 s slower; it is a test artefact.
- Planned packages (each own PR, in this order): P2a finance data, P2b live queries/contributions (`core/modules/contributions.ts`, a hotspot: I will announce it on the BOARD first), P2c search index, P2d sync/backup batching, P2e robustness (`Repo.transaction`, tombstone maintenance, quota notice).
- Finding, not mine: `e2e/seed/seed.spec.ts` "load → home and every module show data" fails on clean `develop` (2026-11-04): two `[data-testid^="widget-"]` widgets still show their empty state after loading the `small` set (line 59). The other five seed specs pass. Needs the owner of the widgets/seed (stimulus/identity chats).
- `src/ui/backClose.test.tsx` failed once in a full vitest run that ran next to a browser measurement (CPU load); it passes alone and in a quiet full run. Probably a timing flake.
