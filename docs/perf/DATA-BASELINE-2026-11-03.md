# Data layer baseline – 2026-11-03

Phase 1 of the data-layer performance task: **measured, nothing optimised yet**. Every number below is the "before"
for the packages in the last section. Measured on `develop` @ `e16729b8` (+ the `xl` seed scale of this branch).

## How it was measured
- Data: Dev-Preview build with the new seed scale **`xl`** (`core/seed`, not offered in the UI): 20,211 bookings,
  5,250 calendar events, 2,003 notes, 2,604 tasks, 1,101 habit entries, 330 documents, 300 invoices, 300 people,
  all other modules at their `large` size. 33,470 rows, **54 MB** IndexedDB (`navigator.storage.estimate`).
- `npm run measure:data` (`e2e/perf/data.spec.ts`, `playwright.perf.config.ts`, not in CI): Chromium, profiles
  `desktop` (1280 px) and `pixel-7` (phone viewport, **CPU 4× slower** through CDP once the data is loaded).
  An init script wraps the IndexedDB read methods, so no app code is touched: it counts per object store how many
  reads were started (`ops`) and how many rows they delivered (`rows`, "scanned"). **Settled** = time of the last
  IndexedDB read after the action, i.e. when every live query has finished loading.
- `npm run measure:micro` (`src/perf/micro.perf.ts`): pure logic and sync on **fake-indexeddb**. Only compare
  these numbers with each other, not with the browser numbers.
- Desktop: median of 3 runs. Phone: **one run** per step (a full 3-run pass takes over an hour at 4× CPU), so the
  phone numbers are an order of magnitude; load from a previous page can spill into the next step (e.g. `todos`,
  `bookmarks`, `maps` on the phone list a few ten seconds that the desktop run does not show).
- A test clock frozen with `page.clock.setFixedTime` (as `e2e/seed` uses) made the start with data about 6 s slower
  by itself; the perf spec therefore does not freeze the clock. Worth knowing for other specs.
- Not measured here (no Windows, no emulator in the container): the portable exe and a real Android device, the
  Rust command blocking (static findings only), a real sync server (engine only, with `MemoryServer`), mail with
  10k messages (the local mail cache is capped at 200 threads and 60 bodies by design, so the volume never lands
  in IndexedDB). Manual tests PF1–PF3 in [MANUAL-TESTS](../MANUAL-TESTS.md) cover the devices.

## Results
| | desktop | phone (4× CPU) |
|---|---|---|
| Load `xl` (createMany in chunks of 500) | 96 s | 82 s (not throttled) |
| Start: first heading (`main h1`) | 0.34 s | 1.2 s |
| Start: **settled** (all home queries done) | **18.7 s** | **52.5 s** |
| Start: reads | 295 reads, **357,449 rows** | 345 reads, 377,031 rows |
| Quick capture (`/?capture=1`): field focused | 0.38 s | 1.7 s |
| JS heap after home / after all modules | 17 MB / 29 MB | 17 MB / 20 MB |
| Backup file (JSON) | 17.5 MB | |
| Backup: read + parse + preview | 0.75 s | 3.0 s |
| Backup: restore ("Importieren", merge into empty) | 10.8 s | 20.4 s |
| Backup: create and download | 2.6 s | 5.6 s |
| Remove the seed (30k rows) | 47 s | 34 s (not throttled) |

### Opening a module (client-side navigation from the overview, settled)
Everything not listed settles in under 0.35 s on the desktop (accounts, bookmarks, chat, habits, invoices, lists,
maps, music, notes 0.21 s, people, subscriptions, timetrack, todos 0.26 s, vault, weather).

| Module | desktop | rows scanned | phone |
|---|---|---|---|
| calendar | **16.4 s** | 330,716 (141 reads) | 44.7 s |
| budgets | **13.6 s** | 263,119 (40 reads) | 39.9 s |
| pantry (120 rows!) | **15.4 s** | 291,902 (59 reads) | 68.6 s |
| finance | **7.5 s** | 70,320 (46 reads) | 12.9 s |

The pantry page itself holds 120 rows. Its 292k scanned rows are **283k bookings in 14 full scans** (plus events,
tasks, documents): the shell-wide sources (attention strip, headline, notification collection) re-run on every
mount and on every write. The same bookings scans are in the start (303k bookings rows in 16 reads), calendar
and budgets.

### Command palette search (typed with 60 ms per key, settled)
| Query | desktop | rows scanned | phone |
|---|---|---|---|
| tankstelle | 3.6 s | 87,298 (57 reads) | 53.6 s |
| arzt | 1.9 s | 31,720 | 2.5 s |
| miete 12 | 0.8 s | 7,862 | 6.4 s |

Every query that survives the 150 ms debounce reads **every searchable table completely** (about 31,000 documents)
and builds a new MiniSearch index (`core/ai/search/fulltext.ts`). Micro-benchmark (fake-indexeddb, 31,000 documents):
**760 ms per query**.

### Micro-benchmarks
| | result |
|---|---|
| `balances()` (finance/logic.ts) one account, 1k / 5k / 20k / 50k bookings | 8 ms / 58 ms / **2.2 s** / **19.3 s** per call (O(n²): array copy per booking) |
| sync engine, first push of 10,000 records (3 fields each) | 2.05 s (40 requests); 2,000 records 0.43 s |
| sync engine, first pull on a fresh device | 1.29 s (31 requests); 2,000 records 0.38 s |
| `createMany` of 10,000 records | 0.57 s |

In the browser run the 20k bookings are spread over 3 accounts, so `balances()` costs less there (about 7k per
account); a user with one big account gets the numbers above, on every render, up to ten calls per render.

## Ranking of the time sinks
| # | Cause | Effect (desktop) | Where |
|---|---|---|---|
| 1 | Shell-wide contributions (attention, headline, calendar items, notification collection) full-scan bookings, events, tasks and run again on every mount and every write; hook instances are not shared (5× `useCalendarItems`, 3× `useAttentionItems` on the home page) | 14–18 full scans of 20k bookings, **15–19 s** until a page is quiet, 357k rows at start | `core/modules/contributions.ts`, `modules/finance/{attention,headline}.ts`, `modules/budgets/{attention,data}.ts`, `modules/calendar/calendar.ts` |
| 2 | Budgets: one full booking scan per month and one per budget (N+1) | 13 scans, 13.6 s | `modules/budgets/data.ts` |
| 3 | `repo.active()` is always a full scan; declared indexes (`date`, `accountId`, `startDate`, …) are not used by reads; no `deletedAt` index | every read costs the whole table | `core/db/repo.ts:222`, `core/db/schema.ts` |
| 4 | Search rebuilds the whole index per query | 0.8–3.6 s per query, 7.9k–87k rows | `core/ai/search/fulltext.ts` |
| 5 | `balances()` O(n²) | 2.2 s per call at 20k in one account | `modules/finance/logic.ts:46` |
| 6 | Finance page loads all bookings in several hooks | 7.5 s | `modules/finance/summary.ts`, `components/Tabs.tsx` |
| 7 | Restore is one transaction over all tables, row by row; backup holds and stringifies everything in memory | 10.8 s restore, 17.5 MB file | `core/backup/apply.ts`, `backup.ts` |
| 8 | Sync: `readOutbox` N+1 `get`, `applyRemote` per-record `get`/`put`, `markAllDirty` not chunked | linear, 2 s per 10k records on fake-indexeddb | `core/storage/dexie.ts` |
| 9 | Tombstones and `_outbox` are only cleaned by the sync maintenance (never without sync); `_imports` never | grows, inflates every scan | `core/sync/tombstones.ts`, `core/sync/service.ts:274` |

Not a problem at this volume: memory (≤ 35 MB JS heap), IndexedDB size (54 MB for 33k rows, quota 3 GB), the
cold start to the first heading (0.34 s), quick capture (0.38 s desktop, 1.7 s phone). A quota hint is a
robustness item, not a speed item.

## Static findings without a measurement here
- Writes that belong together are separate transactions: invoice paid → finance booking (event bus, errors only
  logged), import commit (`_imports` row last), repeating bookings and subscription charges. Details in the PR text.
- Rust commands on the main thread: `disk_can_delete`, `disk_delete_plan` (list all processes), `disk_query`,
  `disk_children` (tree walk under a lock), `browser_clear_data` (`remove_dir_all`). To be measured on the exe (PF3).

## Proposal for Phase 2 (each its own branch and PR, stop in between)
1. **P2a `perf/finance-data`:** linear and cached `balances()`, one shared booking load, budgets by `date` range,
   `[accountId+date]` index with migration. Targets rows 2, 5, 6.
2. **P2b `perf/live-queries`:** one shared, reference-counted live query per contribution kind, indexed calendar
   source, coalesced notification triggers, mail cache in one transaction. Targets row 1.
3. **P2c `perf/search-index`:** incremental MiniSearch (already a dependency) per collection, dirty-marked by
   `createRepo`, lazily built, optionally in a worker. Targets row 4.
4. **P2d `perf/sync-backup-batch`:** bulk reads in sync, one stringify in backup, parsers in a worker. Rows 7, 8.
5. **P2e `fix/data-robustness`:** `Repo.transaction`, idempotent repair of invoice bookings, resumable import,
   local tombstone/outbox/`_imports` maintenance without sync, quota notice, parallel `checkDb`. Row 9.
Targets are set per package from the table above; "after" numbers use the same commands.

## After the packages
Same commands, same `xl` data, desktop. "Before" = the table above; "after" runs use one run per step, so differences
below about 30 % are noise (the search rows are untouched by P2a and show that spread).

### P2a `perf/finance-data` (2026-11-04)
`balances()` in one pass, `expensesByCategory` and the price-change source read by the `date` index, budgets plan scan
once per range instead of once per budget. No schema change (an `[accountId+date]` index would have no reader).

| | before | after |
|---|---|---|
| Start, settled | 18.7 s | **6.5 s** (rows 357k → 119k) |
| Budgets | 13.6 s | **2.7 s** (rows 263k → 43k) |
| Calendar | 16.4 s | **4.4 s** (rows 331k → 72k) |
| Pantry | 15.4 s | **3.7 s** (rows 292k → 53k) |
| Finance | 7.5 s | 5.3 s |
| `balances()` 20k / 50k bookings, one account | 2,210 ms / 19,289 ms | **2.5 ms / 3.1 ms** |
| Search "tankstelle" / "arzt" / "miete 12" | 3.6 / 1.9 / 0.8 s | 7.7 / 1.8 / 0.8 s (noise, not touched) |

What is left is mostly row 1 of the ranking: headline, calendar items and the finance page itself still load all
bookings (about 40k rows per page open); that is P2b.

### P2d `perf/sync-backup-batch` (2026-11-04)
`core/storage/dexie.ts`: `readOutbox` reads the records with one `bulkGet` per collection (was one `get` per record),
`applyRemote` reads the chunk with one `bulkGet` and writes with one `bulkPut` per collection, `markAllDirty` writes the
outbox in slices of 5,000. The LWW rule (`core/sync/ops.ts`), the sync encryption and the backup format are untouched.
Micro-benchmark on fake-indexeddb (`npm run measure:micro`), 10,000 records of 3 fields:

| | before | after |
|---|---|---|
| First pull on a fresh device (apply) | 885 ms | **~400 ms** (−55 %) |
| First push (read outbox + upload) | 1,365 ms | **~1,100 ms** (−20 %) |

Backup stages (22,000 records, 11 MB file, fake-indexeddb), for the record: create 221 ms, stringify 61 ms, parse
240 ms, **merge into an empty database 1.75 s**. The format steps are cheap; the restore time is the per-record
last-write-wins merge (`recordToOps` + `mergeOps`), which is the rule that sync and backup share and was left alone.
In the browser the restore went from 10.8 s to about 6 s with P2b (fewer live-query re-runs after the bulk write).
Parsers in a Web Worker (bank, notes, ICS) were not done: they parse small files in practice (the backup parse is
240 ms for 11 MB), so the copy to the worker would cost about what it saves.

## Re-running
```bash
cd web
npm run measure:data                                   # desktop + pixel-7, about 1 h, writes node_modules/.cache/perf-data/<label>-<profile>.json
DATA_RUNS=1 npm run measure:data -- --project=pixel-7  # quicker phone pass
DATA_LABEL=after npm run measure:micro                 # micro-benchmarks
```
Variables: `DATA_SCALE` (`small|medium|large|xl`, default `xl`), `DATA_RUNS` (default 3), `DATA_LABEL`, `DATA_OUT`.
